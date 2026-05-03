import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
	ADMIN_SESSION_COOKIE,
	ADMIN_SESSION_TTL_SECONDS,
	createAdminSessionValue as createSignedAdminSessionValue,
	isAdminTokenValue,
	verifyAdminSessionValue as verifySignedAdminSessionValue,
} from '@/lib/adminAuth'

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS }

const getAdminToken = () => process.env.ADMIN_TOKEN?.trim() || ''

export const isAdminToken = (candidate: string) => {
	return isAdminTokenValue(candidate, getAdminToken())
}

export const createAdminSessionValue = async () => {
	return createSignedAdminSessionValue(getAdminToken())
}

export const verifyAdminSessionValue = async (value?: string) => {
	return verifySignedAdminSessionValue(value, getAdminToken())
}

export const hasAdminSession = async () => {
	const cookieStore = await cookies()
	const session = cookieStore.get(ADMIN_SESSION_COOKIE)

	return verifyAdminSessionValue(session?.value)
}

export const setAdminSessionCookie = async (response: NextResponse) => {
	const sessionValue = await createAdminSessionValue()

	response.cookies.set({
		name: ADMIN_SESSION_COOKIE,
		value: sessionValue,
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: ADMIN_SESSION_TTL_SECONDS,
	})
}

export const clearAdminSessionCookie = (response: NextResponse) => {
	response.cookies.set({
		name: ADMIN_SESSION_COOKIE,
		value: '',
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 0,
	})
}
