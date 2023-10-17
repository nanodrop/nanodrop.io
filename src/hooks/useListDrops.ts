import useSWRInfinite from 'swr/infinite'
import fetcher from '@/lib/fetcher'
import { API_URL } from '@/config'

export interface Drop {
	hash: string
	account: string
	amount: string
	took: number
	timestamp: number
	country_code: string
	is_proxy: boolean
}

export interface UseListDropsProps {
	limit?: number
}

export default function useListDrops({ limit = 50 }: UseListDropsProps = {}) {
	const getKey = (pageIndex: number, previousPageData: Drop[]) => {
		if (previousPageData && !previousPageData.length) return null // reached the end
		return `${API_URL}/drops?limit=${limit}&offset=${
			pageIndex * limit
		}&orderBy=desc`
	}

	const { data, error, isLoading, mutate, isValidating, size, setSize } =
		useSWRInfinite<Drop[]>(getKey, fetcher)

	const hasMore = data?.[data.length - 1].length === limit

	const drops = data ? ([] as Drop[]).concat(...data) : []

	return {
		drops,
		error: error as string | null,
		isLoading,
		refresh: () => mutate(),
		isRefreshing: !isLoading && isValidating,
		hasMore,
		loadMore: () => setSize(size + 1),
	}
}
