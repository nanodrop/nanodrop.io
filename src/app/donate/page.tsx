'use client'

import useSWR from 'swr'
import QRCode from 'react-qr-code'
import { slate } from 'tailwindcss/colors'
import { ButtonBase } from '@mui/material'
import { Montserrat } from 'next/font/google'
import { API_URL } from '@/config'
import fetcher from '@/lib/fetcher'

const montserrat = Montserrat({ subsets: ['latin'], weight: 'variable' })

type WalletResponse = {
	account: string
}

export default function Donate() {
	const { data: wallet, error } = useSWR<WalletResponse>(
		`${API_URL}/wallet`,
		fetcher,
	)
	const account = wallet?.account || ''

	const copy = async () => {
		if (!account) return

		try {
			await navigator.clipboard.writeText(account)
		} catch {
			alert('Clipboard Copy Error')
		}
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
				{account ? (
					<>
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
					</>
				) : (
					<div className="text-sm w-full max-w-xl p-4 rounded-xl border border-slate-200 dark:border-zinc-700 font-semibold text-center">
						{error ? 'Wallet account unavailable' : 'Loading wallet account...'}
					</div>
				)}
				<div className="flex w-full max-w-xl justify-between gap-2">
					<ButtonBase
						className="w-1/3 rounded-xl"
						disabled={!account}
						onClick={() => void copy()}
					>
						<div className="text-sm flex-1 p-4 border border-slate-200 dark:border-zinc-700 rounded-xl  font-semibold break-all text-center">
							COPY
						</div>
					</ButtonBase>
					<ButtonBase
						className="text-sm flex-1 p-4 !bg-nano/50 !text-white !rounded-xl shadow font-semibold break-all text-center"
						disabled={!account}
						href={account ? `nano:${account}` : ''}
					>
						Open Wallet
					</ButtonBase>
				</div>
			</div>
		</div>
	)
}
