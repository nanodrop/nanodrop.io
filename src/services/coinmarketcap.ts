import { revalidateTag } from 'next/cache'
import { ZodError, z } from 'zod'

const CACHE_TIME = 10 * 5 // 5 minutes

export interface LatestPrice {
	price: number
	percent_change_24h: number
}

const quoteSchema = z.object({
	price: z.number(),
	percent_change_24h: z.number(),
})

export const getLatestPrice = async (
	coinId: string | number,
	convert: string = 'USD',
	revalidate = false,
): Promise<LatestPrice> => {
	coinId = coinId.toString()

	if (revalidate) {
		revalidateTag('xno-price')
	}

	const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=${coinId}&convert=${convert}`

	const response = await fetch(url, {
		headers: {
			'X-CMC_PRO_API_KEY': process.env.CMC_PRO_API_KEY || '',
			'Accept-Encoding': 'gzip,deflate,compress',
			Accept: 'application/json',
		},
		next: {
			revalidate: CACHE_TIME,
			tags: [`price-${coinId}-${convert}`],
		},
	})

	if (!response.ok) {
		throw new Error(`coinmarketcap status error: ${response.statusText}`)
	}

	const body = await response.json()

	try {
		const { price, percent_change_24h } = quoteSchema.parse(
			body?.data?.[coinId]?.quote?.[convert],
		)
		return {
			price,
			percent_change_24h,
		}
	} catch (error) {
		if (error instanceof ZodError) {
			console.error('Invalid response from coinmarketcap:', error.message)
		}
		throw new Error(`Invalid response from coinmarketcap`)
	}
}
