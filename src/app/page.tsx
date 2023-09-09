'use client'

import AddressInput from '@/components/AddressInput'
import CheckBox from '@/components/Checkbox'
import Hero from '@/components/Hero'
import { ArrowSmallRightIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
	const [nanoAddress, setNanoAddress] = useState<string | null>(null)
	return (
		<>
			<section className="w-full flex  font-extralight py-4 divide-x divide-slate-200 sm:justify-between uppercase text-slate-500 text-sm sm:text-xl">
				<div className="flex flex-col sm:flex-row justify-center flex-wrap flex-1 text-center sm:space-x-2">
					<span className="whitespace-nowrap">XNO PRICE:</span>{' '}
					<span className="whitespace-nowrap">0.67 USD</span>
				</div>
				<div className="flex flex-col sm:flex-row flex-1 sm:space-x-2 flex-wrap justify-center text-center">
					<span>204.023</span>
					<span>DROPS</span>
				</div>
				<div className="flex flex-1 flex-col sm:flex-row justify-center text-center">
					<Link
						href="#"
						className="flex space-x-2 items-center hover:text-sky-600 font-extralight"
					>
						<span>Block Explorer</span>
						<ArrowSmallRightIcon className="w-5 h-5" />
					</Link>
				</div>
			</section>
			<section className="flex flex-col flex-1 justify-center items-center py-8">
				<Hero />
				<div className="w-96 sm:w-[448px] max-w-full px-4 py-4 sm:py-8">
					<AddressInput
						onValidAddress={setNanoAddress}
						onInvalidAddress={() => setNanoAddress(null)}
						onSubmit={console.log}
					/>
					<div className="w-full flex justify-center mt-2 sm:mt-4">
						<CheckBox nanoAddress={nanoAddress || undefined} />
					</div>
				</div>
			</section>
			{/* <LinksSection /> */}
		</>
	)
}
