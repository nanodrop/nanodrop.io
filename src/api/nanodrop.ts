import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { NanoWalletState } from 'nano-wallet-js'
import NanoWallet from 'nano-wallet-js'
import { Unit, checkAddress, convert } from 'nanocurrency'

import { errorHandler } from './middlewares'
import type { Bindings } from './types'
import { TunedBigNumber, formatNanoAddress, isValidIPv4OrIpv6 } from './utils'

const TMP_IP_BLACKLIST_EXPIRATION = 1000 * 60 * 5
const MIN_DROP_AMOUNT = 0.000001
const MAX_DROP_AMOUNT = 0.01
const DIVIDE_BALANCE_BY = 10000
const PERIOD = 1000 * 60 * 60 * 24 * 7
const MAX_DROPS_PER_IP = 5
const MAX_DROPS_PER_PROXY_IP = 3
const MAX_DROP_PER_IP_SIMULTANEOUSLY = 3
const ENABLE_LIMIT_PER_IP_IN_DEV = false
const MAX_DROPS_PER_ACCOUNT = 3
const MAX_TMP_ACCOUNT_BLACKLIST_LENGTH = 10000
const VERIFICATION_REQUIRED_BY_DEFAULT = true
const VERIFY_WHEN_PROXY = true
const BAN_PROXIES = false
const PROXY_AMOUNT_DIVIDE_BY = 10
const LIMITED_COUNTRIES: string[] = []
const MAX_DROPS_PER_IP_IN_LIMITED_COUNTRY = 2
const LOCAL_REQUEST_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const DEFAULT_MIN_RECEIVABLE_AMOUNT = '0.0001'
const MIN_RECEIVABLE_AMOUNT_SETTING_KEY = 'min_receivable_amount_raw'

type CountRow = { count: number }
type AverageRow = { average: number | null }
type WalletStateRow = { state: string }
type IPWhitelistRow = { ip: string }
type AccountWhitelistRow = { account: string }
type AdminSettingRow = { value: string }
type CountryDropsRow = { country_code: string; count: number }
type DailyDropsRow = { day: string; count: number }
type ReceivableBlock = { blockHash: string; amount: string }
type DropReadiness = {
	amount: string
	amountNano: string
	verificationRequired: boolean
}
type DropContext = DropReadiness & { ip: string }
type RecentDropRow = {
	hash: string
	account: string
	amount: string
	took: number
	timestamp: number
	country_code: string
	is_proxy: number
}

const isLocalPreviewRequest = (request: Request) => {
	return LOCAL_REQUEST_HOSTNAMES.has(new URL(request.url).hostname)
}

const getClientIp = (request: Request, isDev: boolean) => {
	if (isDev) {
		return '127.0.0.1'
	}

	const cfConnectingIp = request.headers.get('cf-connecting-ip')
	if (cfConnectingIp) {
		return cfConnectingIp
	}

	const realIp = request.headers.get('x-real-ip')
	if (realIp) {
		return realIp
	}

	const forwardedFor = request.headers.get('x-forwarded-for')
	if (forwardedFor) {
		return forwardedFor.split(',')[0]?.trim() || null
	}

	if (isLocalPreviewRequest(request)) {
		return '127.0.0.1'
	}

	return null
}

const getCountryCode = (request: Request, isDev: boolean) => {
	if (isDev) {
		return '??'
	}

	const countryCode = request.headers.get('cf-ipcountry')
	if (countryCode) {
		return countryCode
	}

	if (isLocalPreviewRequest(request)) {
		return '??'
	}

	return null
}

