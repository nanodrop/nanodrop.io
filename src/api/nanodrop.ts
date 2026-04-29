import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { NanoWalletState } from 'nano-wallet-js'
import NanoWallet from 'nano-wallet-js'
import {
	Unit,
	checkAddress,
	checkAmount,
	checkSignature,
	convert,
	signBlock,
	verifyBlock,
} from 'nanocurrency'

import { errorHandler } from './middlewares'
import type { Bindings } from './types'
import { TunedBigNumber, formatNanoAddress, isValidIPv4OrIpv6 } from './utils'

const TICKET_EXPIRATION = 1000 * 60 * 5
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

type CountRow = { count: number }
type WalletStateRow = { state: string }
type IPWhitelistRow = { ip: string }
type AccountWhitelistRow = { account: string }

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
	ipTicketQueue = new Map<string, Set<Promise<void>>>()
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

		this.app.get('/ticket', async c => {
			if (
				env.ALLOW_ORIGIN &&
				new URL(env.ALLOW_ORIGIN).origin !== c.req.header('origin')
			) {
				return c.json({ error: 'Origin mismatch' }, 400)
			}

			const ip = getClientIp(c.req.raw, this.isDev)
			if (!ip) {
				return c.json({ error: 'IP header is missing' }, 400)
			}

			const countryCode = getCountryCode(c.req.raw, this.isDev)
			const origin = c.req.header('origin') || 'Unknown'

			if (origin.includes('api.nanodrop.io')) {
				return c.json({ error: 'Temporarily unavailable due spam' }, 403)
			}

			if (!countryCode) {
				return c.json({ error: 'Country header is missing' }, 400)
			}

			const [dropsCount, ipInfo] = await env.NANODROP_DB.batch<
				Record<string, any>
			>([
				env.NANODROP_DB.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE ip = ?1 AND timestamp >= ?2',
				).bind(ip, Date.now() - PERIOD),
				env.NANODROP_DB.prepare(
					'SELECT is_proxy FROM ip_info WHERE ip = ?1',
				).bind(ip),
			])

			const count = dropsCount.results
				? (dropsCount.results[0].count as number)
				: 0

			const limitedByCountry = LIMITED_COUNTRIES.includes(countryCode)

			if (
				(count >= MAX_DROPS_PER_IP ||
					(limitedByCountry && count >= MAX_DROPS_PER_IP_IN_LIMITED_COUNTRY)) &&
				(!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV)
			) {
				if (!this.ipIsWhitelisted(ip)) {
					return c.json({ error: 'Drop limit reached for your IP' }, 403)
				}
			}

			let canBeProxy = false

			if (!ipInfo.results?.length) {
				let proxyCheckedBy = 'none'

				if (!this.isDev && !isLocalPreviewRequest(c.req.raw)) {
					try {
						canBeProxy = await this.checkProxy(ip)
						proxyCheckedBy = 'badip.xyz'
					} catch {
						console.error(`Failed checking IP ${ip}`)
					}
				}

				await env.NANODROP_DB.prepare(
					'INSERT INTO ip_info (ip, country_code, is_proxy, proxy_checked_by) VALUES (?1, ?2, ?3, ?4) ON CONFLICT do nothing',
				)
					.bind(ip, countryCode, canBeProxy ? 1 : 0, proxyCheckedBy)
					.run()
			} else {
				canBeProxy = ipInfo.results[0].is_proxy ? true : false
			}

			if (canBeProxy && BAN_PROXIES) {
				return c.json({ error: 'Proxies are not allowed' }, 403)
			}

			if (canBeProxy && count >= MAX_DROPS_PER_PROXY_IP) {
				return c.json({ error: 'Drop limit reached for your ip' }, 403)
			}

			const defaultAmount = this.getDropAmount()
			if (defaultAmount === '0') {
				return c.json({ error: 'Insufficient balance' }, 500)
			}

			const amount = canBeProxy
				? TunedBigNumber(defaultAmount)
						.dividedBy(PROXY_AMOUNT_DIVIDE_BY)
						.toString(10)
				: defaultAmount

			const amountNano = convert(amount, { from: Unit.raw, to: Unit.NANO })
			const expiresAt = Date.now() + TICKET_EXPIRATION
			const verificationRequired =
				VERIFICATION_REQUIRED_BY_DEFAULT || (canBeProxy && VERIFY_WHEN_PROXY)
			const ticket = await this.generateTicket(
				ip,
				amount,
				expiresAt,
				verificationRequired,
			)

			return c.json({
				ticket,
				amount,
				amountNano,
				expiresAt,
				verificationRequired,
			})
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

				if (!payload.ticket) {
					return c.json({ error: 'Ticket is required' }, 400)
				}

				const account = formatNanoAddress(payload.account)

				if (account === this.wallet.account) {
					return c.json({ error: 'I cannot send to myself' }, 400)
				}

				const {
					hash: ticketHash,
					amount,
					ip,
					expiresAt,
					verificationRequired,
				} = await this.parseTicket(payload.ticket)

				if (expiresAt < Date.now()) {
					throw new Error('Ticket expired')
				}

				if (!this.isDev) {
					const clientIp = getClientIp(c.req.raw, this.isDev)
					if (!clientIp) {
						return c.json({ error: 'IP header is missing' }, 400)
					}
					if (clientIp !== ip) {
						if (!clientIp) {
							return c.json({ error: 'Ticket IP mismatch' }, 400)
						}
					}
				}

				if (this.ticketIsRedeemed(ticketHash)) {
					return c.json({ error: 'Ticket already redeemed' }, 403)
				}

				const dequeue = await this.enqueueIPTicket(ip)

				try {
					if (!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV) {
						const ipIsInTmpBlacklist = this.ipIsInTmpBlacklist(ip)
						if (ipIsInTmpBlacklist) {
							return c.json({ error: 'Limit reached for this IP' }, 403)
						}
					}

					const accountIsInTmpBlacklist = this.accountIsInTmpBlacklist(account)

					if (accountIsInTmpBlacklist) {
						return c.json({ error: 'Limit reached for this account' }, 403)
					}

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

					this.redeemTicket({ hash: ticketHash, expiresAt })

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
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			await this.wallet.sync()
			return c.json({ success: true })
		})

		this.app.get('/wallet/receivables', async c => {
			return c.json(this.wallet.receivableBlocks)
		})

		this.app.post('/wallet/receive/:link', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			const link = c.req.param('link')
			const { hash } = await this.wallet.receive(link)
			return c.json({ hash })
		})

		this.app.get('/whitelist/ip', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			return c.json(this.getIPWhitelist())
		})

		this.app.put('/whitelist/ip/:ipAddress', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
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
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			const ip = c.req.param('ipAddress')
			if (!isValidIPv4OrIpv6(ip)) {
				return c.json({ error: 'Invalid IP' }, 400)
			}

			this.removeIPFromWhitelist(ip)

			return c.json({ success: true })
		})

		this.app.get('/whitelist/account', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			return c.json(this.getAccountWhitelist())
		})

		this.app.put('/whitelist/account/:account', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
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
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			this.removeAccountFromWhitelist(account)

			return c.json({ success: true })
		})
	}

	initSqlSchema() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS wallet_state (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				state TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS redeemed_tickets (
				hash TEXT PRIMARY KEY,
				expires_at INTEGER NOT NULL
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

			CREATE INDEX IF NOT EXISTS redeemed_tickets_expires_at_index
				ON redeemed_tickets(expires_at);
			CREATE INDEX IF NOT EXISTS temporary_ip_blacklist_expires_at_index
				ON temporary_ip_blacklist(expires_at);
		`)
	}

	async init() {
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

	async generateTicket(
		ip: string,
		amount: string,
		expiresAt: number,
		verificationRequired: boolean,
	) {
		const version = 1
		const data = {
			ip,
			amount,
			version,
			expiresAt,
			verificationRequired,
		}

		const digest = await crypto.subtle.digest(
			{ name: 'SHA-256' },
			new TextEncoder().encode(JSON.stringify(data)),
		)

		const hash = Array.from(new Uint8Array(digest))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('')

		const signature = signBlock({
			hash,
			secretKey: this.wallet.config.privateKey,
		})

		return btoa(
			JSON.stringify({
				...data,
				signature,
			}),
		)
	}

	async parseTicket(ticket: string) {
		const isValidBase64 =
			ticket.length % 4 === 0 && /^[A-Za-z0-9+/]+[=]{0,2}$/.test(ticket)

		if (!isValidBase64) {
			throw new Error('Invalid ticket')
		}

		let data

		try {
			data = JSON.parse(atob(ticket))
		} catch {
			throw new Error('Invalid ticket')
		}

		const { ip, amount, version, expiresAt, verificationRequired, signature } =
			data

		if (version !== 1) {
			throw new Error('Invalid ticket version')
		}

		const isValidIP = isValidIPv4OrIpv6(ip)

		if (
			!isValidIP ||
			!checkAmount(amount) ||
			!checkSignature(signature) ||
			typeof verificationRequired !== 'boolean'
		) {
			throw new Error('Invalid ticket')
		}

		const digest = await crypto.subtle.digest(
			{ name: 'SHA-256' },
			new TextEncoder().encode(
				JSON.stringify({
					ip,
					amount,
					version,
					expiresAt,
					verificationRequired,
				}),
			),
		)

		const hash = Array.from(new Uint8Array(digest))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('')

		const matchSignature = verifyBlock({
			hash,
			publicKey: this.wallet.publicKey,
			signature,
		})

		if (!matchSignature) {
			throw new Error('Invalid ticket')
		}

		return {
			ip,
			amount,
			version,
			expiresAt,
			hash,
			verificationRequired,
			signature,
		}
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

	ticketIsRedeemed(hash: string) {
		const now = Date.now()
		this.sql.exec('DELETE FROM redeemed_tickets WHERE expires_at <= ?', now)

		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM redeemed_tickets WHERE hash = ?',
				hash,
			)
			.one()

		return row.count > 0
	}

	redeemTicket({ hash, expiresAt }: { hash: string; expiresAt: number }) {
		const now = Date.now()
		this.sql.exec('DELETE FROM redeemed_tickets WHERE expires_at <= ?', now)
		this.sql.exec(
			`
				INSERT INTO redeemed_tickets (hash, expires_at)
				VALUES (?, ?)
				ON CONFLICT(hash) DO UPDATE SET expires_at = excluded.expires_at
			`,
			hash,
			expiresAt,
		)
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

	async enqueueIPTicket(ip: string): Promise<() => void> {
		let promises = this.ipTicketQueue.get(ip)
		if (!promises) {
			promises = new Set<Promise<void>>()
			this.ipTicketQueue.set(ip, promises)
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
				this.ipTicketQueue.delete(ip)
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
		const expiresAt = now + TICKET_EXPIRATION

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

	fetch(request: Request) {
		return this.app.fetch(request)
	}
}
