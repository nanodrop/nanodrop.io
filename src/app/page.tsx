'use client'

import AddressInput from '@/components/AddressInput'
import CheckBox from '@/components/Checkbox'
import Hero from '@/components/Hero'
import LinksSection from '@/components/LinksSection'
import usePrice from '@/hooks/usePrice'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
	const [nanoAddress, setNanoAddress] = useState<string | null>(null)

	const { price, error: priceError, isLoading: priceIsLoading } = usePrice()

	return (
		<div className="flex flex-col flex-1 justify-center w-full max-w-5xl">
			<section className="flex flex-col w-full justify-center items-center py-8 bg-white">
				<div className="whitespace-nowrap py-1 px-2 border border-slate-100 bg-slate-50 rounded text-slate-500 text-sm sm:text-base">
					1 XNO ={' '}
					{priceError ? priceError : priceIsLoading ? '-- USD' : `${price} USD`}
				</div>
			</section>
			<section className="flex flex-col w-full flex-1 justify-center items-center py-8 bg-white">
				<div className="w-full flex flex-col items-center justify-between gap-8">
					<div className="flex flex-col justify-center">
						<Hero />
					</div>
					<div className="w-[580px] max-w-full px-4">
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
		</div>
	)
}
