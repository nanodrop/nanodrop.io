export type Bindings = {
	__DEV__: string
	NANODROP_DO: DurableObjectNamespace
	COINMARKETCAP_DO: DurableObjectNamespace
	NANODROP_DB: D1Database
	CMC_PRO_API_KEY?: string
	DEFAULT_RPC_URLS: string
	DEFAULT_WORKER_URLS: string
	PRIVATE_KEY: string
	DEFAULT_REPRESENTATIVE: string
	ADMIN_TOKEN: string
	HCAPTCHA_SECRET?: string
	ALLOW_ORIGIN?: string
	DEBUG: string
}

export interface DropData {
	hash: string
	account: string
	amount: string
	country: string
	timestamp: number
	took: number
	is_proxy: boolean
}
