'use client'

import usePrice from '@/hooks/usePrice'
import { ButtonBase } from '@mui/material'
import clsx from 'clsx'
import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DropSVG from '@/components/DropSVG'
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'
import { usePreferences } from '@/contexts/PreferencesProvider'

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
	const { darkMode, toggleDarkMode } = usePreferences()

	const pathname = usePathname()

	const isHome = pathname === '/'

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
							<h1
								className={`${montserrat.className} items-center font-light text-xl sm:text-2xl uppercase text-nano hidden sm:flex`}
							>
								<span>Nano</span>
								<span className="px-1">
									<DropSVG />
								</span>
								<span>Drop</span>
							</h1>
							<DropSVG className="sm:hidden text-white dark:text-nano w-7 h-auto" />
						</Link>
					</div>
				)}
				{isHome && (
					<>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base hidden sm:block">
							1 XNO ={' '}
							{priceError
								? priceError
								: priceIsLoading
								? '-- USD'
								: `US$ ${price}`}
						</div>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 dark:border-zinc-800 rounded-full text-sm sm:text-base sm:hidden">
							1Ӿ ={' '}
							{priceError
								? priceError
								: priceIsLoading
								? '-- USD'
								: `$${price}`}
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
					<ButtonBase className="!rounded-full" onClick={toggleDarkMode}>
						<div className="flex text-sm items-center sm:gap-1 text-white sm:text-slate-500 hover:text-nano hover:border-nano sm:border sm:border-slate-300 sm:dark:border-zinc-800 dark:border-zinc-800 px-2 py-1.5 rounded-full">
							{darkMode ? (
								<>
									<span className="hidden sm:block">Dark</span>
									<MoonIcon className="w-5 h-5" />
								</>
							) : (
								<>
									<span className="hidden sm:block">Light</span>
									<SunIcon className="w-5 h-5" />
								</>
							)}
						</div>
					</ButtonBase>
				</div>
			</div>
		</header>
	)
}
