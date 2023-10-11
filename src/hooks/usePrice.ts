import useSWR from 'swr'
import fetcher from '@/lib/fetcher'
import { LatestPrice } from '@/services/coinmarketcap'

const formatPrice = (value: number): string => {
	const parts = value.toString().split('.')
	if (parts.length === 1) return parts[0]
	return `${parts[0]}.${parts[1].substring(0, 2).padEnd(2, '0')}`
}

export default function usePrice() {
	const { data, error, isLoading } = useSWR<LatestPrice>('/api/price', fetcher)

	return {
		price: data ? formatPrice(data.price) : null,
		percent_change_24h: data?.percent_change_24h ?? null,
		error: (error as string) || null,
		isLoading,
	}
}
