import { getLatestPrice } from '@/services/coingecko'

export const runtime = 'edge'

const COIN_ID = 'nano'

export async function GET() {
	try {
		const { usd, usd_24h_change } = await getLatestPrice(COIN_ID)
		return new Response(
			JSON.stringify(
				{
					usd,
					usd_24h_change,
				},
				null,
				2,
			),
		)
	} catch (error) {
		const message = error instanceof Error ? error.message : 'unknown error'
		return new Response(
			JSON.stringify(
				{
					error: message,
				},
				null,
				2,
			),
		)
	}
}
