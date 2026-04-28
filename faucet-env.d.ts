interface CloudflareEnv {
	__DEV__: string
	FAUCET_DO: DurableObjectNamespace
	FAUCET_DB: D1Database
	RPC_URLS: string
	WORKER_URLS: string
	PRIVATE_KEY: string
	REPRESENTATIVE: string
	ADMIN_TOKEN: string
	HCAPTCHA_SECRET?: string
	ALLOW_ORIGIN?: string
	DEBUG: string
	NEXT_INC_CACHE_R2_PREFIX?: string
}
