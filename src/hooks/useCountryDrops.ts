import fetcher from '@/lib/fetcher'
import { API_URL } from '@/config'
import useSWR from 'swr'

export type CountriesDrop = Record<string, number>

export default function useCountryDrop() {
	const { data, error, isLoading } = useSWR<CountriesDrop>(
		`${API_URL}/drops/countries`,
		fetcher,
	)

	return {
		data,
		error: (error as string) || null,
		isLoading,
	}
}
