import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import DropSVG from './DropSVG'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

export default function Hero() {
	return (
		<div className="text-center">
			<div
				className={`flex ${montserrat.className} font-light text-4xl sm:text-5xl lg:text-[52px] uppercase text-nano`}
			>
				Nano
				<DropSVG className="text-nano w-7 sm:w-10 lg:w-11 mx-1 sm:mx-2 h-auto" />
				Drop
			</div>
			<div
				className={`${montserrat.className} font-normal text-sm text-slate-500 mt-4`}
			>
				Free{' '}
				<Link href="https://nano.org" className="text-nano hover:underline">
					Nano cryptocurrency
				</Link>{' '}
				(XNO) Faucet
			</div>
		</div>
	)
}
