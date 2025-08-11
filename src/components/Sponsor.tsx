import Link from 'next/link'

export function Sponsor() {
	return (
		<section className="flex border-t md:border-t-0 border-slate-200 dark:border-zinc-900 py-4 justify-center">
			<p className="text-xs">
				Sponsor:{' '}
				<Link
					href="https://nanswap.com/swap/BTC/XNO?r=nanodrop"
					className="text-nano"
				>
					Nanswap - Buy & Sell Nano with +400 cryptos
				</Link>
			</p>
		</section>
	)
}
