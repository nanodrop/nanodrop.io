import { ReactNode } from 'react'

export default function DropsLayout({ children }: { children: ReactNode }) {
	return <div className="w-full max-w-7xl p-4">{children}</div>
}
