import { MetadataRoute } from 'next'

const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL as string).origin

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: `${SITE_URL}/`,
			lastModified: new Date(),
		},
		{
			url: `${SITE_URL}/drops`,
			lastModified: new Date(),
		},
		{
			url: `${SITE_URL}/donate`,
			lastModified: new Date(),
		},
		{
			url: `${SITE_URL}/tos`,
			lastModified: new Date(),
		},
	]
}
