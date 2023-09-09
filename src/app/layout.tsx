import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/Footer'
import Appbar from '@/components/Appbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'NanoDrop Faucet',
	description: 'Open Source Nano Faucet',
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
					<main className="flex flex-col flex-1 items-center bg-white border-y border-slate-100">
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
