interface FetcherErrorBody {
	error?: string
	message?: string
}

const fetcher = async <T>(url: string): Promise<T> => {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw response
		}
		const data = (await response.json()) as T & FetcherErrorBody
		if (typeof data.error === 'string') {
			throw new Error(data.error)
		}
		return data as T
	} catch (error) {
		let message = 'Fetch error'
		if (error instanceof Response) {
			message = error.statusText
			try {
				const data = (await error.json()) as FetcherErrorBody
				if (typeof data.error === 'string') {
					message = data.error
				} else if (typeof data.message === 'string') {
					message = data.message
				}
			} catch {}
		} else if (error instanceof DOMException) {
			message = 'Error parsing JSON'
		} else if (error instanceof Error) {
			message = error.message
		}
		throw message
	}
}

export default fetcher
