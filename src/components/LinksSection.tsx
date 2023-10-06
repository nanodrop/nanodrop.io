import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

export default function LinksSection() {
	return (
		<section className="py-2 sm:py-6 px-4 grid grid-cols-1 sm:grid-cols-2 gap-1">
			<a
				href="https://hub.nano.org/wallets/open-source/75/allows-representative-changes/76/non-custodial/291"
				target="_blank"
				rel="noopener noreferrer"
			>
				<div className="w-full bg-white rounded-md p-3 border border-slate-200 hover:shadow">
					<h2
						className={`${inter.className} text-slate-600 font-medium uppercase text-sm sm:text-base`}
					>
						Wallets<span>-&gt;</span>
					</h2>
					<p
						className={`${inter.className} text-xs sm:text-sm text-slate-600 font-light`}
					>
						Choose your wallet and store your Nano (XNO) securely.
					</p>
				</div>
			</a>

			<a href="/donate" target="_blank" rel="noopener noreferrer">
				<div className="w-full bg-white rounded-md p-3 border border-slate-200 hover:shadow">
					<h2
						className={`${inter.className} text-slate-600 font-medium uppercase text-sm sm:text-base`}
					>
						Donate<span>-&gt;</span>
					</h2>
					<p
						className={`${inter.className} text-xs sm:text-sm text-slate-600 font-light`}
					>
						Help to maintain Nanodrop.
					</p>
				</div>
			</a>
		</section>
	)
}
