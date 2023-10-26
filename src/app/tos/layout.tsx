import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Terms of Service | NanoDrop Faucet',
	description: 'Nanodrop Termise of Use and Privacy Policy',
}

export default function TosLayout({ children }: { children: ReactNode }) {
	return children
}
