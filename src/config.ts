export const DARK_MODE_BY_DEFAULT = false

const DEFAULT_SITE_URL = 'https://nanodrop.io'

function resolveSiteUrl() {
	const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
	const siteUrl = configuredSiteUrl || DEFAULT_SITE_URL

	try {
		return new URL(siteUrl).origin
	} catch {
		throw new Error(
			`NEXT_PUBLIC_SITE_URL must be an absolute URL. Received: ${siteUrl}`,
		)
	}
}

export const SOCIALS = {
	github: 'https://github.com/nanodrop/nanodrop.io',
	discord: 'https://chat.nano.org/',
	reddit: 'https://www.reddit.com/r/nanocurrency/',
}

export const CONTACT_EMAIL = 'hello@nanodrop.io'

export const API_URL = '/api'

export const SITE_URL = resolveSiteUrl()
