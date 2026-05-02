import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Admin',
	description: 'NanoDrop admin dashboard.',
	robots: {
		index: false,
		follow: false,
	},
}

export default function AdminLayout({ children }: { children: ReactNode }) {
	return children
}
