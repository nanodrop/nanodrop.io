import { Hono } from 'hono'
import { deriveAddress, derivePublicKey } from 'nanocurrency'

import { errorHandler } from './middlewares'
import { CoinMarketCapDO } from './coinmarketcap'
import { NanoDropDO } from './nanodrop'
import type { Bindings } from './types'

export { NanoDropDO } from './nanodrop'
export { CoinMarketCapDO } from './coinmarketcap'

const app = new Hono<{ Bindings: Bindings }>().onError(errorHandler)

const getAllowedCorsOrigin = (request: Request) => new URL(request.url).origin

app.options('*', c => {
	return new Response('', {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': getAllowedCorsOrigin(c.req.raw),
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	})
})

app.get('/api/price', async c => {
	const id = c.env.COINMARKETCAP_DO.idFromName(
		`coinmarketcap-${CoinMarketCapDO.version}`,
	)
	const obj = c.env.COINMARKETCAP_DO.get(id)

	return obj.fetch(new Request(c.req.url, c.req.raw))
})

app.use('*', async c => {
	const publicKey = derivePublicKey(c.env.PRIVATE_KEY)
	const account = deriveAddress(publicKey)

	const id = c.env.NANODROP_DO.idFromName(
		`nanodrop-${NanoDropDO.version}-${account}`,
	)

	const obj = c.env.NANODROP_DO.get(id)

	const response = await obj.fetch(new Request(c.req.url, c.req.raw))

	const headers = new Headers(response.headers)
	headers.set('Access-Control-Allow-Origin', getAllowedCorsOrigin(c.req.raw))

	return new Response(response.body, {
		status: response.status,
		headers,
	})
})

const faucetHandler = {
	fetch: app.fetch,
}

export default faucetHandler
