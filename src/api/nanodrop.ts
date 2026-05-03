import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { NanoWalletState } from 'nano-wallet-js'
import NanoWallet from 'nano-wallet-js'
import { Unit, checkAddress, convert } from 'nanocurrency'

import { errorHandler } from './middlewares'
import type { Bindings } from './types'
import { TunedBigNumber, formatNanoAddress, isValidIPv4OrIpv6 } from './utils'

const MILLISECONDS_PER_MINUTE = 1000 * 60
const MILLISECONDS_PER_DAY = MILLISECONDS_PER_MINUTE * 60 * 24
const ENABLE_LIMIT_PER_IP_IN_DEV = false
const LOCAL_REQUEST_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1'])
const MIN_PERIOD_DAYS = 1
const MAX_PERIOD_DAYS = 30
const DEFAULT_FAUCET_CONFIG = {
	minReceivableAmount: '0.0001',
	minDropAmount: '0.000001',
	maxDropAmount: '0.01',
	divideBalanceBy: 10000,
	periodDays: 7,
	maxDropPerIpSimultaneously: 3,
	maxDropsPerAccount: 3,
	maxDropsPerIp: 5,
	maxDropsPerProxyIp: 3,
	maxDropsPerIpInLimitedCountry: 2,
	verificationRequiredByDefault: true,
	verifyWhenProxy: true,
	banProxies: false,
	proxyAmountDivideBy: 10,
	limitedCountries: [] as string[],
}
const FAUCET_CONFIG_SETTING_KEYS = {
	minReceivableAmountRaw: 'min_receivable_amount_raw',
	minDropAmount: 'min_drop_amount',
	maxDropAmount: 'max_drop_amount',
	divideBalanceBy: 'divide_balance_by',
	periodDays: 'period_days',
	maxDropPerIpSimultaneously: 'max_drop_per_ip_simultaneously',
	maxDropsPerAccount: 'max_drops_per_account',
	maxDropsPerIp: 'max_drops_per_ip',
	maxDropsPerProxyIp: 'max_drops_per_proxy_ip',
	maxDropsPerIpInLimitedCountry: 'max_drops_per_ip_in_limited_country',
	verificationRequiredByDefault: 'verification_required_by_default',
	verifyWhenProxy: 'verify_when_proxy',
	banProxies: 'ban_proxies',
	proxyAmountDivideBy: 'proxy_amount_divide_by',
	limitedCountries: 'limited_countries',
}
const WALLET_NETWORK_CONFIG_SETTING_KEYS = {
	rpcUrls: 'rpc_urls',
	workerUrls: 'worker_urls',
	representative: 'representative',
}

type CountRow = { count: number }
type AverageRow = { average: number | null }
type WalletStateRow = { state: string }
type IPWhitelistRow = { ip: string }
type AccountWhitelistRow = { account: string }
type IPBlacklistRow = { ip: string }
type AccountBlacklistRow = { account: string }
type AdminSettingRow = { value: string }
type CountryDropsRow = { country_code: string; count: number }
type DailyDropsRow = { day: string; count: number }
type ReceivableBlock = { blockHash: string; amount: string }
type FaucetConfigValues = Omit<
	typeof DEFAULT_FAUCET_CONFIG,
	'minReceivableAmount'
>
type FaucetConfig = FaucetConfigValues & {
	periodMs: number
}
type FaucetConfigParseResult =
	| { config: FaucetConfigValues }
	| { error: string }
type StringParseResult = { value: string } | { error: string }
type NumberParseResult = { value: number } | { error: string }
type BooleanParseResult = { value: boolean } | { error: string }
type StringArrayParseResult = { value: string[] } | { error: string }
type WalletNetworkConfig = {
	rpcUrls: string[]
	workerUrls: string[]
	representative: string
}
type WalletNetworkConfigParseResult =
	| { config: WalletNetworkConfig }
	| { error: string }
