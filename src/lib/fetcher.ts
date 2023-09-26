const fetcher = async (url: string) => {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`status error: ${response.statusText}`)
	}
	const data = await response.json()
	return data
}

export default fetcher
