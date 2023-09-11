import { Montserrat } from 'next/font/google'
import Link from 'next/link'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

export default function Hero() {
	return (
		<div className="text-center">
			<h1
				className={`flex ${montserrat.className} font-light text-4xl sm:text-5xl uppercase text-nano`}
			>
				Nano Ӿ Faucet
			</h1>
			<h4
				className={`${montserrat.className} font-normal text-sm text-slate-500 mt-4`}
			>
				205.343 Drops!{' '}
				<Link
					href={
						'https://www.nanolooker.com/account/nano_3dropio1aj6yttxeqf7wm16u3eofx7kkcff5ytcy9m11zxh3uj6r9k5yussb'
					}
					className="text-sky-500"
					target="_blank"
				>
					Explore Transactions
				</Link>
			</h4>
		</div>
	)
}
