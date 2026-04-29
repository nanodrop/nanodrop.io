import { MetadataRoute } from 'next'
import { SITE_URL } from '@/config'

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
