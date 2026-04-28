import BigNumber from 'bignumber.js'

export const TunedBigNumber = BigNumber.clone({
	EXPONENTIAL_AT: 1e9,
	DECIMAL_PLACES: 36,
})

export const isValidIPv4OrIpv6 = (ip: string) => {
	return ip.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) ||
		ip.match(/^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i)
		? true
		: false
}

export const formatNanoAddress = (address: string) => {
	return address.replace('xrb_', 'nano_')
}
