import { CONTACT_EMAIL, SOCIALS } from '@/config'
import Link from 'next/link'

const navigation = {
	main: [
		{
			name: 'Wallets',
			href: 'https://hub.nano.org/wallets/open-source/75/allows-representative-changes/76/non-custodial/291',
			external: true,
		},
		{ name: 'Donate', href: '/donate' },
		{ name: 'Terms', href: '/tos' },
	],
	social: [
		{
			name: 'GitHub',
			href: SOCIALS.github,
			icon: (props: React.SVGProps<SVGSVGElement>) => (
				<svg viewBox="0 0 20 20" version="1.1" {...props}>
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
			),
		},
		{
			name: 'Discord',
			href: SOCIALS.discord,
			icon: (props: React.SVGProps<SVGSVGElement>) => (
				<svg
					viewBox="0 -28.5 256 256"
					version="1.1"
					preserveAspectRatio="xMidYMid"
					{...props}
				>
					<g>
						<path
							d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
							fill="currentColor"
							fillRule="nonzero"
						></path>
					</g>
				</svg>
			),
		},
		{
			name: 'Reddit',
			href: SOCIALS.reddit,
			icon: (props: React.SVGProps<SVGSVGElement>) => (
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 512 512"
					{...props}
					fill="currentColor"
				>
					<path d="M201.5 305.5c-13.8 0-24.9-11.1-24.9-24.6 0-13.8 11.1-24.9 24.9-24.9 13.6 0 24.6 11.1 24.6 24.9 0 13.6-11.1 24.6-24.6 24.6zM504 256c0 137-111 248-248 248S8 393 8 256 119 8 256 8s248 111 248 248zm-132.3-41.2c-9.4 0-17.7 3.9-23.8 10-22.4-15.5-52.6-25.5-86.1-26.6l17.4-78.3 55.4 12.5c0 13.6 11.1 24.6 24.6 24.6 13.8 0 24.9-11.3 24.9-24.9s-11.1-24.9-24.9-24.9c-9.7 0-18 5.8-22.1 13.8l-61.2-13.6c-3-.8-6.1 1.4-6.9 4.4l-19.1 86.4c-33.2 1.4-63.1 11.3-85.5 26.8-6.1-6.4-14.7-10.2-24.1-10.2-34.9 0-46.3 46.9-14.4 62.8-1.1 5-1.7 10.2-1.7 15.5 0 52.6 59.2 95.2 132 95.2 73.1 0 132.3-42.6 132.3-95.2 0-5.3-.6-10.8-1.9-15.8 31.3-16 19.8-62.5-14.9-62.5zM302.8 331c-18.2 18.2-76.1 17.9-93.6 0-2.2-2.2-6.1-2.2-8.3 0-2.5 2.5-2.5 6.4 0 8.6 22.8 22.8 87.3 22.8 110.2 0 2.5-2.2 2.5-6.1 0-8.6-2.2-2.2-6.1-2.2-8.3 0zm7.7-75c-13.6 0-24.6 11.1-24.6 24.9 0 13.6 11.1 24.6 24.6 24.6 13.8 0 24.9-11.1 24.9-24.6 0-13.8-11-24.9-24.9-24.9z" />
				</svg>
			),
		},
	],
}

export default function Footer() {
	return (
		<footer className="border-t border-slate-100 dark:border-zinc-900 bg-slate-50 dark:bg-midnight-2 text-slate-500 dark:text-zinc-500 pb-safe">
			<div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
				<div className="flex flex-col items-center justify-center gap-y-12 pt-6 pb-4 lg:flex-row lg:items-center">
					<div>
						<div className="flex justify-center items-center text-slate-900">
							<div className="flex gap-6">
								{navigation.social.map(item => (
									<a
										key={item.name}
										href={item.href}
										className="flex items-center gap-1 text-slate-500 dark:text-zinc-500 hover:text-nano text-sm"
									>
										<item.icon className="h-6 w-6" aria-hidden="true" />
										<span className="sr-only">{item.name}</span>
									</a>
								))}
							</div>
						</div>
						<nav className="mt-4 flex gap-8">
							<ul className="flex items-center gap-3">
								{navigation.main.map((item, index) => (
									<li key={item.name} className="flex gap-3">
										<Link
											href={item.href}
											className="flex gap-1 items-center text-[12px] hover:text-nano"
											target={item.external ? '_blank' : '_self'}
										>
											{item.name}
										</Link>
										{index < navigation.main.length - 1 && (
											<span className="">·</span>
										)}
									</li>
								))}
							</ul>
						</nav>
					</div>
				</div>
				<div className="flex flex-col items-center border-t border-slate-200 dark:border-zinc-900 py-4 md:flex-row-reverse md:justify-between">
					<Link
						href={`mailto:${CONTACT_EMAIL}`}
						className="text-xs  hover:text-nano"
					>
						{CONTACT_EMAIL}
					</Link>
					<p className="mt-6 text-xs  md:mt-0">
						Ӿ {new Date().getFullYear()} NanoDrop by{' '}
						<Link
							target="_blank"
							href="https://github.com/anarkrypto"
							className="text-sky-600 hover:underline"
						>
							Anarkrypto
						</Link>
					</p>
				</div>
			</div>
		</footer>
	)
}