type WalletProofOfWorkStatus = 'cached' | 'pending'
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
	ip: string
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
	wallet!: NanoWallet
	sql: SqlStorage
	static version = 'v1.0.0'
	db: D1Database
	ipDropQueue = new Map<string, Set<Promise<void>>>()
	isDev: boolean
	private readonly persistWalletState = (state: NanoWalletState) => {
		this.saveWalletState(state)
	}

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env)
		this.isDev = env.__DEV__ === 'true'
		this.sql = state.storage.sql
		this.db = env.NANODROP_DB
		this.wallet = this.createWallet(this.getEnvWalletNetworkConfig(env), env)

		state.blockConcurrencyWhile(async () => {
			this.initSqlSchema()
			await this.init(env)
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
				proofOfWork: this.getWalletProofOfWorkStatus(),
			})
		})

		this.app.post('/wallet/sync', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			await this.wallet.sync()
			return c.json({
				success: true,
				proofOfWork: this.getWalletProofOfWorkStatus(),
			})
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

		this.app.get('/wallet/network-config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getWalletNetworkConfig(env))
		})

		this.app.put('/wallet/network-config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const payload = await c.req.json().catch(() => null)
			const parsed = this.parseWalletNetworkConfigPayload(payload)
			if ('error' in parsed) {
				return c.json({ error: parsed.error }, 400)
			}

			this.setWalletNetworkConfig(parsed.config, env)
			return c.json(this.getWalletNetworkConfig(env))
		})

		this.app.get('/config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getFaucetConfig())
		})

		this.app.put('/config', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const payload = await c.req.json().catch(() => null)
			const parsed = this.parseFaucetConfigPayload(payload)
			if ('error' in parsed) {
				return c.json({ error: parsed.error }, 400)
			}

			this.setFaucetConfig(parsed.config)
			return c.json(this.getFaucetConfig())
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

		this.app.get('/blacklist/ip', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getIPBlacklist())
		})

		this.app.put('/blacklist/ip/:ipAddress', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const ip = c.req.param('ipAddress')
			if (!isValidIPv4OrIpv6(ip)) {
				return c.json({ error: 'Invalid IP' }, 400)
			}

			this.addIPToBlacklist(ip)

			return c.json({ success: true })
		})

		this.app.delete('/blacklist/ip/:ipAddress', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			const ip = c.req.param('ipAddress')
			if (!isValidIPv4OrIpv6(ip)) {
				return c.json({ error: 'Invalid IP' }, 400)
			}

			this.removeIPFromBlacklist(ip)

			return c.json({ success: true })
		})

		this.app.get('/blacklist/account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			return c.json(this.getAccountBlacklist())
		})

		this.app.put('/blacklist/account/:account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			this.addAccountToBlacklist(account)

			return c.json({ success: true })
		})

		this.app.delete('/blacklist/account/:account', async c => {
			const authError = this.getAdminAuthError(c.req.raw, env)
			if (authError) {
				return c.json({ error: authError.message }, authError.status)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			this.removeAccountFromBlacklist(account)

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

			CREATE TABLE IF NOT EXISTS ip_blacklist (
				ip TEXT PRIMARY KEY,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS account_blacklist (
				account TEXT PRIMARY KEY,
				created_at INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS admin_settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`)
	}

	async init(env: Bindings) {
		const walletState = this.getWalletState()
		this.replaceWallet(env, walletState)
		if (!walletState) {
			this.wallet.sync()
		}
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

	getFaucetConfig(): FaucetConfig {
		const config = {
			minDropAmount: this.getNanoAmountSetting(
				FAUCET_CONFIG_SETTING_KEYS.minDropAmount,
				DEFAULT_FAUCET_CONFIG.minDropAmount,
			),
			maxDropAmount: this.getNanoAmountSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropAmount,
				DEFAULT_FAUCET_CONFIG.maxDropAmount,
			),
			divideBalanceBy: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.divideBalanceBy,
				DEFAULT_FAUCET_CONFIG.divideBalanceBy,
				1,
			),
			periodDays: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.periodDays,
				DEFAULT_FAUCET_CONFIG.periodDays,
				MIN_PERIOD_DAYS,
				MAX_PERIOD_DAYS,
			),
			maxDropPerIpSimultaneously: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropPerIpSimultaneously,
				DEFAULT_FAUCET_CONFIG.maxDropPerIpSimultaneously,
				1,
			),
			maxDropsPerAccount: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropsPerAccount,
				DEFAULT_FAUCET_CONFIG.maxDropsPerAccount,
				0,
			),
			maxDropsPerIp: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropsPerIp,
				DEFAULT_FAUCET_CONFIG.maxDropsPerIp,
				0,
			),
			maxDropsPerProxyIp: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropsPerProxyIp,
				DEFAULT_FAUCET_CONFIG.maxDropsPerProxyIp,
				0,
			),
			maxDropsPerIpInLimitedCountry: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.maxDropsPerIpInLimitedCountry,
				DEFAULT_FAUCET_CONFIG.maxDropsPerIpInLimitedCountry,
				0,
			),
			verificationRequiredByDefault: this.getBooleanSetting(
				FAUCET_CONFIG_SETTING_KEYS.verificationRequiredByDefault,
				DEFAULT_FAUCET_CONFIG.verificationRequiredByDefault,
			),
			verifyWhenProxy: this.getBooleanSetting(
				FAUCET_CONFIG_SETTING_KEYS.verifyWhenProxy,
				DEFAULT_FAUCET_CONFIG.verifyWhenProxy,
			),
			banProxies: this.getBooleanSetting(
				FAUCET_CONFIG_SETTING_KEYS.banProxies,
				DEFAULT_FAUCET_CONFIG.banProxies,
			),
			proxyAmountDivideBy: this.getIntegerSetting(
				FAUCET_CONFIG_SETTING_KEYS.proxyAmountDivideBy,
				DEFAULT_FAUCET_CONFIG.proxyAmountDivideBy,
				1,
			),
			limitedCountries: this.getStringArraySetting(
				FAUCET_CONFIG_SETTING_KEYS.limitedCountries,
				DEFAULT_FAUCET_CONFIG.limitedCountries,
				this.isValidCountryCode,
			),
		}

		return {
			...config,
			periodMs: config.periodDays * MILLISECONDS_PER_DAY,
		}
	}

	getEnvWalletNetworkConfig(env: Bindings): WalletNetworkConfig {
		return {
			rpcUrls: this.parseUrlList(env.DEFAULT_RPC_URLS),
			workerUrls: this.parseUrlList(env.DEFAULT_WORKER_URLS),
			representative: env.DEFAULT_REPRESENTATIVE.trim(),
		}
	}

	getWalletNetworkConfig(env: Bindings): WalletNetworkConfig {
		const fallback = this.getEnvWalletNetworkConfig(env)

		return {
			rpcUrls: this.getUrlListSetting(
				WALLET_NETWORK_CONFIG_SETTING_KEYS.rpcUrls,
				fallback.rpcUrls,
			),
			workerUrls: this.getUrlListSetting(
				WALLET_NETWORK_CONFIG_SETTING_KEYS.workerUrls,
				fallback.workerUrls,
			),
			representative: this.getRepresentativeSetting(
				WALLET_NETWORK_CONFIG_SETTING_KEYS.representative,
				fallback.representative,
			),
		}
	}

	parseWalletNetworkConfigPayload(
		payload: unknown,
	): WalletNetworkConfigParseResult {
		const input =
			payload && typeof payload === 'object'
				? (payload as Record<string, unknown>)
				: null

		if (!input) {
			return { error: 'Invalid network config' }
		}

		const rpcUrls = this.parseUrlListInput(input.rpcUrls, 'rpcUrls')
		if ('error' in rpcUrls) return rpcUrls

		const workerUrls = this.parseUrlListInput(input.workerUrls, 'workerUrls')
		if ('error' in workerUrls) return workerUrls

		const representative =
			typeof input.representative === 'string'
				? input.representative.trim()
				: ''

		if (!checkAddress(representative)) {
			return { error: 'Invalid representative' }
		}

		return {
			config: {
				rpcUrls: rpcUrls.value,
				workerUrls: workerUrls.value,
				representative: formatNanoAddress(representative),
			},
		}
	}

	parseFaucetConfigPayload(payload: unknown): FaucetConfigParseResult {
		const input =
			payload && typeof payload === 'object'
				? (payload as Record<string, unknown>)
				: null

		if (!input) {
			return { error: 'Invalid config' }
		}

		const minDropAmount = this.parsePositiveNanoInput(
			input.minDropAmount,
			'minDropAmount',
		)
		if ('error' in minDropAmount) return minDropAmount

		const maxDropAmount = this.parsePositiveNanoInput(
			input.maxDropAmount,
			'maxDropAmount',
		)
		if ('error' in maxDropAmount) return maxDropAmount

		const minDropAmountRaw = convert(minDropAmount.value, {
			from: Unit.NANO,
			to: Unit.raw,
		})
		const maxDropAmountRaw = convert(maxDropAmount.value, {
			from: Unit.NANO,
			to: Unit.raw,
		})
		if (TunedBigNumber(maxDropAmountRaw).isLessThan(minDropAmountRaw)) {
			return { error: 'maxDropAmount must be greater than minDropAmount' }
		}

		const divideBalanceBy = this.parseIntegerInput(
			input.divideBalanceBy,
			'divideBalanceBy',
			1,
		)
		if ('error' in divideBalanceBy) return divideBalanceBy

		const periodDays = this.parseIntegerInput(
			input.periodDays,
			'periodDays',
			MIN_PERIOD_DAYS,
			MAX_PERIOD_DAYS,
		)
		if ('error' in periodDays) return periodDays

		const maxDropPerIpSimultaneously = this.parseIntegerInput(
			input.maxDropPerIpSimultaneously,
			'maxDropPerIpSimultaneously',
			1,
		)
		if ('error' in maxDropPerIpSimultaneously) {
			return maxDropPerIpSimultaneously
		}

		const maxDropsPerAccount = this.parseIntegerInput(
			input.maxDropsPerAccount,
			'maxDropsPerAccount',
			0,
		)
		if ('error' in maxDropsPerAccount) return maxDropsPerAccount

		const maxDropsPerIp = this.parseIntegerInput(
			input.maxDropsPerIp,
			'maxDropsPerIp',
			0,
		)
		if ('error' in maxDropsPerIp) return maxDropsPerIp

		const maxDropsPerProxyIp = this.parseIntegerInput(
			input.maxDropsPerProxyIp,
			'maxDropsPerProxyIp',
			0,
		)
		if ('error' in maxDropsPerProxyIp) return maxDropsPerProxyIp

		const maxDropsPerIpInLimitedCountry = this.parseIntegerInput(
			input.maxDropsPerIpInLimitedCountry,
			'maxDropsPerIpInLimitedCountry',
			0,
		)
		if ('error' in maxDropsPerIpInLimitedCountry) {
			return maxDropsPerIpInLimitedCountry
		}

		const verificationRequiredByDefault = this.parseBooleanInput(
			input.verificationRequiredByDefault,
			'verificationRequiredByDefault',
		)
		if ('error' in verificationRequiredByDefault) {
			return verificationRequiredByDefault
		}

		const verifyWhenProxy = this.parseBooleanInput(
			input.verifyWhenProxy,
			'verifyWhenProxy',
		)
		if ('error' in verifyWhenProxy) {
			return verifyWhenProxy
		}

		const banProxies = this.parseBooleanInput(input.banProxies, 'banProxies')
		if ('error' in banProxies) {
			return banProxies
		}

		const proxyAmountDivideBy = this.parseIntegerInput(
			input.proxyAmountDivideBy,
			'proxyAmountDivideBy',
			1,
		)
		if ('error' in proxyAmountDivideBy) {
			return proxyAmountDivideBy
		}

		const limitedCountries =
			input.limitedCountries === undefined
				? { value: this.getFaucetConfig().limitedCountries }
				: this.parseCountryCodesInput(
						input.limitedCountries,
						'limitedCountries',
					)
		if ('error' in limitedCountries) {
			return limitedCountries
		}

		return {
			config: {
				minDropAmount: minDropAmount.value,
				maxDropAmount: maxDropAmount.value,
				divideBalanceBy: divideBalanceBy.value,
				periodDays: periodDays.value,
				maxDropPerIpSimultaneously: maxDropPerIpSimultaneously.value,
				maxDropsPerAccount: maxDropsPerAccount.value,
				maxDropsPerIp: maxDropsPerIp.value,
				maxDropsPerProxyIp: maxDropsPerProxyIp.value,
				maxDropsPerIpInLimitedCountry: maxDropsPerIpInLimitedCountry.value,
				verificationRequiredByDefault: verificationRequiredByDefault.value,
				verifyWhenProxy: verifyWhenProxy.value,
				banProxies: banProxies.value,
				proxyAmountDivideBy: proxyAmountDivideBy.value,
				limitedCountries: limitedCountries.value,
			},
		}
	}

	setFaucetConfig(config: FaucetConfigValues) {
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.minDropAmount,
			config.minDropAmount,
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropAmount,
			config.maxDropAmount,
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.divideBalanceBy,
			String(config.divideBalanceBy),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.periodDays,
			String(config.periodDays),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropPerIpSimultaneously,
			String(config.maxDropPerIpSimultaneously),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropsPerAccount,
			String(config.maxDropsPerAccount),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropsPerIp,
			String(config.maxDropsPerIp),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropsPerProxyIp,
			String(config.maxDropsPerProxyIp),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.maxDropsPerIpInLimitedCountry,
			String(config.maxDropsPerIpInLimitedCountry),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.verificationRequiredByDefault,
			String(config.verificationRequiredByDefault),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.verifyWhenProxy,
			String(config.verifyWhenProxy),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.banProxies,
			String(config.banProxies),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.proxyAmountDivideBy,
			String(config.proxyAmountDivideBy),
		)
		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.limitedCountries,
			JSON.stringify(config.limitedCountries),
		)
	}

	setWalletNetworkConfig(config: WalletNetworkConfig, env: Bindings) {
		this.setAdminSetting(
			WALLET_NETWORK_CONFIG_SETTING_KEYS.rpcUrls,
			JSON.stringify(config.rpcUrls),
		)
		this.setAdminSetting(
			WALLET_NETWORK_CONFIG_SETTING_KEYS.workerUrls,
			JSON.stringify(config.workerUrls),
		)
		this.setAdminSetting(
			WALLET_NETWORK_CONFIG_SETTING_KEYS.representative,
			config.representative,
		)
		this.replaceWallet(env, this.wallet.state)
	}

	replaceWallet(env: Bindings, walletState: NanoWalletState | null) {
		if (this.wallet) {
			this.wallet.unsubscribe(this.persistWalletState)
		}

		this.wallet = this.createWallet(
			this.getWalletNetworkConfig(env),
			env,
			walletState,
		)
		this.wallet.configure({
			minAmountRaw: this.getMinReceivableAmountRaw(),
		})
		this.wallet.subscribe(this.persistWalletState)
	}

	createWallet(
		config: WalletNetworkConfig,
		env: Bindings,
		state?: NanoWalletState | null,
	) {
		return new NanoWallet(
			{
				rpcUrls: config.rpcUrls,
				workerUrls: config.workerUrls,
				privateKey: env.PRIVATE_KEY,
				representative: config.representative,
				debug: env.DEBUG === 'true',
				timeout: 30000,
			},
			state,
		)
	}

	getWalletProofOfWorkStatus(): WalletProofOfWorkStatus {
		const { frontier, work } = this.wallet.state
		if (!frontier || !work || work.hash !== frontier) {
			return 'pending'
		}

		return 'cached'
	}

	getAdminSettingValue(key: string) {
		const row = this.sql
			.exec<AdminSettingRow>(
				'SELECT value FROM admin_settings WHERE key = ?',
				key,
			)
			.next()

		return row.done ? null : row.value.value
	}

	setAdminSetting(key: string, value: string) {
		this.sql.exec(
			`
				INSERT INTO admin_settings (key, value, updated_at)
				VALUES (?, ?, ?)
				ON CONFLICT(key) DO UPDATE SET
					value = excluded.value,
					updated_at = excluded.updated_at
			`,
			key,
			value,
			Date.now(),
		)
	}

	getNanoAmountSetting(key: string, fallback: string) {
		const value = this.getAdminSettingValue(key)
		if (value && this.isValidPositiveNanoAmount(value)) {
			return value
		}

		return fallback
	}

	getIntegerSetting(
		key: string,
		fallback: number,
		min: number,
		max = Number.MAX_SAFE_INTEGER,
	) {
		const value = this.getAdminSettingValue(key)
		if (value === null) {
			return fallback
		}

		if (!/^-?\d+$/.test(value.trim())) {
			return fallback
		}

		const numberValue = Number(value)

		if (
			Number.isSafeInteger(numberValue) &&
			numberValue >= min &&
			numberValue <= max
		) {
			return numberValue
		}

		return fallback
	}

	getBooleanSetting(key: string, fallback: boolean) {
		const value = this.getAdminSettingValue(key)
		if (value === null) {
			return fallback
		}

		if (value === 'true') return true
		if (value === 'false') return false

		return fallback
	}

	getStringArraySetting(
		key: string,
		fallback: string[],
		isValid: (value: string) => boolean,
	) {
		const value = this.getAdminSettingValue(key)
		if (value === null) {
			return fallback
		}

		try {
			const parsed = JSON.parse(value) as unknown
			if (
				Array.isArray(parsed) &&
				parsed.every(item => typeof item === 'string' && isValid(item))
			) {
				return Array.from(new Set(parsed as string[]))
			}
		} catch {}

		return fallback
	}

	getUrlListSetting(key: string, fallback: string[]) {
		const value = this.getAdminSettingValue(key)
		if (value === null) {
			return fallback
		}

		try {
			const parsed = JSON.parse(value) as unknown
			const urls = this.parseUrlListInput(parsed, key)
			if ('value' in urls) {
				return urls.value
			}
		} catch {}

		return fallback
	}

	getRepresentativeSetting(key: string, fallback: string) {
		const value = this.getAdminSettingValue(key)
		if (value && checkAddress(value)) {
			return formatNanoAddress(value)
		}

		return fallback
	}

	parseUrlList(value: unknown) {
		const items = Array.isArray(value)
			? value
			: typeof value === 'string'
				? value.split(/[,\n]+/)
				: []

		return Array.from(
			new Set(
				items
					.map(item => (typeof item === 'string' ? item.trim() : ''))
					.filter(Boolean),
			),
		)
	}

	parseUrlListInput(value: unknown, field: string): StringArrayParseResult {
		const urls = this.parseUrlList(value)

		if (urls.length === 0) {
			return { error: `Invalid ${field}` }
		}

		for (const url of urls) {
			if (!this.isValidHttpUrl(url)) {
				return { error: `Invalid ${field}` }
			}
		}

		return { value: urls }
	}

	isValidHttpUrl(value: string) {
		try {
			const url = new URL(value)
			return url.protocol === 'http:' || url.protocol === 'https:'
		} catch {
			return false
		}
	}

	parsePositiveNanoInput(value: unknown, field: string): StringParseResult {
		const amount =
			typeof value === 'number'
				? value.toString()
				: typeof value === 'string'
					? value.trim()
					: ''

		if (!this.isValidPositiveNanoAmount(amount)) {
			return { error: `Invalid ${field}` }
		}

		return { value: amount }
	}

	parseIntegerInput(
		value: unknown,
		field: string,
		min: number,
		max = Number.MAX_SAFE_INTEGER,
	): NumberParseResult {
		const numberValue =
			typeof value === 'number'
				? value
				: typeof value === 'string'
					? Number(value.trim())
					: NaN
		const isIntegerString =
			typeof value === 'string' && /^-?\d+$/.test(value.trim())

		if (
			!Number.isSafeInteger(numberValue) ||
			(typeof value === 'string' && !isIntegerString) ||
			numberValue < min ||
			numberValue > max
		) {
			return { error: `Invalid ${field}` }
		}

		return { value: numberValue }
	}

	parseBooleanInput(value: unknown, field: string): BooleanParseResult {
		if (typeof value === 'boolean') {
			return { value }
		}

		if (typeof value === 'string') {
			const normalized = value.trim()
			if (normalized === 'true') return { value: true }
			if (normalized === 'false') return { value: false }
		}

		return { error: `Invalid ${field}` }
	}

	parseCountryCodesInput(
		value: unknown,
		field: string,
	): StringArrayParseResult {
		if (!Array.isArray(value)) {
			return { error: `Invalid ${field}` }
		}

		const countries = value.map(country =>
			typeof country === 'string' ? country.trim().toUpperCase() : '',
		)

		if (countries.some(country => !this.isValidCountryCode(country))) {
			return { error: `Invalid ${field}` }
		}

		return { value: Array.from(new Set(countries)) }
	}

	isValidCountryCode(countryCode: string) {
		return /^[A-Z]{2}$/.test(countryCode)
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
		const value = this.getAdminSettingValue(
			FAUCET_CONFIG_SETTING_KEYS.minReceivableAmountRaw,
		)

		if (value) {
			return value
		}

		return convert(DEFAULT_FAUCET_CONFIG.minReceivableAmount, {
			from: Unit.NANO,
			to: Unit.raw,
		})
	}

	async setMinReceivableAmount(minReceivableAmount: string) {
		const minReceivableAmountRaw = convert(minReceivableAmount, {
			from: Unit.NANO,
			to: Unit.raw,
		})

		this.setAdminSetting(
			FAUCET_CONFIG_SETTING_KEYS.minReceivableAmountRaw,
			minReceivableAmountRaw,
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

	isValidPositiveNanoAmount(amount: string) {
		try {
			if (
				amount.length === 0 ||
				!TunedBigNumber(amount).isFinite() ||
				!TunedBigNumber(amount).isGreaterThan(0)
			) {
				return false
			}

			const rawAmount = convert(amount, { from: Unit.NANO, to: Unit.raw })
			return TunedBigNumber(rawAmount).isGreaterThan(0)
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

		const config = this.getFaucetConfig()

		if (this.ipIsBlacklisted(ip)) {
			throw new HTTPException(403, { message: 'This IP is blocked' })
		}

		if (account && this.accountIsBlacklisted(account)) {
			throw new HTTPException(403, { message: 'This account is blocked' })
		}

		const [dropsCount, ipInfo] = await this.db.batch<Record<string, any>>([
			this.db
				.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE ip = ?1 AND timestamp >= ?2',
				)
				.bind(ip, Date.now() - config.periodMs),
			this.db.prepare('SELECT is_proxy FROM ip_info WHERE ip = ?1').bind(ip),
		])

		const count = dropsCount.results
			? (dropsCount.results[0].count as number)
			: 0
		const limitedByCountry = config.limitedCountries.includes(countryCode)

		if (
			(count >= config.maxDropsPerIp ||
				(limitedByCountry && count >= config.maxDropsPerIpInLimitedCountry)) &&
			(!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV) &&
			!this.ipIsWhitelisted(ip)
		) {
			throw new HTTPException(403, {
				message: 'Drop limit reached for your IP',
			})
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

		if (canBeProxy && config.banProxies) {
			throw new HTTPException(403, { message: 'Proxies are not allowed' })
		}

		if (canBeProxy && count >= config.maxDropsPerProxyIp) {
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
					.bind(account, Date.now() - config.periodMs)
					.all<CountRow>()
				const accountDropsCount = results?.[0]?.count || 0

				if (accountDropsCount >= config.maxDropsPerAccount) {
					throw new HTTPException(403, {
						message: 'Limit reached for this account',
					})
				}
			}
		}

		const defaultAmount = this.getDropAmount(config)
		if (defaultAmount === '0') {
			throw new HTTPException(500, { message: 'Insufficient balance' })
		}

		const amount = canBeProxy
			? TunedBigNumber(defaultAmount)
					.dividedBy(config.proxyAmountDivideBy)
					.toString(10)
			: defaultAmount
		const amountNano = convert(amount, { from: Unit.raw, to: Unit.NANO })
		const verificationRequired =
			config.verificationRequiredByDefault ||
			(canBeProxy && config.verifyWhenProxy)

		return { ip, amount, amountNano, verificationRequired }
	}

	getDropAmount(config = this.getFaucetConfig()) {
		const balance = this.wallet.balance
		const min = convert(config.minDropAmount, {
			from: Unit.NANO,
			to: Unit.raw,
		})
		const max = convert(config.maxDropAmount, {
			from: Unit.NANO,
			to: Unit.raw,
		})

		if (TunedBigNumber(balance).isLessThan(min)) return '0'

		const amount = TunedBigNumber(balance)
			.dividedBy(config.divideBalanceBy)
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
		await this.db
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
			)
			.run()
	}

	async enqueueIPDrop(ip: string): Promise<() => void> {
		let promises = this.ipDropQueue.get(ip)
		if (!promises) {
			promises = new Set<Promise<void>>()
			this.ipDropQueue.set(ip, promises)
		}

		if (promises.size >= this.getFaucetConfig().maxDropPerIpSimultaneously) {
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

	getIPBlacklist() {
		return this.sql
			.exec<IPBlacklistRow>(
				'SELECT ip FROM ip_blacklist ORDER BY created_at ASC, ip ASC',
			)
			.toArray()
			.map(({ ip }) => ip)
	}

	ipIsBlacklisted(ip: string) {
		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM ip_blacklist WHERE ip = ?',
				ip,
			)
			.one()

		return row.count > 0
	}

	addIPToBlacklist(ip: string) {
		this.sql.exec(
			'INSERT OR IGNORE INTO ip_blacklist (ip, created_at) VALUES (?, ?)',
			ip,
			Date.now(),
		)
	}

	removeIPFromBlacklist(ip: string) {
		this.sql.exec('DELETE FROM ip_blacklist WHERE ip = ?', ip)
	}

	getAccountBlacklist() {
		return this.sql
			.exec<AccountBlacklistRow>(
				'SELECT account FROM account_blacklist ORDER BY created_at ASC, account ASC',
			)
			.toArray()
			.map(({ account }) => account)
	}

	accountIsBlacklisted(account: string) {
		const row = this.sql
			.exec<CountRow>(
				'SELECT COUNT(*) as count FROM account_blacklist WHERE account = ?',
				account,
			)
			.one()

		return row.count > 0
	}

	addAccountToBlacklist(account: string) {
		this.sql.exec(
			'INSERT OR IGNORE INTO account_blacklist (account, created_at) VALUES (?, ?)',
			account,
			Date.now(),
		)
	}

	removeAccountFromBlacklist(account: string) {
		this.sql.exec('DELETE FROM account_blacklist WHERE account = ?', account)
	}

	async getAdminAnalytics() {
		const now = Date.now()
		const oneDayAgo = now - 1000 * 60 * 60 * 24
		const sevenDaysAgo = now - 1000 * 60 * 60 * 24 * 7
		const fourteenDaysAgo = now - 1000 * 60 * 60 * 24 * 14

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
				SELECT hash, account, amount, drops.ip, took, timestamp, ip_info.country_code, ip_info.is_proxy
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
		const ipBlacklistCount = this.sql
			.exec<CountRow>('SELECT COUNT(*) as count FROM ip_blacklist')
			.one().count
		const accountBlacklistCount = this.sql
			.exec<CountRow>('SELECT COUNT(*) as count FROM account_blacklist')
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
				proofOfWork: this.getWalletProofOfWorkStatus(),
			},
			adminState: {
				ipWhitelistCount,
				accountWhitelistCount,
				ipBlacklistCount,
				accountBlacklistCount,
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
