import { revalidateTag } from 'next/cache'
import { ZodError, z } from 'zod'

export interface LatestPriceValues {
	usd: number
	usd_24h_change: number
}

const schema = z.object({
	usd: z.number(),
	usd_24h_change: z.number(),
})

export const getLatestPrice = async (
	coinId: string,
	revalidate = false,
): Promise<LatestPriceValues> => {
	coinId = coinId.toLowerCase()

	if (revalidate) {
		revalidateTag('xno-price')
	}

	const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`

	const before = Date.now()

	const response = await fetch(url, {
		headers: { 'Accept-Encoding': 'gzip,deflate,compress' },
		next: {
			revalidate: 10, // 5 minutes
			tags: ['xno-price'],
		},
	})

	if (!response.ok) {
		throw new Error(`coingecko status error: ${response.statusText}`)
	}

	const after = Date.now()

	console.log(`Took ${after - before}ms to fetch price`)

	const data = await response.json()

	try {
		const { usd, usd_24h_change } = schema.parse(data[coinId])
		return {
			usd,
			usd_24h_change,
		}
	} catch (error) {
		if (error instanceof ZodError) {
			console.error('Invalid response from coingecko:', error.message)
		}
		throw new Error(`Invalid response from coingecko`)
	}
}
