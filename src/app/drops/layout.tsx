import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
	title: 'Drop List',
	description: 'Faucet transaction history with visualization by country.',
}

export default function DropsLayout({ children }: { children: ReactNode }) {
	return (
		<div
			className="w-full max-w-6xl 2xl:max-w-none overflow-y-hidden flex flex-col"
			style={{
				height: 'calc(100vh - 60px)',
			}}
		>
			<h1 className="sr-only">Drop List</h1>
			{children}
		</div>
	)
}
