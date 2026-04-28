export type Bindings = {
	__DEV__: string
	NANODROP_DO: DurableObjectNamespace
	NANODROP_DB: D1Database
	RPC_URLS: string
	WORKER_URLS: string
	PRIVATE_KEY: string
	REPRESENTATIVE: string
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
