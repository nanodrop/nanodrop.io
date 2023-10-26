import { MetadataRoute } from 'next'

const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL as string).origin

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
			disallow: [],
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
	}
}
