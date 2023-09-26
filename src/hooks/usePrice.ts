import useSWR from 'swr'
import fetcher from '@/lib/fetcher'
import { LatestPriceValues } from '@/services/coingecko'

const limit2Decimals = (value: number) => Math.floor(value * 100) / 100

export default function usePrice() {
	const { data, error, isLoading } = useSWR<LatestPriceValues>(
		'/api/price',
		fetcher,
	)

	return {
		usd: data ? limit2Decimals(data.usd) : null,
		usd_24h_change: data?.usd_24h_change ?? null,
		error: (error as string) || null,
		isLoading,
	}
}
