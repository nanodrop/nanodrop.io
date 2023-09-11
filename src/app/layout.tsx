import './globals.css'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/Footer'
import Appbar from '@/components/Appbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'NanoDrop Faucet',
	description: 'Open Source Nano Faucet',
	viewport:
		'width=device-width, initial-scale=1, user-scalable=0, viewport-fit=cover',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body className={inter.className}>
				<div className="min-h-screen flex flex-col">
					<Appbar />
					<main className="flex flex-col flex-1 items-center bg-slate-100 sm:bg-white">
						<div className="flex flex-col flex-1 justify-center w-full max-w-5xl">
							{children}
						</div>
					</main>
					<Footer />
				</div>
			</body>
		</html>
	)
}
