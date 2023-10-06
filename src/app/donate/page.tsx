'use client'

import QRCode from 'react-qr-code'
import { slate } from 'tailwindcss/colors'
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
		<div className="flex flex-col flex-1 w-full justify-center items-center bg-slate-50 p-4 sm:p-8">
			<div className="flex flex-col items-center gap-4">
				<div className="border border-slate-200 rounded-xl w-full max-w-xl flex justify-center">
					<h1
						className={`flex ${montserrat.className} font-normal text-2xl sm:text-3xl uppercase text-slate-500 py-4`}
					>
						Donate with NANO
					</h1>
				</div>
				<div className="w-full sm:w-fit flex justify-center p-8 bg-white shadow rounded-xl">
					<QRCode value={`nano:${account}`} fgColor={slate['800']} />
				</div>
				<div className="text-sm w-full max-w-xl p-4 rounded-xl border border-slate-200 font-semibold text-slate-600 break-all">
					{account}
				</div>
				<div className="flex w-full max-w-xl justify-between gap-2">
					<ButtonBase className="w-1/3 rounded-xl" onClick={() => copy()}>
						<div className="text-sm flex-1 p-4 border border-slate-200 rounded-xl  font-semibold text-slate-600 break-all text-center">
							COPY
						</div>
					</ButtonBase>
					<ButtonBase
						className="text-sm flex-1 p-4 bg-nano text-white rounded-xl shadow font-semibold break-all text-center"
						href={`nano:${account}`}
					>
						Open Wallet
					</ButtonBase>
				</div>
			</div>
		</div>
	)
}