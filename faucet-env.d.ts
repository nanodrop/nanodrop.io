interface CloudflareEnv {
	__DEV__: string
	NANODROP_DO: DurableObjectNamespace
	COINMARKETCAP_DO: DurableObjectNamespace
	NANODROP_DB: D1Database
	CMC_PRO_API_KEY?: string
	RPC_URLS: string
	WORKER_URLS: string
	PRIVATE_KEY: string
	REPRESENTATIVE: string
	ADMIN_TOKEN: string
	HCAPTCHA_SECRET?: string
	ALLOW_ORIGIN?: string
	DEBUG: string
}
