import apiWorker, { CoinMarketCapDO, NanoDropDO } from './src/api'
import {
	ADMIN_SESSION_COOKIE,
	verifyAdminSessionValue,
} from './src/lib/adminAuth'

const ADMIN_PREFIX = '/api/admin'
const ADMIN_SESSION_PREFIX = '/api/admin/session'
const PUBLIC_API_PREFIX = '/api'
const PRICE_PATH = '/api/price'
const PUBLIC_API_PATHS = new Set([
	'/status',
	'/drop',
	'/drops',
	'/drops/countries',
	'/wallet',
])

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

const isPathWithinPrefix = (pathname: string, prefix: string) => {
	return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

const getCookieValue = (cookieHeader: string | null, cookieName: string) => {
	if (!cookieHeader) return undefined

	for (const cookie of cookieHeader.split(';')) {
		const [name, ...valueParts] = cookie.trim().split('=')
		if (name === cookieName) return valueParts.join('=')
	}

	return undefined
}

const rewriteRequestPath = (request: Request, pathname: string) => {
	const rewrittenUrl = new URL(request.url)
	rewrittenUrl.pathname = pathname

	return new Request(rewrittenUrl, request)
}

const resolvePublicApiPath = (pathname: string) => {
	if (!isPathWithinPrefix(pathname, PUBLIC_API_PREFIX)) return null

	const apiPath = pathname.slice(PUBLIC_API_PREFIX.length) || '/'
	if (!PUBLIC_API_PATHS.has(apiPath)) return null

	return apiPath
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)

		if (
			isPathWithinPrefix(url.pathname, ADMIN_PREFIX) &&
			!isPathWithinPrefix(url.pathname, ADMIN_SESSION_PREFIX)
		) {
			const adminToken = env.ADMIN_TOKEN?.trim()
			if (!adminToken) {
				return Response.json(
					{ error: 'ADMIN_TOKEN is not configured' },
					{ status: 500 },
				)
			}

			const session = getCookieValue(
				request.headers.get('cookie'),
				ADMIN_SESSION_COOKIE,
			)
			if (!(await verifyAdminSessionValue(session, adminToken))) {
				return Response.json({ error: 'Unauthorized' }, { status: 401 })
			}

			const pathname = url.pathname.slice(ADMIN_PREFIX.length)
			const apiRequest = rewriteRequestPath(request, `/admin${pathname || ''}`)
			apiRequest.headers.set('authorization', `Bearer ${adminToken}`)

			return apiWorker.fetch(apiRequest, env, ctx)
		}

		const publicApiPath = resolvePublicApiPath(url.pathname)
		if (publicApiPath) {
			return apiWorker.fetch(
				rewriteRequestPath(request, publicApiPath),
				env,
				ctx,
			)
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
