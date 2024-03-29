'use client'

import AddressInput from '@/components/AddressInput'
import CheckBox from '@/components/Checkbox'
import Hero from '@/components/Hero'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
	const [nanoAddress, setNanoAddress] = useState<string | null>(null)

	return (
		<div className="flex flex-col flex-1 justify-center w-full max-w-5xl">
			<h1 className="sr-only">Nano Faucet</h1>
			<section className="flex flex-col w-full flex-1 justify-center items-center py-8 px-4">
				<div className="w-full flex flex-col items-center justify-between gap-8">
					<div className="flex flex-col justify-center">
						<Hero />
					</div>
					<div className="w-[580px] max-w-full">
						<AddressInput
							onReset={() => setNanoAddress(null)}
							onValidAddress={setNanoAddress}
							onInvalidAddress={() => setNanoAddress(null)}
							onSubmit={e => {
								e.preventDefault()
								e.stopPropagation()
							}}
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
			<div className="flex flex-col items-center border-t md:border-t-0 border-slate-200 dark:border-zinc-900 py-4 md:flex-row md:gap-4 justify-center">
				<p className="text-xs">Sponsored by Nanswap:</p>
				<p className="text-xs">
					<Link
						href="https://nanswap.com/swap/BTC/XNO?r=nanodrop"
						className="text-nano"
					>
						Buy & Sell Nano with +400 cryptos
					</Link>
				</p>
			</div>
		</div>
	)
}
