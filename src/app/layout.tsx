import './globals.css'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/Footer'
import Appbar from '@/components/Appbar'
import clsx from 'clsx'
import { PreferencesProvider } from '@/contexts/PreferencesProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: {
		default: 'Nano Faucet | NanoDrop.io',
		template: '%s | NanoDrop.io',
	},
	description:
		'Welcome to NanoDrop.io, a clean, easy, fast, and open-source faucet for Nano. Get start with Nano now and experience a fee-less, instant, and scalable cryptocurrency.',
	viewport:
		'width=device-width, initial-scale=1, user-scalable=0, viewport-fit=cover',
	themeColor: [
		{
			color: '#209ce9',
			media: '(prefers-color-scheme: light)',
		},
		{
			color: '#101217',
			media: '(prefers-color-scheme: dark)',
		},
	],
	applicationName: 'Nanodrop.io',
	keywords: [
		'nano',
		'xno',
		'nanocurrency',
		'cryptocurrency',
		'faucet',
		'free',
		'wallet',
		'open source',
	],
	authors: {
		url: 'https://github.com/anarkrypto',
		name: 'anarkrypto',
	},
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body
				className={clsx(
					inter.className,
					'bg-white dark:bg-midnight-1 text-slate-800 dark:text-zinc-500',
				)}
			>
				<PreferencesProvider>
					<div className="min-h-screen flex flex-col">
						<Appbar />
						<main className="flex flex-col flex-1 items-center">
							{children}
						</main>
						<Footer />
					</div>
				</PreferencesProvider>
			</body>
		</html>
	)
}
