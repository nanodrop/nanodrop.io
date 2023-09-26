import useSWR from 'swr'
import fetcher from '@/lib/fetcher'
import { API_URL } from '@/config'

export interface Drop {
	hash: string
	account: string
	amount: string
	took: number
	timestamp: number
	country: string
	is_proxy: boolean
}

export default function useListDrops() {
	console.log(`${API_URL}/drops`)

	const { data, error, isLoading, mutate, isValidating } = useSWR<Drop[]>(
		`${API_URL}/drops`,
		fetcher,
	)

	console.log({ data, error: error?.message })

	return {
		drops: data,
		error: error as string | null,
		isLoading,
		refresh: () => mutate(),
		isRefreshing: !isLoading && isValidating,
	}
}
