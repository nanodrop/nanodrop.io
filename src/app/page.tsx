'use client'

import AddressInput from '@/components/AddressInput'
import CheckBox from '@/components/Checkbox'
import Hero from '@/components/Hero'
import LinksSection from '@/components/LinksSection'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
	const [nanoAddress, setNanoAddress] = useState<string | null>(null)
	return (
		<>
			<section className="w-full flex flex-col font-light py-6 divide-x divide-slate-200 sm:justify-between uppercase text-slate-500 text-sm sm:text-xl bg-white">
				<div className="flex justify-center px-4 flex-wrap flex-1 text-center space-x-2">
					<div className="whitespace-nowrap py-1 px-2 border border-slate-100 bg-slate-50 rounded">
						1 XNO = 0.67 USD
					</div>
				</div>
			</section>
			<section className="flex flex-col w-full flex-1 justify-center items-center py-8 bg-white">
				<div className="w-full flex flex-col items-center justify-between gap-8">
					<div className="flex flex-col justify-center pb-4">
						<Hero />
					</div>
					<div className="w-full sm:w-[448px] max-w-full px-4">
						<AddressInput
							onValidAddress={setNanoAddress}
							onInvalidAddress={() => setNanoAddress(null)}
							onSubmit={console.log}
						/>
					</div>
					<div className="w-full flex justify-center">
						<CheckBox nanoAddress={nanoAddress || undefined} />
					</div>
					<p className="text-xs text-slate-500 text-center">
						By submitting, you accept the{' '}
						<Link href="/tos" className="text-sky-500">
							Terms of Service
						</Link>
					</p>
				</div>
			</section>

			<LinksSection />
		</>
	)
}
