import { NextRequest, NextResponse } from 'next/server'

import {
	ADMIN_SESSION_TTL_SECONDS,
	clearAdminSessionCookie,
	hasAdminSession,
	isAdminToken,
	setAdminSessionCookie,
} from '../_auth'

type LoginPayload = {
	token?: unknown
}

export const GET = async () => {
	const authenticated = await hasAdminSession()

	return NextResponse.json({
		authenticated,
		expiresIn: authenticated ? ADMIN_SESSION_TTL_SECONDS : 0,
	})
}

export const POST = async (request: NextRequest) => {
	const payload = (await request
		.json()
		.catch(() => null)) as LoginPayload | null
	const token = typeof payload?.token === 'string' ? payload.token : ''

	if (!isAdminToken(token)) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const response = NextResponse.json({
		authenticated: true,
		expiresIn: ADMIN_SESSION_TTL_SECONDS,
	})
	await setAdminSessionCookie(response)

	return response
}

export const DELETE = async () => {
	const response = NextResponse.json({ authenticated: false })
	clearAdminSessionCookie(response)

	return response
}
