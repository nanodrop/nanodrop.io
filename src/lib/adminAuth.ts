export const ADMIN_SESSION_COOKIE = 'nanodrop_admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12

const encoder = new TextEncoder()

const toBase64Url = (buffer: ArrayBuffer) => {
	const bytes = new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i])
	}

	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '')
}

export const safeEqual = (left: string, right: string) => {
	if (left.length !== right.length) return false

	let mismatch = 0
	for (let i = 0; i < left.length; i += 1) {
		mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
	}

	return mismatch === 0
}

const signPayload = async (payload: string, token: string) => {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(token),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	)
	const signature = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(payload),
	)

	return toBase64Url(signature)
}

export const isAdminTokenValue = (candidate: string, adminToken: string) => {
	if (!adminToken) return false

	return safeEqual(candidate.trim(), adminToken)
}

export const createAdminSessionValue = async (adminToken: string) => {
	if (!adminToken) {
		throw new Error('ADMIN_TOKEN is not configured')
	}

	const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000
	const nonce = crypto.randomUUID()
	const payload = `${expiresAt}.${nonce}`
	const signature = await signPayload(payload, adminToken)

	return `${payload}.${signature}`
}

export const verifyAdminSessionValue = async (
	value: string | undefined,
	adminToken: string,
) => {
	if (!value || !adminToken) return false

	const [expiresAtValue, nonce, signature] = value.split('.')
	if (!expiresAtValue || !nonce || !signature) return false

	const expiresAt = Number(expiresAtValue)
	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false

	const payload = `${expiresAtValue}.${nonce}`
	const expectedSignature = await signPayload(payload, adminToken)

	return safeEqual(signature, expectedSignature)
}
