import './globals.css'

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/Footer'
import Appbar from '@/components/Appbar'
import clsx from 'clsx'
import { PreferencesProvider } from '@/contexts/PreferencesProvider'
import ThemeProvider from '@/contexts/ThemeProvider'

const SITE_URL = new URL(process.env.NEXT_PUBLIC_SITE_URL as string).origin

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: {
		default: 'Nano Faucet | NanoDrop.io',
		template: '%s | NanoDrop.io',
	},
	description:
		'Welcome to NanoDrop.io - a clean, easy, fast and open-source faucet to get started with Nano (XNO): a fee-less, instant and scalable cryptocurrency.',
	applicationName: 'Nanodrop.io',
	authors: {
		url: 'https://github.com/anarkrypto',
		name: 'anarkrypto',
	},
	category: 'Cryptocurrency Faucet',
	openGraph: {
		title: 'NanoDrop.io | Free Nano (XNO) Cryptocurrency Faucet',
		description:
			'Welcome to NanoDrop.io - a clean, easy, fast and open-source faucet to get started with Nano (XNO): a fee-less, instant and scalable cryptocurrency.',
		url: `${SITE_URL}/`,
		siteName: 'NanoDrop.io',
		locale: 'en_US',
		type: 'website',
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
	alternates: {
		canonical: `${SITE_URL}/`,
		languages: {
			'en-US': `${SITE_URL}/`,
		},
	},
	metadataBase: new URL(SITE_URL),
}

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
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
					<ThemeProvider>
						<div className="min-h-screen flex flex-col">
							<Appbar />
							<main className="flex flex-col flex-1 items-center">
								{children}
							</main>
							<Footer />
						</div>
					</ThemeProvider>
				</PreferencesProvider>
			</body>
		</html>
	)
}
