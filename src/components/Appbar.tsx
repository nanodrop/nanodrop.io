'use client'

import { SOCIALS } from '@/config'
import usePrice from '@/hooks/usePrice'
import { ButtonBase } from '@mui/material'
import clsx from 'clsx'
import { Montserrat } from 'next/font/google'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import DropSVG from '@/components/DropSVG'

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

	return (
		<header
			className={clsx(
				'pt-safe w-full bg-nano sm:bg-white',
				true && 'border-b border-slate-100',
			)}
		>
			<div className="w-full flex justify-between items-center border-none px-4 sm:px-4 py-2">
				{!isHome && (
					<div>
						<Link href="/">
							<h1
								className={`flex ${montserrat.className} items-center font-light text-xl sm:text-2xl uppercase text-nano`}
							>
								<span>Nano</span>
								<span className="px-1">
									<DropSVG />
								</span>
								<span>Drop</span>
							</h1>
						</Link>
					</div>
				)}
				{isHome && (
					<>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 rounded-full text-white sm:text-slate-500 text-sm sm:text-base hidden sm:block">
							1 XNO ={' '}
							{priceError
								? priceError
								: priceIsLoading
								? '-- USD'
								: `US$ ${price}`}
						</div>
						<div className="whitespace-nowrap py-1 px-2 border border-slate-200 rounded-full text-white sm:text-slate-500 text-sm sm:text-base sm:hidden">
							1Ӿ ={' '}
							{priceError
								? priceError
								: priceIsLoading
								? '-- USD'
								: `$${price}`}
						</div>
					</>
				)}
				<div className="flex items-center gap-2 justify-end sm:w-auto">
					{isHome && (
						<nav className="flex justify-center gap-1 w-full sm:w-auto">
							{navigation.map(link => (
								<Link href={link.href}>
									<div className="text-white sm:text-slate-500 hover:text-nano py-1 px-2">
										<h2 className="font-normal uppercase text-sm">
											{link.name}
										</h2>
									</div>
								</Link>
							))}
						</nav>
					)}
					<ButtonBase className="!rounded-lg" href={SOCIALS.github}>
						<div className="flex items-center space-x-2 text-slate-600 hover:text-[#1f2328] border border-slate-600 sm:border-slate-300 p-2 rounded-lg">
							<svg
								viewBox="0 0 20 20"
								version="1.1"
								className="w-4 h-4 sm:h-6 sm:w-6"
							>
								<g stroke="none" strokeWidth="1" fillRule="evenodd">
									<g
										transform="translate(-140.000000, -7559.000000)"
										fill="currentColor"
									>
										<g id="icons" transform="translate(56.000000, 160.000000)">
											<path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399"></path>
										</g>
									</g>
								</g>
							</svg>
						</div>
					</ButtonBase>
				</div>
			</div>
		</header>
	)
}
