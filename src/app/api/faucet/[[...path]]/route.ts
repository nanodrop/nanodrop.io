import { NextRequest, NextResponse } from 'next/server'

const DEV_FAUCET_ORIGIN = 'http://127.0.0.1:8787'
const RESPONSE_HEADERS_TO_DROP = [
	'content-encoding',
	'content-length',
	'transfer-encoding',
	'connection',
	'keep-alive',
]

type RouteContext = {
	params: Promise<{
		path?: string[]
	}>
}

const proxyRequest = async (
	request: NextRequest,
	{ params }: RouteContext,
): Promise<Response> => {
	if (process.env.NODE_ENV !== 'development') {
		return NextResponse.json({ error: 'Not found' }, { status: 404 })
	}

	const { path = [] } = await params
	const pathname = path.length > 0 ? `/${path.join('/')}` : ''
	const targetUrl = new URL(
		`${pathname}${request.nextUrl.search}`,
		DEV_FAUCET_ORIGIN,
	)

	const headers = new Headers(request.headers)
	headers.set('host', targetUrl.host)
	headers.set('accept-encoding', 'identity')

	const upstreamResponse = await fetch(targetUrl, {
		method: request.method,
		headers,
		body:
			request.method === 'GET' || request.method === 'HEAD'
				? undefined
				: await request.arrayBuffer(),
		redirect: 'manual',
	})

	const responseHeaders = new Headers(upstreamResponse.headers)
	for (const headerName of RESPONSE_HEADERS_TO_DROP) {
		responseHeaders.delete(headerName)
	}

	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders,
	})
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
export const OPTIONS = proxyRequest
export const HEAD = proxyRequest
