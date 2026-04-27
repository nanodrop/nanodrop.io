import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
	const response = NextResponse.next()
	response.headers.set('x-pathname', request.nextUrl.pathname)
	return response
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js)$).*)',
	],
}
