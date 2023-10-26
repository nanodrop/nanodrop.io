import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Donate',
	description:
		'Support NanoDrop.io by making a donation in Nano. Your contributions help us maintain a fee-less, instant, and scalable Nano cryptocurrency faucet.',
}

export default function DonateLayout({ children }: { children: ReactNode }) {
	return children
}
