import useSWR from 'swr'
import fetcher from '@/lib/fetcher'
import { LatestPrice } from '@/services/coinmarketcap'

const limit2Decimals = (value: number) => Math.floor(value * 100) / 100

export default function usePrice() {
	const { data, error, isLoading } = useSWR<LatestPrice>('/api/price', fetcher)

	return {
		price: data ? limit2Decimals(data.price) : null,
		percent_change_24h: data?.percent_change_24h ?? null,
		error: (error as string) || null,
		isLoading,
	}
}
