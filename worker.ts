import apiWorker, { CoinMarketCapDO, NanoDropDO } from './src/api'

const FAUCET_PREFIX = '/api/faucet'
const PRICE_PATH = '/api/price'

type OpenNextWorkerModule = {
	default: {
		fetch: NonNullable<ExportedHandler<CloudflareEnv>['fetch']>
	}
}

let openNextWorkerPromise: Promise<OpenNextWorkerModule> | undefined

const loadOpenNextWorker = () => {
	if (!openNextWorkerPromise) {
		// @ts-ignore `.open-next/worker.js` is generated at build time
		openNextWorkerPromise = import('./.open-next/worker.js')
	}

	return openNextWorkerPromise
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)
		if (
			url.pathname === FAUCET_PREFIX ||
			url.pathname.startsWith(`${FAUCET_PREFIX}/`)
		) {
			const rewrittenUrl = new URL(request.url)
			rewrittenUrl.pathname = url.pathname.slice(FAUCET_PREFIX.length) || '/'

			return apiWorker.fetch(new Request(rewrittenUrl, request), env, ctx)
		}

		if (url.pathname === PRICE_PATH) {
			return apiWorker.fetch(request, env, ctx)
		}

		const { default: openNextWorker } = await loadOpenNextWorker()
		return openNextWorker.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<CloudflareEnv>

export { NanoDropDO }
export { CoinMarketCapDO }
