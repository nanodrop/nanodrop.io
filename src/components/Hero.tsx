import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

export default function Hero() {
	return (
		<div className="text-center">
			<h1
				className={`flex ${montserrat.className} font-light sm:font-extralight text-4xl sm:text-5xl uppercase text-[#209CE9]`}
			>
				Nano Ӿ Faucet
			</h1>
			<h4
				className={`${montserrat.className} font-light text-sm text-slate-500`}
			>
				Start with Nano currency!
			</h4>
		</div>
	)
}
