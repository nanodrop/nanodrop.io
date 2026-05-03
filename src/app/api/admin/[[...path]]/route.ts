import { NextRequest, NextResponse } from 'next/server'

import { hasAdminSession } from '../_auth'

const DEV_FAUCET_ORIGIN =
	process.env.WORKER_DEV_ORIGIN || 'http://127.0.0.1:8787'
const RESPONSE_HEADERS_TO_DROP = [
	'content-encoding',
	'content-length',
	'transfer-encoding',
	'connection',
	'keep-alive',
]
const REQUEST_HEADERS_TO_DROP = [
	'host',
	'cookie',
	'content-length',
	'connection',
	'keep-alive',
	'transfer-encoding',
]

type RouteContext = {
	params: Promise<{
		path?: string[]
	}>
}

const proxyAdminRequest = async (
	request: NextRequest,
	{ params }: RouteContext,
): Promise<Response> => {
	if (!(await hasAdminSession())) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const adminToken = process.env.ADMIN_TOKEN
	if (!adminToken) {
		return NextResponse.json(
			{ error: 'ADMIN_TOKEN is not configured' },
			{ status: 500 },
		)
	}

	const { path = [] } = await params
	const pathname =
		path.length > 0 ? `/${path.map(encodeURIComponent).join('/')}` : ''
	const targetUrl = new URL(
		`/admin${pathname}${request.nextUrl.search}`,
		DEV_FAUCET_ORIGIN,
	)

	const headers = new Headers(request.headers)
	for (const headerName of REQUEST_HEADERS_TO_DROP) {
		headers.delete(headerName)
	}
	headers.set('authorization', `Bearer ${adminToken}`)
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

export const GET = proxyAdminRequest
export const POST = proxyAdminRequest
export const PUT = proxyAdminRequest
export const PATCH = proxyAdminRequest
export const DELETE = proxyAdminRequest
export const OPTIONS = proxyAdminRequest
export const HEAD = proxyAdminRequest