export class NanoDropDO extends DurableObject<Bindings> {
	app = new Hono<{ Bindings: Bindings }>().onError(errorHandler)
	wallet: NanoWallet
	sql: SqlStorage
	static version = 'v1.0.0'
	db: D1Database
	ipDropQueue = new Map<string, Set<Promise<void>>>()
	isDev: boolean

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env)
		this.isDev = env.__DEV__ === 'true'
		this.sql = state.storage.sql
		this.db = env.NANODROP_DB
		this.wallet = new NanoWallet({
			rpcUrls: env.RPC_URLS.split(','),
			workerUrls: env.WORKER_URLS.split(','),
			privateKey: env.PRIVATE_KEY,
			representative: env.REPRESENTATIVE,
			debug: env.DEBUG === 'true',
			timeout: 30000,
		})

		state.blockConcurrencyWhile(async () => {
			this.initSqlSchema()
			await this.init()
		})

		this.app.get('/status', async c => {
			const originError = this.getOriginError(c.req.raw, env)
			if (originError) {
				return c.json({ error: originError.message }, originError.status)
			}

			const accountParam = c.req.query('account')
			let account: string | undefined

			if (accountParam) {
				if (!checkAddress(accountParam)) {
					return c.json({ error: 'Invalid account' }, 400)
				}
				account = formatNanoAddress(accountParam)
			}

			const { amount, amountNano, verificationRequired } =
				await this.getDropReadiness(c.req.raw, account)

			return c.json({ amount, amountNano, verificationRequired })
		})

		this.app.post('/drop', async c => {
			try {
				const startedAt = Date.now()
				const payload = await c.req.json()

				if (!payload.account) {
					return c.json({ error: 'Account is required' }, 400)
				}

				if (!checkAddress(payload.account)) {
					return c.json({ error: 'Invalid account' }, 400)
				}

				const account = formatNanoAddress(payload.account)

				const originError = this.getOriginError(c.req.raw, env)
				if (originError) {
					return c.json({ error: originError.message }, originError.status)
				}

				const { amount, verificationRequired, ip } =
					await this.getDropReadiness(c.req.raw, account)
				const dequeue = await this.enqueueIPDrop(ip)

				try {
					if (verificationRequired) {
						if (!payload.captchaToken) {
							return c.json({ error: 'Captcha token is missing' }, 400)
						}

						if (!env.HCAPTCHA_SECRET) {
							return c.json({ error: 'HCaptcha secret is missing' }, 500)
						}

						const formData = new FormData()
						formData.append('secret', env.HCAPTCHA_SECRET)
						formData.append('response', payload.captchaToken)

						const result = await fetch('https://api.hcaptcha.com/siteverify', {
							body: formData,
							method: 'POST',
						})

						const outcome = await result.json<{ success: boolean }>()

						if (!outcome.success) {
							return c.json({ error: 'HCaptcha token failed' }, 400)
						}
					}

					const { hash } = await this.wallet.send(account, amount)
					const timestamp = Date.now()
					const took = timestamp - startedAt

					this.saveDrop({
						hash,
						account,
						amount,
						ip,
						timestamp,
						took,
					}).finally(() => {
						dequeue()
					})

					return c.json({ hash, amount })
				} catch (error) {
					dequeue()
					throw error
				}
			} catch (error) {
				this.wallet.sync()
				throw error
			}
		})

		this.app.get('/drops', async c => {
			const orderBy = c.req.query('orderBy')?.toUpperCase() || 'DESC'
			if (orderBy !== 'ASC' && orderBy !== 'DESC') {
				return c.json({ error: 'Invalid orderBy' }, 400)
			}

			const limit = Number(c.req.query('limit')) || 20
			if (isNaN(limit) || limit < 1 || limit > 100) {
				return c.json({ error: 'Invalid limit' }, 400)
			}

			const offset = Number(c.req.query('offset')) || 0
			if (isNaN(offset) || offset < 0) {
				return c.json({ error: 'Invalid offset' }, 400)
			}

			const [count, data] = await this.db.batch<Record<string, any>>([
				this.db.prepare('SELECT COUNT(*) as count FROM drops'),
				this.db.prepare(`
					SELECT hash, account, amount, took, timestamp, ip_info.country_code, ip_info.is_proxy
					FROM drops
					INNER JOIN ip_info ON drops.ip = ip_info.ip
					ORDER BY timestamp ${orderBy}
					LIMIT ${limit}
					OFFSET ${offset}
				`),
			])

			const total = count.results ? (count.results[0].count as number) : 0

			const drops =
				data.results?.map(drop => ({
					...drop,
					is_proxy: drop.is_proxy ? true : false,
				})) || []

			return c.json({
				total,
				orderBy,
				limit,
				offset,
				drops,
			})
		})

		this.app.get('/drops/countries', async c => {
			const { results } = await env.NANODROP_DB.prepare(
				`
				SELECT *
				FROM drops_by_country
			`,
			).all<{ country_code: string; count: number }>()

			return c.json(
				Object.fromEntries(
					results?.map(({ country_code, count }) => [country_code, count]) ||
						[],
				),
			)
		})

		this.app.get('/wallet', c => {
			const { balance, receivable, frontier, representative } =
				this.wallet.state
			return c.json({
				account: this.wallet.account,
				balance,
				receivable,
				frontier,
				representative,
			})
		})

		this.app.post('/wallet/sync', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			await this.wallet.sync()
			return c.json({ success: true })
		})

		this.app.get('/wallet/receivables', async c => {
			return c.json(this.getFilteredReceivableBlocks())
		})

		this.app.get('/wallet/receivables/config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getReceivableConfig())
		})

		this.app.put('/wallet/receivables/config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const payload = await c.req.json().catch(() => null)
			const minReceivableAmount =
				typeof payload?.minReceivableAmount === 'string'
					? payload.minReceivableAmount.trim()
					: ''

			if (!this.isValidNanoAmount(minReceivableAmount)) {
				return c.json({ error: 'Invalid minReceivableAmount' }, 400)
			}

			const config = await this.setMinReceivableAmount(minReceivableAmount)
			return c.json(config)
		})

		this.app.post('/wallet/receive/:link', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const link = c.req.param('link')
			const { hash } = await this.wallet.receive(link)
			return c.json({ hash })
		})

		this.app.get('/whitelist/ip', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getIPWhitelist())
		})

		this.app.put('/whitelist/ip/:ipAddress', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const ip = c.req.param('ipAddress')
			if (!isValidIPv4OrIpv6(ip)) {
				return c.json({ error: 'Invalid IP' }, 400)
			}

			this.removeIPFromTmpBlacklist(ip)
			this.addIPToWhitelist(ip)

			return c.json({ success: true })
		})

		this.app.delete('/whitelist/ip/:ipAddress', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const ip = c.req.param('ipAddress')
			if (!isValidIPv4OrIpv6(ip)) {
				return c.json({ error: 'Invalid IP' }, 400)
			}

			this.removeIPFromWhitelist(ip)

			return c.json({ success: true })
		})

		this.app.get('/whitelist/account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getAccountWhitelist())
		})

		this.app.put('/whitelist/account/:account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			this.removeAccountFromTmpBlacklist(account)
			this.addAccountToWhitelist(account)

			return c.json({ success: true })
		})

		this.app.delete('/whitelist/account/:account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			this.removeAccountFromWhitelist(account)

			return c.json({ success: true })
		})

		this.app.get('/analytics', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(await this.getAdminAnalytics())
		})
	}

	getAdminAuthError(request: Request, env: Bindings) {
		if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
			return { message: 'Unauthorized', status: 401 as const }
		}

		return null
	}

	initSqlSchema() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS wallet_state (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				state TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS ip_whitelist (
				ip TEXT PRIMARY KEY,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS account_whitelist (
				account TEXT PRIMARY KEY,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS temporary_account_blacklist (
				sequence INTEGER PRIMARY KEY AUTOINCREMENT,
				checksum TEXT UNIQUE NOT NULL,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS temporary_ip_blacklist (
				ip TEXT PRIMARY KEY,
				expires_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS admin_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS temporary_ip_blacklist_expires_at_index
				ON temporary_ip_blacklist(expires_at);
		`)
	}

	async init() {
		this.wallet.configure({
			minAmountRaw: this.getMinReceivableAmountRaw(),
		})

		const walletState = this.getWalletState()
		if (walletState) {
			this.wallet.update(walletState)
		} else {
			this.wallet.sync()
		}

		this.wallet.subscribe(state => {
			this.saveWalletState(state)
		})
	}

	getWalletState() {
		const row = this.sql
			.exec<WalletStateRow>('SELECT state FROM wallet_state WHERE id = 1')
			.next()

		if (row.done) {
			return null
		}

		return JSON.parse(row.value.state) as NanoWalletState
	}

	getReceivableConfig() {
		const minReceivableAmountRaw = this.getMinReceivableAmountRaw()

		return {
			minReceivableAmount: convert(minReceivableAmountRaw, {
				from: Unit.raw,
				to: Unit.NANO,
			}),
			minReceivableAmountRaw,
		}
	}

	getMinReceivableAmountRaw() {
		const row = this.sql
			.exec<AdminSettingRow>(
				'SELECT value FROM admin_settings WHERE key = ?',
				MIN_RECEIVABLE_AMOUNT_SETTING_KEY,
			)
			.next()

		if (!row.done) {
			return row.value.value
		}

		return convert(DEFAULT_MIN_RECEIVABLE_AMOUNT, {
			from: Unit.NANO,
			to: Unit.raw,
		})
	}

	async setMinReceivableAmount(minReceivableAmount: string) {
		const minReceivableAmountRaw = convert(minReceivableAmount, {
			from: Unit.NANO,
			to: Unit.raw,
		})

		this.sql.exec(
			`
				INSERT INTO admin_settings (key, value, updated_at)
				VALUES (?, ?, ?)
				ON CONFLICT(key) DO UPDATE SET
					value = excluded.value,
					updated_at = excluded.updated_at
			`,
			MIN_RECEIVABLE_AMOUNT_SETTING_KEY,
			minReceivableAmountRaw,
			Date.now(),
		)

		this.wallet.configure({ minAmountRaw: minReceivableAmountRaw })
		await this.wallet.getReceivable()

		return this.getReceivableConfig()
	}

	isValidNanoAmount(amount: string) {
		try {
			return (
				amount.length > 0 &&
				TunedBigNumber(amount).isFinite() &&
				!TunedBigNumber(amount).isNegative() &&
				convert(amount, { from: Unit.NANO, to: Unit.raw }) !== ''
			)
		} catch {
			return false
		}
	}

	getFilteredReceivableBlocks() {
		const minReceivableAmountRaw = this.getMinReceivableAmountRaw()

		return this.wallet.receivableBlocks
			.filter(block =>
				TunedBigNumber(block.amount).isGreaterThanOrEqualTo(
					minReceivableAmountRaw,
				),
			)
			.sort((left: ReceivableBlock, right: ReceivableBlock) => {
				const byAmount =
					TunedBigNumber(right.amount).comparedTo(left.amount) || 0
				if (byAmount !== 0) return byAmount

				return left.blockHash.localeCompare(right.blockHash)
			})
	}

	saveWalletState(state: NanoWalletState) {
		this.sql.exec(
			`
				INSERT INTO wallet_state (id, state, updated_at)
				VALUES (1, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					state = excluded.state,
					updated_at = excluded.updated_at
			`,
			JSON.stringify(state),
			Date.now(),
		)
	}

	getOriginError(request: Request, env: Bindings) {
		if (
			env.ALLOW_ORIGIN &&
			new URL(env.ALLOW_ORIGIN).origin !== request.headers.get('origin')
		) {
			return { message: 'Origin mismatch', status: 400 as const }
		}

		const origin = request.headers.get('origin') || 'Unknown'
		if (origin.includes('api.nanodrop.io')) {
			return {
				message: 'Temporarily unavailable due spam',
				status: 403 as const,
			}
		}

		return null
	}

	async getDropReadiness(
		request: Request,
		account?: string,
	): Promise<DropContext> {
		const ip = getClientIp(request, this.isDev)
		if (!ip) {
			throw new HTTPException(400, { message: 'IP header is missing' })
		}

		const countryCode = getCountryCode(request, this.isDev)
		if (!countryCode) {
			throw new HTTPException(400, { message: 'Country header is missing' })
		}

		const [dropsCount, ipInfo] = await this.db.batch<Record<string, any>>([
			this.db
				.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE ip = ?1 AND timestamp >= ?2',
				)
				.bind(ip, Date.now() - PERIOD),
			this.db.prepare('SELECT is_proxy FROM ip_info WHERE ip = ?1').bind(ip),
		])

		const count = dropsCount.results
			? (dropsCount.results[0].count as number)
			: 0
		const limitedByCountry = LIMITED_COUNTRIES.includes(countryCode)

		if (
			(count >= MAX_DROPS_PER_IP ||
				(limitedByCountry && count >= MAX_DROPS_PER_IP_IN_LIMITED_COUNTRY)) &&
			(!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV) &&
			!this.ipIsWhitelisted(ip)
		) {
			throw new HTTPException(403, {
				message: 'Drop limit reached for your IP',
			})
		}

		if (
			(!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV) &&
			this.ipIsInTmpBlacklist(ip)
		) {
			throw new HTTPException(403, { message: 'Limit reached for this IP' })
		}

		let canBeProxy = false

		if (!ipInfo.results?.length) {
			let proxyCheckedBy = 'none'

			if (!this.isDev && !isLocalPreviewRequest(request)) {
				try {
					canBeProxy = await this.checkProxy(ip)
					proxyCheckedBy = 'badip.xyz'
				} catch {
					console.error(`Failed checking IP ${ip}`)
				}
			}

			await this.db
				.prepare(
					'INSERT INTO ip_info (ip, country_code, is_proxy, proxy_checked_by) VALUES (?1, ?2, ?3, ?4) ON CONFLICT do nothing',
				)
				.bind(ip, countryCode, canBeProxy ? 1 : 0, proxyCheckedBy)
				.run()
		} else {
			canBeProxy = ipInfo.results[0].is_proxy ? true : false
		}

		if (canBeProxy && BAN_PROXIES) {
			throw new HTTPException(403, { message: 'Proxies are not allowed' })
		}

		if (canBeProxy && count >= MAX_DROPS_PER_PROXY_IP) {
			throw new HTTPException(403, {
				message: 'Drop limit reached for your ip',
			})
		}

		if (account) {
			if (account === this.wallet.account) {
				throw new HTTPException(400, { message: 'I cannot send to myself' })
			}

			const accountWhitelisted = this.accountIsWhitelisted(account)
			if (!accountWhitelisted && (!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV)) {
				const { results } = await this.db
					.prepare(
						'SELECT COUNT(*) as count FROM drops WHERE account = ?1 AND timestamp >= ?2',
					)
					.bind(account, Date.now() - PERIOD)
					.all<CountRow>()
				const accountDropsCount = results?.[0]?.count || 0

				if (accountDropsCount >= MAX_DROPS_PER_ACCOUNT) {
					throw new HTTPException(403, {
						message: 'Limit reached for this account',
					})
				}
			}

			if (!accountWhitelisted && this.accountIsInTmpBlacklist(account)) {
				throw new HTTPException(403, {
					message: 'Limit reached for this account',
				})
			}
		}

		const defaultAmount = this.getDropAmount()
		if (defaultAmount === '0') {
			throw new HTTPException(500, { message: 'Insufficient balance' })
		}

		const amount = canBeProxy
			? TunedBigNumber(defaultAmount)
					.dividedBy(PROXY_AMOUNT_DIVIDE_BY)
					.toString(10)
			: defaultAmount
		const amountNano = convert(amount, { from: Unit.raw, to: Unit.NANO })
		const verificationRequired =
			VERIFICATION_REQUIRED_BY_DEFAULT || (canBeProxy && VERIFY_WHEN_PROXY)

		return { ip, amount, amountNano, verificationRequired }
	}

	getDropAmount() {
		const balance = this.wallet.balance
		const min = convert(MIN_DROP_AMOUNT.toString(), {
			from: Unit.NANO,
			to: Unit.raw,
		})
		const max = convert(MAX_DROP_AMOUNT.toString(), {
			from: Unit.NANO,
			to: Unit.raw,
		})

		if (TunedBigNumber(balance).isLessThan(min)) return '0'

		const amount = TunedBigNumber(balance)
			.dividedBy(DIVIDE_BALANCE_BY)
			.toString(10)
		const amountFixed = TunedBigNumber(amount)
			.minus(amount.substring(1, amount.length))
			.toString(10)
			.replace(/[2-9]/g, '1')

		if (TunedBigNumber(amountFixed).isLessThan(min)) return min

		return TunedBigNumber(amountFixed).isGreaterThan(max) ? max : amountFixed
	}

	async checkProxy(ip: string) {
		const response = await fetch(`https://api.badip.xyz/${ip}?strategy=quick`)
		if (!response.ok) {
			throw new Error('Proxy check failed')
		}

		const data = await response.json<Record<string, any>>()
		if (!('isBad' in data)) {
			throw new Error('Proxy check failed')
		}

		return data.isBad as boolean
	}

	async saveDrop(data: {
		hash: string
		account: string
		amount: string
		ip: string
		timestamp: number
		took: number
	}) {
		const [dropsCountResult, ipCountResult] = await this.db.batch<
			Record<string, any>
		>([
			this.db
				.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE account = ?1 AND timestamp >= ?2',
				)
				.bind(data.account, Date.now() - PERIOD),
			this.db
				.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE ip = ?1 AND timestamp >= ?2',
				)
				.bind(data.ip, Date.now() - PERIOD),
			this.db
				.prepare(
					'INSERT INTO drops (hash, account, amount, ip, timestamp, took) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
				)
				.bind(
					data.hash,
					data.account,
					data.amount,
					data.ip,
					data.timestamp,
					data.took,
				),
		])

		const dropsCount = dropsCountResult.results
			? (dropsCountResult.results[0].count as number)
			: 0

		if (
			dropsCount + 1 >= MAX_DROPS_PER_ACCOUNT &&
			(!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV)
		) {
			if (!this.accountIsWhitelisted(data.account)) {
				this.addAccountToTmpBlacklist(data.account)
			}
		}

		const ipCount = ipCountResult.results
			? (ipCountResult.results[0].count as number)
			: 0

		if (ipCount + 1 >= MAX_DROPS_PER_IP) {
			if (!this.ipIsWhitelisted(data.ip)) {
				this.addIPToTmpBlacklist(data.ip)
			}
		}
	}

	async enqueueIPDrop(ip: string): Promise<() => void> {
		let promises = this.ipDropQueue.get(ip)
		if (!promises) {
			promises = new Set<Promise<void>>()
			this.ipDropQueue.set(ip, promises)
		}

		if (promises.size >= MAX_DROP_PER_IP_SIMULTANEOUSLY) {
			throw new HTTPException(403, { message: 'Many simultaneous requests' })
		}

		let resolve: () => void
		const promise = new Promise<void>(res => {
			resolve = res
		})

		const previousPromises = Array.from(promises)
		promises.add(promise)

		await Promise.all(previousPromises).catch(() => {})

		return () => {
			resolve!()
			promises.delete(promise)
			if (promises.size === 0) {
				this.ipDropQueue.delete(ip)
			}
		}
	}

	getIPWhitelist() {
		return this.sql
			.exec<IPWhitelistRow>(
				'SELECT ip FROM ip_whitelist ORDER BY created_at ASC, ip ASC',
			)
			.toArray()
			.map(({ ip }) => ip)
	}

	ipIsWhitelisted(ip: string) {
		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM ip_whitelist WHERE ip = ?',
				ip,
			)
			.one()

		return row.count > 0
	}

	addIPToWhitelist(ip: string) {
		this.sql.exec(
			'INSERT OR IGNORE INTO ip_whitelist (ip, created_at) VALUES (?, ?)',
			ip,
			Date.now(),
		)
	}

	removeIPFromWhitelist(ip: string) {
		this.sql.exec('DELETE FROM ip_whitelist WHERE ip = ?', ip)
	}

	getAccountWhitelist() {
		return this.sql
			.exec<AccountWhitelistRow>(
				'SELECT account FROM account_whitelist ORDER BY created_at ASC, account ASC',
			)
			.toArray()
			.map(({ account }) => account)
	}

	accountIsWhitelisted(account: string) {
		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM account_whitelist WHERE account = ?',
				account,
			)
			.one()

		return row.count > 0
	}

	addAccountToWhitelist(account: string) {
		this.sql.exec(
			'INSERT OR IGNORE INTO account_whitelist (account, created_at) VALUES (?, ?)',
			account,
			Date.now(),
		)
	}

	removeAccountFromWhitelist(account: string) {
		this.sql.exec('DELETE FROM account_whitelist WHERE account = ?', account)
	}

	accountIsInTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM temporary_account_blacklist WHERE checksum = ?',
				checksum,
			)
			.one()

		return row.count > 0
	}

	addAccountToTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		this.sql.exec(
			`
				INSERT OR IGNORE INTO temporary_account_blacklist (checksum, created_at)
				VALUES (?, ?)
			`,
			checksum,
			Date.now(),
		)

		const { count } = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM temporary_account_blacklist',
			)
			.one()
		const excess = count - MAX_TMP_ACCOUNT_BLACKLIST_LENGTH

		if (excess > 0) {
			this.sql.exec(
				`
					DELETE FROM temporary_account_blacklist
					WHERE sequence IN (
						SELECT sequence
						FROM temporary_account_blacklist
						ORDER BY sequence ASC
						LIMIT ?
					)
				`,
				excess,
			)
		}
	}

	removeAccountFromTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		this.sql.exec(
			'DELETE FROM temporary_account_blacklist WHERE checksum = ?',
			checksum,
		)
	}

	ipIsInTmpBlacklist(ip: string) {
		const now = Date.now()
		this.pruneExpiredIPBlacklist(now)
		const row = this.sql
			.exec<CountRow>(
				`
					SELECT COUNT(*) as count
					FROM temporary_ip_blacklist
					WHERE ip = ? AND expires_at > ?
				`,
				ip,
				now,
			)
			.one()

		return row.count > 0
	}

	addIPToTmpBlacklist(ip: string) {
		const now = Date.now()
		this.pruneExpiredIPBlacklist(now)
		const expiresAt = now + TMP_IP_BLACKLIST_EXPIRATION

		this.sql.exec(
			`
				INSERT INTO temporary_ip_blacklist (ip, expires_at)
				VALUES (?, ?)
				ON CONFLICT(ip) DO UPDATE SET expires_at = excluded.expires_at
			`,
			ip,
			expiresAt,
		)
	}

	removeIPFromTmpBlacklist(ip: string) {
		this.sql.exec('DELETE FROM temporary_ip_blacklist WHERE ip = ?', ip)
	}

	pruneExpiredIPBlacklist(now = Date.now()) {
		this.sql.exec(
			'DELETE FROM temporary_ip_blacklist WHERE expires_at <= ?',
			now,
		)
	}

	async getAdminAnalytics() {
		const now = Date.now()
		const oneDayAgo = now - 1000 * 60 * 60 * 24
		const sevenDaysAgo = now - 1000 * 60 * 60 * 24 * 7
		const fourteenDaysAgo = now - 1000 * 60 * 60 * 24 * 14

		this.pruneExpiredIPBlacklist(now)

		const [
			totalDrops,
			last24hDrops,
			last7dDrops,
			uniqueAccounts,
			uniqueIps,
			proxyDrops,
			avgTook,
			topCountries,
			dailyDrops,
			recentDrops,
		] = await this.db.batch<Record<string, any>>([
			this.db.prepare('SELECT COUNT(*) as count FROM drops'),
			this.db
				.prepare('SELECT COUNT(*) as count FROM drops WHERE timestamp >= ?1')
				.bind(oneDayAgo),
			this.db
				.prepare('SELECT COUNT(*) as count FROM drops WHERE timestamp >= ?1')
				.bind(sevenDaysAgo),
			this.db.prepare('SELECT COUNT(DISTINCT account) as count FROM drops'),
			this.db.prepare('SELECT COUNT(DISTINCT ip) as count FROM drops'),
			this.db.prepare(`
				SELECT COUNT(*) as count
				FROM drops
				INNER JOIN ip_info ON drops.ip = ip_info.ip
				WHERE ip_info.is_proxy = 1
			`),
			this.db.prepare('SELECT AVG(took) as average FROM drops'),
			this.db.prepare(`
				SELECT country_code, count
				FROM drops_by_country
				ORDER BY count DESC, country_code ASC
				LIMIT 8
			`),
			this.db
				.prepare(
					`
					SELECT date(timestamp / 1000, 'unixepoch') as day, COUNT(*) as count
					FROM drops
					WHERE timestamp >= ?1
					GROUP BY day
					ORDER BY day ASC
				`,
				)
				.bind(fourteenDaysAgo),
			this.db.prepare(`
				SELECT hash, account, amount, took, timestamp, ip_info.country_code, ip_info.is_proxy
				FROM drops
				INNER JOIN ip_info ON drops.ip = ip_info.ip
				ORDER BY timestamp DESC
				LIMIT 10
			`),
		])

		const ipWhitelistCount = this.sql
			.exec<CountRow>('SELECT COUNT(*) as count FROM ip_whitelist')
			.one().count
		const accountWhitelistCount = this.sql
			.exec<CountRow>('SELECT COUNT(*) as count FROM account_whitelist')
			.one().count
		const temporaryIpBlacklistCount = this.sql
			.exec<CountRow>('SELECT COUNT(*) as count FROM temporary_ip_blacklist')
			.one().count
		const temporaryAccountBlacklistCount = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM temporary_account_blacklist',
			)
			.one().count

		const { balance, receivable, frontier, representative } = this.wallet.state

		return {
			generatedAt: now,
			totalDrops: this.firstCount(totalDrops),
			last24hDrops: this.firstCount(last24hDrops),
			last7dDrops: this.firstCount(last7dDrops),
			uniqueAccounts: this.firstCount(uniqueAccounts),
			uniqueIps: this.firstCount(uniqueIps),
			proxyDrops: this.firstCount(proxyDrops),
			avgTookMs: (avgTook.results?.[0] as AverageRow | undefined)?.average || 0,
			topCountries:
				topCountries.results?.map(row => ({
					country_code: (row as CountryDropsRow).country_code,
					count: (row as CountryDropsRow).count,
				})) || [],
			dailyDrops:
				dailyDrops.results?.map(row => ({
					day: (row as DailyDropsRow).day,
					count: (row as DailyDropsRow).count,
				})) || [],
			recentDrops:
				recentDrops.results?.map(row => {
					const drop = row as RecentDropRow
					return {
						...drop,
						is_proxy: drop.is_proxy ? true : false,
					}
				}) || [],
			wallet: {
				account: this.wallet.account,
				balance,
				receivable,
				frontier,
				representative,
			},
			adminState: {
				ipWhitelistCount,
				accountWhitelistCount,
				temporaryIpBlacklistCount,
				temporaryAccountBlacklistCount,
			},
		}
	}

	firstCount(result: D1Result<Record<string, any>>) {
		return result.results ? (result.results[0] as CountRow).count || 0 : 0
	}

	fetch(request: Request) {
		return this.app.fetch(request)
	}
}
