import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

export default function LinksSection() {
	return (
		<section className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-6 py-3 sm:py-6 px-4">
			<a
				href="https://hub.nano.org/wallets"
				className="p-3 border border-slate-200 hover:shadow rounded-md"
				target="_blank"
				rel="noopener noreferrer"
			>
				<h2
					className={`${inter.className} text-slate-600 font-medium uppercase`}
				>
					Wallets<span>-&gt;</span>
				</h2>
				<p
					className={`${inter.className} text-xs sm:text-sm text-slate-600 font-light`}
				>
					Choose your wallet and store your Nano (XNO) securely.
				</p>
			</a>

			<a
				href="/donate"
				className="p-3 border border-slate-200 hover:shadow rounded-md"
				target="_blank"
				rel="noopener noreferrer"
			>
				<h2
					className={`${inter.className} text-slate-600 font-medium uppercase`}
				>
					Donate <span>-&gt;</span>
				</h2>
				<p
					className={`${inter.className} text-xs sm:text-sm text-slate-600 font-light`}
				>
					Help to mantain NanoDrop.
				</p>
			</a>

			<a
				href="/docs"
				className="p-3 border border-slate-200 hover:shadow rounded-md"
				target="_blank"
				rel="noopener noreferrer"
			>
				<h2
					className={`${inter.className} text-slate-600 font-medium uppercase`}
				>
					API <span>-&gt;</span>
				</h2>
				<p
					className={`${inter.className} text-xs sm:text-sm text-slate-600 font-light`}
				>
					Hey Devs, check our NanoDrop API.
				</p>
			</a>
		</section>
	)
}
