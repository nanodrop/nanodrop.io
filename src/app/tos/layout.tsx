import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Terms of Service',
	description: 'Nanodrop Terms of Use and Privacy Policy',
}

export default function TosLayout({ children }: { children: ReactNode }) {
	return children
}
