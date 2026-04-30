'use client'

import usePrice from '@/hooks/usePrice'

export function PriceTicker() {
	const { price, error, isLoading } = usePrice()
	const displayPrice = error ? 'ERROR' : isLoading || !price ? '--' : price

	return (
		<div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base hidden sm:block">
				1 XNO = US$ {displayPrice}
			</div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base sm:hidden">
				1Ӿ = ${displayPrice}
			</div>
		</div>
	)
}

export function PriceTickerLoading() {
	return (
		<div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base hidden sm:block">
				1 XNO = US$ --
			</div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base sm:hidden">
				1Ӿ = $--
			</div>
		</div>
	)
}
