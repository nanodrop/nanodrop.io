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

export class NanoDropDO extends DurableObject<Bindings> {
	app = new Hono<{ Bindings: Bindings }>().onError(errorHandler)
	wallet: NanoWallet
	storage: DurableObjectStorage
	static version = 'v1.0.0'
	db: D1Database
	ipTicketQueue = new Map<string, Set<Promise<void>>>()
	isDev: boolean

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env)
		this.isDev = env.__DEV__ === 'true'
		this.storage = state.storage
		this.db = env.FAUCET_DB
		this.wallet = new NanoWallet({
			rpcUrls: env.RPC_URLS.split(','),
			workerUrls: env.WORKER_URLS.split(','),
			privateKey: env.PRIVATE_KEY,
			representative: env.REPRESENTATIVE,
			debug: env.DEBUG === 'true',
			timeout: 30000,
		})

		state.blockConcurrencyWhile(async () => {
			await this.init()
		})

		this.app.get('/ticket', async c => {
			if (
				env.ALLOW_ORIGIN &&
				new URL(env.ALLOW_ORIGIN).origin !== c.req.header('origin')
			) {
				return c.json({ error: 'Origin mismatch' }, 400)
			}

			const ip = this.isDev ? '127.0.0.1' : c.req.header('x-real-ip')
			if (!ip) {
				return c.json({ error: 'IP header is missing' }, 400)
			}

			const countryCode = this.isDev ? '??' : c.req.header('cf-ipcountry')
			const origin = c.req.header('origin') || 'Unknown'

			if (origin.includes('api.nanodrop.io')) {
				return c.json({ error: 'Temporarily unavailable due spam' }, 403)
			}

			if (!countryCode) {
				return c.json({ error: 'Country header is missing' }, 400)
			}

			const [dropsCount, ipInfo] = await env.FAUCET_DB.batch<
				Record<string, any>
			>([
				env.FAUCET_DB.prepare(
					'SELECT COUNT(*) as count FROM drops WHERE ip = ?1 AND timestamp >= ?2',
				).bind(ip, Date.now() - PERIOD),
				env.FAUCET_DB.prepare(
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
				const ipWhitelist =
					(await this.storage.get<string[]>('ip-whitelist')) || []
				if (!ipWhitelist.includes(ip)) {
					return c.json({ error: 'Drop limit reached for your IP' }, 403)
				}
			}

			let canBeProxy = false

			if (!ipInfo.results?.length) {
				let proxyCheckedBy = 'none'

				if (!this.isDev) {
					try {
						canBeProxy = await this.checkProxy(ip)
						proxyCheckedBy = 'badip.xyz'
					} catch {
						console.error(`Failed checking IP ${ip}`)
					}
				}

				await env.FAUCET_DB.prepare(
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
					const realIp = c.req.header('x-real-ip')
					if (!realIp) {
						return c.json({ error: 'IP header is missing' }, 400)
					}
					if (realIp !== ip) {
						if (!realIp) {
							return c.json({ error: 'Ticket IP mismatch' }, 400)
						}
					}
				}

				const redeemedTicketHashes = await this.storage.get<
					Record<string, number>
				>('redeemed_ticket_hashes')

				if (redeemedTicketHashes) {
					const tickets = Object.keys(redeemedTicketHashes)
					if (tickets.includes(ticketHash)) {
						return c.json({ error: 'Ticket already redeemed' }, 403)
					}
				}

				const dequeue = await this.enqueueIPTicket(ip)

				try {
					if (!this.isDev || ENABLE_LIMIT_PER_IP_IN_DEV) {
						const ipIsInTmpBlacklist = await this.ipIsInTmpBlacklist(ip)
						if (ipIsInTmpBlacklist) {
							return c.json({ error: 'Limit reached for this IP' }, 403)
						}
					}

					const accountIsInTmpBlacklist =
						await this.accountIsInTmpBlacklist(account)

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
			const { results } = await env.FAUCET_DB.prepare(
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

			const ipWhitelist =
				(await this.storage.get<string[]>('ip-whitelist')) || []
			return c.json(ipWhitelist)
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

			const ipWhitelist =
				(await this.storage.get<string[]>('ip-whitelist')) || []
			if (!ipWhitelist.includes(ip)) {
				await this.storage.put('ip-whitelist', [...ipWhitelist, ip])
			}

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

			const ipWhitelist =
				(await this.storage.get<string[]>('ip-whitelist')) || []
			if (ipWhitelist.includes(ip)) {
				await this.storage.put(
					'ip-whitelist',
					ipWhitelist.filter(ipAddress => ipAddress !== ip),
				)
			}

			return c.json({ success: true })
		})

		this.app.get('/whitelist/account', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			const accountWhitelist =
				(await this.storage.get<string[]>('account-whitelist')) || []
			return c.json(accountWhitelist)
		})

		this.app.put('/whitelist/account/:account', async c => {
			if (c.req.header('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
				return c.json({ error: 'Unauthorized' }, 401)
			}

			if (!checkAddress(c.req.param('account'))) {
				return c.json({ error: 'Invalid account' }, 400)
			}

			const account = formatNanoAddress(c.req.param('account'))

			await this.removeAccountFromTmpBlacklist(account)

			const accountWhitelist =
				(await this.storage.get<string[]>('account-whitelist')) || []
			if (!accountWhitelist.includes(account)) {
				await this.storage.put('account-whitelist', [
					...accountWhitelist,
					account,
				])
			}

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

			const accountWhitelist =
				(await this.storage.get<string[]>('account-whitelist')) || []
			if (accountWhitelist.includes(account)) {
				await this.storage.put(
					'account-whitelist',
					accountWhitelist.filter(accountAddress => accountAddress !== account),
				)
			}

			return c.json({ success: true })
		})
	}

	async init() {
		const walletState = await this.storage.get<NanoWalletState>('wallet-state')
		if (walletState) {
			this.wallet.update(walletState)
		} else {
			this.wallet.sync()
		}

		this.wallet.subscribe(state => {
			this.storage.put('wallet-state', state)
		})
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

	async redeemTicket({ hash, expiresAt }: { hash: string; expiresAt: number }) {
		const redeemedTicketHashes = await this.storage.get<Record<string, number>>(
			'redeemed_ticket_hashes',
		)

		const now = Date.now()
		const nonExpiredTickets = Object.entries(redeemedTicketHashes || {}).filter(
			([, ticketExpiresAt]) => ticketExpiresAt > now,
		)

		await this.storage.put('redeemed_ticket_hashes', {
			...Object.fromEntries(nonExpiredTickets),
			[hash]: expiresAt,
		})
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
			const accountWhitelist =
				(await this.storage.get<string[]>('account-whitelist')) || []
			if (!accountWhitelist.includes(data.account)) {
				await this.addAccountToTmpBlacklist(data.account)
			}
		}

		const ipCount = ipCountResult.results
			? (ipCountResult.results[0].count as number)
			: 0

		if (ipCount + 1 >= MAX_DROPS_PER_IP) {
			const ipWhitelist =
				(await this.storage.get<string[]>('ip-whitelist')) || []
			if (!ipWhitelist.includes(data.ip)) {
				await this.addIPToTmpBlacklist(data.ip)
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

	async accountIsInTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		const blacklistedAccounts =
			(await this.storage.get<string[]>('temporary-account-blacklist')) || []

		if (blacklistedAccounts.includes(checksum)) return true
		return false
	}

	async addAccountToTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		const blacklistedAccounts =
			(await this.storage.get<string[]>('temporary-account-blacklist')) || []

		if (blacklistedAccounts.includes(checksum)) return
		if (blacklistedAccounts.length === MAX_TMP_ACCOUNT_BLACKLIST_LENGTH) {
			blacklistedAccounts.shift()
		}

		blacklistedAccounts.push(checksum)
		await this.storage.put('temporary-account-blacklist', blacklistedAccounts)
	}

	async removeAccountFromTmpBlacklist(account: string) {
		const checksum = account.slice(-8)
		const blacklistedAccounts =
			(await this.storage.get<string[]>('temporary-account-blacklist')) || []

		if (!blacklistedAccounts.includes(checksum)) return

		await this.storage.put(
			'temporary-account-blacklist',
			blacklistedAccounts.filter(a => a !== checksum),
		)
	}

	async ipIsInTmpBlacklist(ip: string): Promise<boolean> {
		const blacklistedIPs =
			(await this.storage.get<Record<string, number>>(
				'temporary-ip-blacklist',
			)) || {}

		if (blacklistedIPs[ip] < Date.now()) return true
		return false
	}

	async addIPToTmpBlacklist(ip: string) {
		const blacklistedIPs =
			(await this.storage.get<Record<string, number>>(
				'temporary-ip-blacklist',
			)) || {}

		const now = Date.now()
		const nonExpiredIPs = Object.entries(blacklistedIPs).filter(
			([, expiresAt]) => expiresAt > now,
		)
		const expiresAt = now + TICKET_EXPIRATION

		await this.storage.put('temporary-ip-blacklist', {
			...Object.fromEntries(nonExpiredIPs),
			[ip]: expiresAt,
		})
	}

	async removeIPFromTmpBlacklist(ip: string) {
		const blacklistedIPs =
			(await this.storage.get<Record<string, number>>(
				'temporary-ip-blacklist',
			)) || {}

		if (ip in blacklistedIPs) {
			delete blacklistedIPs[ip]
			await this.storage.put('temporary-ip-blacklist', blacklistedIPs)
		}
	}

	fetch(request: Request) {
		return this.app.fetch(request)
	}
}
