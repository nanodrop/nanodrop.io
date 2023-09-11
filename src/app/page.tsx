'use client'

import AddressInput from '@/components/AddressInput'
import CheckBox from '@/components/Checkbox'
import Hero from '@/components/Hero'
import LinksSection from '@/components/LinksSection'
import { useState } from 'react'

export default function Home() {
	const [nanoAddress, setNanoAddress] = useState<string | null>(null)
	return (
		<>
			<section className="w-full flex flex-col font-light py-6 divide-x divide-slate-200 sm:justify-between uppercase text-slate-500 text-sm sm:text-xl bg-white">
				<div className="flex justify-center px-4 flex-wrap flex-1 text-center space-x-2">
					<div className="whitespace-nowrap py-1 px-2 border border-slate-100 rounded">
						1 XNO = 0.67 USD
					</div>
				</div>
			</section>
			<section className="flex flex-col flex-1 justify-center items-center py-8 bg-white">
				<div className="flex flex-col flex-1 max-h-[400px] items-center justify-between">
					<div className="flex flex-1 flex-col justify-center">
						<Hero />
					</div>
					<div className="flex flex-1 flex-col justify-center">
						<div className="w-96 sm:w-[448px] max-w-full px-4 py-4 sm:py-8">
							<AddressInput
								onValidAddress={setNanoAddress}
								onInvalidAddress={() => setNanoAddress(null)}
								onSubmit={console.log}
							/>
						</div>
						<div className="w-full flex justify-center py-4">
							<CheckBox nanoAddress={nanoAddress || undefined} />
						</div>
					</div>
				</div>
			</section>

			<LinksSection />
		</>
	)
}
