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

export interface Drops {
	total: number
	drops: Drop[]
}

export interface UseListDropsProps {
	limit?: number
}

export default function useListDrops({ limit = 50 }: UseListDropsProps = {}) {
	const getKey = (pageIndex: number, previousPageData: Drops) => {
		if (previousPageData && !hasMore) return null // reached the end
		return `${API_URL}/drops?limit=${limit}&offset=${
			pageIndex * limit
		}&orderBy=desc`
	}

	const {
		data = [],
		error,
		isLoading,
		mutate,
		isValidating,
		size,
		setSize,
	} = useSWRInfinite<Drops>(getKey, fetcher)

	const total = data[data.length - 1]?.total || 0

	const hasMore = data.length * limit <= total

	const drops = data.map(d => d.drops).flat()

	return {
		drops,
		total,
		error: error as string | null,
		isLoading,
		refresh: () => mutate(),
		isRefreshing: !isLoading && isValidating,
		hasMore,
		loadMore: () => setSize(size + 1),
	}
}
