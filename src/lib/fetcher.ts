const fetcher = async (url: string) => {
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw response
		}
		const data = await response.json()
		return data
	} catch (error) {
		let message = 'Fetch error'
		if (error instanceof Response) {
			message = error.statusText
			try {
				const data = await error.json()
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
