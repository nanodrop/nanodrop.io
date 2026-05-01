import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError, z } from 'zod'

import { errorHandler } from './middlewares'
import type { Bindings } from './types'
import type { LatestPrice } from '../types/price'

const DEFAULT_COIN_ID = '1567'
const DEFAULT_CONVERT = 'USD'
const CACHE_TIME = 1000 * 60 * 5

type PriceCacheRow = {
	[key: string]: SqlStorageValue
	price: number
	percent_change_24h: number
	fetched_at: number
}

const quoteSchema = z.object({
	price: z.number(),
	percent_change_24h: z.number(),
})

const normalizeCoinId = (value: string | null) => {
	const coinId = value?.trim() || DEFAULT_COIN_ID
	if (!/^\d+$/.test(coinId)) {
		throw new HTTPException(400, { message: 'Invalid coin id' })
	}
	return coinId
}

const normalizeConvert = (value: string | null) => {
	const convert = (value?.trim() || DEFAULT_CONVERT).toUpperCase()
	if (!/^[A-Z0-9]{2,12}$/.test(convert)) {
		throw new HTTPException(400, { message: 'Invalid convert currency' })
	}
	return convert
}

const cacheKeyFor = (coinId: string, convert: string) => `${coinId}:${convert}`

export class CoinMarketCapDO extends DurableObject<Bindings> {
	app = new Hono<{ Bindings: Bindings }>().onError(errorHandler)
	sql: SqlStorage
	static version = 'v1.0.0'

	constructor(state: DurableObjectState, env: Bindings) {
		super(state, env)
		this.sql = state.storage.sql

		state.blockConcurrencyWhile(async () => {
			this.initSqlSchema()
		})

		this.app.get('/api/price', async c => {
			const url = new URL(c.req.url)
			const coinId = normalizeCoinId(
				url.searchParams.get('coinId') || url.searchParams.get('id'),
			)
			const convert = normalizeConvert(url.searchParams.get('convert'))

			const price = await this.getLatestPrice(coinId, convert)
			c.header('Cache-Control', 'no-store')

			return c.json(price)
		})
	}

	initSqlSchema() {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS price_cache (
				cache_key TEXT PRIMARY KEY,
				coin_id TEXT NOT NULL,
				convert TEXT NOT NULL,
				price REAL NOT NULL,
				percent_change_24h REAL NOT NULL,
				fetched_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS price_cache_fetched_at_index
				ON price_cache(fetched_at);
		`)
	}

	async getLatestPrice(
		coinId = DEFAULT_COIN_ID,
		convert = DEFAULT_CONVERT,
	): Promise<LatestPrice> {
		const cacheKey = cacheKeyFor(coinId, convert)
		const cached = this.getCachedPrice(cacheKey)
		const now = Date.now()

		if (cached && now - cached.fetched_at < CACHE_TIME) {
			return {
				price: cached.price,
				percent_change_24h: cached.percent_change_24h,
			}
		}

		try {
			const latest = await this.fetchLatestPrice(coinId, convert)
			this.saveCachedPrice(cacheKey, coinId, convert, latest, now)
			return latest
		} catch (error) {
			if (cached) {
				console.error('Failed refreshing CoinMarketCap price:', error)
				return {
					price: cached.price,
					percent_change_24h: cached.percent_change_24h,
				}
			}

			throw error
		}
	}

	getCachedPrice(cacheKey: string) {
		const row = this.sql
			.exec<PriceCacheRow>(
				`
					SELECT price, percent_change_24h, fetched_at
					FROM price_cache
					WHERE cache_key = ?
				`,
				cacheKey,
			)
			.next()

		return row.done ? null : row.value
	}

	saveCachedPrice(
		cacheKey: string,
		coinId: string,
		convert: string,
		price: LatestPrice,
		fetchedAt: number,
	) {
		this.sql.exec(
			`
				INSERT INTO price_cache (
					cache_key,
					coin_id,
					convert,
					price,
					percent_change_24h,
					fetched_at
				)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(cache_key) DO UPDATE SET
					coin_id = excluded.coin_id,
					convert = excluded.convert,
					price = excluded.price,
					percent_change_24h = excluded.percent_change_24h,
					fetched_at = excluded.fetched_at
			`,
			cacheKey,
			coinId,
			convert,
			price.price,
			price.percent_change_24h,
			fetchedAt,
		)
	}

	async fetchLatestPrice(
		coinId = DEFAULT_COIN_ID,
		convert = DEFAULT_CONVERT,
	): Promise<LatestPrice> {
		if (!this.env.CMC_PRO_API_KEY) {
			throw new HTTPException(500, {
				message: 'CoinMarketCap API key is missing',
			})
		}

		const url = new URL(
			'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest',
		)
		url.searchParams.set('id', coinId)
		url.searchParams.set('convert', convert)

		const response = await fetch(url, {
			headers: {
				'X-CMC_PRO_API_KEY': this.env.CMC_PRO_API_KEY,
				Accept: 'application/json',
			},
		})

		if (!response.ok) {
			throw new HTTPException(502, {
				message: `CoinMarketCap status error: ${response.statusText}`,
			})
		}

		const body = (await response.json()) as {
			data?: Record<string, { quote?: Record<string, unknown> }>
		}

		try {
			const { price, percent_change_24h } = quoteSchema.parse(
				body?.data?.[coinId]?.quote?.[convert],
			)

			return { price, percent_change_24h }
		} catch (error) {
			if (error instanceof ZodError) {
				console.error('Invalid response from CoinMarketCap:', error.message)
			}

			throw new HTTPException(502, {
				message: 'Invalid response from CoinMarketCap',
			})
		}
	}

	fetch(request: Request) {
		return this.app.fetch(request)
	}
}
