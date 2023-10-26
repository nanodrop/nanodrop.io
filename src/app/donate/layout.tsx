import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Donate | NanoDrop Faucet',
	description: 'Contribute to Nanodrop by making a donation in Nano.',
}

export default function DonateLayout({ children }: { children: ReactNode }) {
	return children
}
