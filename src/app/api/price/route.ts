import { getLatestPrice } from '@/services/coinmarketcap'

export const runtime = 'edge'

const COIN_ID = 1567

export async function GET() {
	try {
		const { price, percent_change_24h } = await getLatestPrice(COIN_ID)
		return new Response(
			JSON.stringify(
				{
					price,
					percent_change_24h,
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
