import { getLatestPrice } from '@/services/coinmarketcap'

export async function PriceTicker() {
	const { price } = await getLatestPrice(1567, 'USD')

	return (
		<div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base hidden sm:block">
				1 XNO = US$ {price}
			</div>
			<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base sm:hidden">
				1Ӿ = ${price}
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
