'use client'

import QRCode from 'react-qr-code'
import { slate, zinc } from 'tailwindcss/colors'
import { ButtonBase } from '@mui/material'
import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

const account = process.env.NEXT_PUBLIC_DONATION_ADDRESS || ''

export default function Donate() {
	const copy = () => {
		try {
			navigator.clipboard.writeText(account)
		} catch {
			alert('Clipboard Copy Error')
		}
	}

	if (!account) {
		return <div>NEXT_PUBLIC_DONATION_ADDRESS is undefined</div>
	}

	return (
		<div className="flex flex-col flex-1 w-full justify-center items-center bg-slate-50 dark:bg-transparent p-4 sm:p-8 text-slate-600 dark:text-zinc-600">
			<div className="flex flex-col items-center gap-4">
				<div className="border border-slate-200 dark:border-zinc-700 rounded-xl w-full max-w-xl flex justify-center">
					<h1
						className={`flex ${montserrat.className} font-normal text-xl sm:text-2xl uppercase py-4`}
					>
						Donate with NANO
					</h1>
				</div>
				<div className="w-full sm:w-fit flex justify-center p-8 bg-white shadow rounded-xl dark:hidden">
					<QRCode value={`nano:${account}`} fgColor={slate['800']} />
				</div>
				<div className="w-full sm:w-fit justify-center p-8 border border-zinc-700 shadow rounded-xl hidden dark:flex">
					<QRCode
						value={`nano:${account}`}
						fgColor={'#fff'}
						bgColor="#101217"
						className="rounded-lg"
					/>
				</div>
				<div className="text-sm w-full max-w-xl p-4 rounded-xl border border-slate-200 dark:border-zinc-700 font-semibold break-all">
					{account}
				</div>
				<div className="flex w-full max-w-xl justify-between gap-2">
					<ButtonBase className="w-1/3 rounded-xl" onClick={() => copy()}>
						<div className="text-sm flex-1 p-4 border border-slate-200 dark:border-zinc-700 rounded-xl  font-semibold break-all text-center">
							COPY
						</div>
					</ButtonBase>
					<ButtonBase
						className="text-sm flex-1 p-4 !bg-nano/50 !text-white !rounded-xl shadow font-semibold break-all text-center"
						href={`nano:${account}`}
					>
						Open Wallet
					</ButtonBase>
				</div>
			</div>
		</div>
	)
}
