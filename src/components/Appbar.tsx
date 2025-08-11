'use client'

import usePrice from '@/hooks/usePrice'
import clsx from 'clsx'
import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DropSVG from '@/components/DropSVG'
import { ThemeToggle } from './ThemeToggle'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

const navigation = [
	{
		name: 'Donate',
		href: '/donate',
	},
	{
		name: 'Drops',
		href: '/drops',
	},
]

export interface AppbarProps {
	showLogo?: boolean
	showPrice?: boolean
}

export default function Appbar() {
	const { price, error: priceError, isLoading: priceIsLoading } = usePrice()

	const pathname = usePathname()

	const isHome = pathname === '/'

	if (priceError) {
		console.error('[ERROR] USE PRICE:', priceError)
	}

	return (
		<header
			className={clsx(
				'pt-safe w-full bg-nano sm:bg-transparent text-white sm:text-slate-500 dark:bg-transparent dark:text-zinc-400 sm:dark:text-zinc-500',
				!isHome && 'border-b border-slate-100 dark:border-zinc-800',
			)}
		>
			<div className="w-full flex justify-between items-center border-none px-4 sm:px-4 py-2">
				{!isHome && (
					<div>
						<Link href="/">
							<div
								className={`${montserrat.className} items-center font-light text-xl sm:text-2xl uppercase text-nano hidden sm:flex`}
							>
								<span>Nano</span>
								<span className="px-1">
									<DropSVG />
								</span>
								<span>Drop</span>
							</div>
							<DropSVG className="sm:hidden text-white dark:text-nano w-7 h-auto" />
						</Link>
					</div>
				)}
				{isHome && (
					<>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base hidden sm:block">
							1 XNO ={' '}
							{priceError
								? 'ERROR'
								: priceIsLoading
								? '-- USD'
								: `US$ ${price}`}
						</div>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base sm:hidden">
							1Ӿ ={' '}
							{priceError ? 'ERROR' : priceIsLoading ? '-- USD' : `$${price}`}
						</div>
					</>
				)}
				<div className="flex items-center gap-2 sm:gap-4 justify-end sm:w-auto">
					<nav className="flex justify-center gap-1 sm:gap-2 w-full sm:w-auto">
						{navigation.map(link => (
							<Link href={link.href} key={link.href}>
								<div
									className={clsx(
										'sm:hover:text-nano py-1 px-2',
										link.href === pathname &&
											'sm:text-nano border-b border-white sm:border-nano/40',
									)}
								>
									<h2 className="font-normal uppercase text-sm">{link.name}</h2>
								</div>
							</Link>
						))}
					</nav>
					<ThemeToggle />
				</div>
			</div>
		</header>
	)
}
