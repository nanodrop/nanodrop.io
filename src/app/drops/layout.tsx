import { ReactNode } from 'react'

export default function DropsLayout({ children }: { children: ReactNode }) {
	return (
		<div
			className="w-full max-w-6xl 2xl:max-w-none overflow-y-hidden flex flex-col"
			style={{
				height: 'calc(100vh - 60px)',
			}}
		>
			{children}
		</div>
	)
}
