'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ButtonBase } from '@mui/material'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'

import { checkHash, convert, Unit } from 'nanocurrency'
import './checkbox.css'

import RefreshSVG from './assets/refresh.svg'
import XnoDropSvg from './assets/xno-drop.svg'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface CheckBoxProps {
	nanoAddress?: string
}

interface Ticket {
	amount: string
	ticket: string
	createdAt: number
	expiresAt: number
}

const rawToNano = (raw: string) => {
	return convert(raw, {
		from: Unit.raw,
		to: Unit.NANO,
	})
}

const getTicket = async (): Promise<Ticket> => {
	const response = await fetch(`${API_URL}/ticket`)
	if (response.ok) {
		return await response.json()
	} else {
		let message = `Failed with status ${response.status}`
		try {
			const body = await response.json()
			if ('message' in body) {
				message = body.message
			} else if ('error' in body && typeof body.error === 'string') {
				message = body.error
			}
		} catch (err) {}
		throw new Error(message)
	}
}

interface DropMeRequest {
	account: string
	ticket: string
}

const dropMe = async ({ account, ticket }: DropMeRequest): Promise<any> => {
	const response = await fetch(`${API_URL}/drop`, {
		method: 'POST',
		body: JSON.stringify({ account, ticket }),
		headers: {
			'Content-Type': 'application/json',
		},
	})
	if (response.ok) {
		return await response.json()
	} else {
		let message = `Failed with status ${response.status}`
		try {
			const body = await response.json()
			if ('message' in body) {
				message = body.message
			} else if ('error' in body && typeof body.error === 'string') {
				message = body.error
			}
		} catch (err) {}
		throw new Error(message)
	}
}

export default function CheckBox({ nanoAddress }: CheckBoxProps) {
	const [errorTitle, setErrorTitle] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [isSent, setIsSent] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)

	const { data: ticket, isLoading: isLoadingTicket } = useSWR(
		'ticket',
		getTicket,
		{
			refreshInterval: 1000 * 60 * 4, // 4 minutes
			onError: (error: Error) => {
				setErrorTitle('Ticket Error')
				setErrorMessage(error.message)
			},
		},
	)

	const {
		data,
		trigger: drop,
		isMutating: isDropping,
	} = useSWRMutation(
		{ account: nanoAddress, ticket: ticket?.ticket },
		data => dropMe(data as DropMeRequest),
		{
			onError: (error: Error) => {
				setErrorTitle('Error Sending')
				setErrorMessage(error.message)
			},
			onSuccess: data => {
				if ('hash' in data && checkHash(data.hash)) {
					setIsSent(true)
				} else {
					setErrorTitle('Error Sending')
					setErrorMessage('Hash not found')
				}
			},
		},
	)

	const reset = () => {
		setIsSent(false)
		setErrorMessage(null)
		setErrorTitle(null)
	}

	const handleClick = async (
		event: React.MouseEvent<HTMLDivElement, MouseEvent>,
	) => {
		event.stopPropagation()
		if (event.isTrusted) {
			reset()
			await drop()
		}
	}

	useEffect(() => {
		if (isSent) {
			const audio = new Audio('/assets/drip.mp3')
			audio.play()
		}
	}, [isSent])

	const isError = !!errorMessage || !!errorTitle

	return (
		<ButtonBase
			sx={{
				'.MuiTouchRipple-child': {
					backgroundColor: '#000',
				},
			}}
			className="!rounded"
		>
			<div
				id="nd-anchor-container"
				className="group w-fit max-w-full flex space-x-3 p-3 rounded hover:shadow cursor-pointer h-16 border border-slate-200 bg-sky-50 nd-anchor-light"
			>
				<div
					id="nd-anchor-content"
					className="relative inline-flex items-center space-x-2 w-48"
					onClick={handleClick}
				>
					<div id="nd-anchor-checkbox-holder">
						<div
							id="nd-anchor-checkbox"
							role="checkbox"
							aria-checked="false"
							aria-labelledby="recaptcha-anchor-label"
						>
							{(isError && <ErrorMark />) ||
								(isDropping && <CheckboxSpinner />) ||
								(isSent && <CheckMark />) || (
									<div
										id="recaptcha-checkbox-border"
										className="w-6 h-6 border-2 border-[#c1c1c1] rounded group-hover:border-nano bg-white"
										role="presentation"
									/>
								)}
						</div>
					</div>

					<div
						id="nd-label-container"
						className="flex flex-1 justify-center items-center"
					>
						<label
							id="nd-anchor-checkbox-label"
							className="text-sm text-slate-600"
							aria-hidden="true"
							role="presentation"
						>
							{((errorMessage || errorTitle) && (
								<>
									<p aria-label="error-title" className="font-medium text-sm">
										{errorTitle || 'Error'}
									</p>
									<p aria-label="error-message" className="text-[10px]">
										{errorMessage}
									</p>
								</>
							)) ||
								(isSent && (
									<>
										<span
											aria-live="polite"
											aria-labelledby="recaptcha-accessible-status"
										></span>
										Sent{' '}
										<span id="drop-amount">
											{ticket ? rawToNano(data.amount) : 'some'}
										</span>{' '}
										Nano
									</>
								)) || (
									<>
										<span
											aria-live="polite"
											aria-labelledby="recaptcha-accessible-status"
										></span>
										Send{' '}
										<span id="drop-amount">
											{ticket ? rawToNano(ticket.amount) : 'some'}
										</span>{' '}
										Nano
									</>
								)}
						</label>
						<div className="absolute inset-0 opacity-0" />
					</div>
				</div>

				<div id="nd-anchor-footer" className="flex items-center justify-center">
					{(isRefreshing && (
						<div
							className="flex flex-col items-center"
							id="nd-anchor-refreshing"
						>
							<Image
								src={RefreshSVG}
								alt={''}
								className="w-6 h-6 animate animate-spin"
							/>
						</div>
					)) ||
						(isError && (
							<div className="flex flex-col items-center">
								<Image src={RefreshSVG} alt={''} className="w-5 h-5" />
								<div className="nd-anchor-logo-text-refresh">Refresh</div>
							</div>
						)) || (
							<div
								id="nd-anchor-logo-portrait"
								aria-hidden="true"
								role="presentation"
								className="flex flex-col items-center"
							>
								<Image
									src={XnoDropSvg}
									alt={''}
									className="w-7 h-7 opacity-80"
								/>
								<img
									id="nd-anchor-logo-img"
									src="/icons/favicon-32x32.png"
									className="w-[32px] h-[32px] hidden"
								/>
								<div
									id="nd-anchor-logo-text"
									className="text-xs text-gray-500 hidden"
								>
									NanoDrop.io
								</div>
							</div>
						)}
				</div>
			</div>
		</ButtonBase>
	)
}

export const CheckMark = () => (
	<svg
		className="recaptcha-checkbox-checkmark blue-stroke animate"
		role="presentation"
	>
		<g transform="matrix(0.79961,8.65821e-32,8.39584e-32,0.79961,-489.57,-205.679)">
			<path
				className="checkmark__check"
				fill="none"
				d="M616.306,283.025L634.087,300.805L673.361,261.53"
			/>
		</g>
	</svg>
)

export const ErrorMark = () => (
	<svg className="checkbox-error red-stroke animate">
		<g transform="matrix(0.79961,8.65821e-32,8.39584e-32,0.79961,-502.652,-204.518)">
			<path
				className="first-line"
				d="M634.087,300.805L673.361,261.53"
				fill="none"
			/>
		</g>
		<g transform="matrix(-1.28587e-16,-0.79961,0.79961,-1.28587e-16,-204.752,543.031)">
			<path className="second-line" d="M634.087,300.805L673.361,261.53" />
		</g>
	</svg>
)

export const CheckboxSpinner = () => (
	<div>
		<div className="recaptcha-checkbox-borderAnimation" role="presentation" />
		<div
			className="recaptcha-checkbox-spinner"
			role="presentation"
			style={{
				animationPlayState: 'running',
			}}
		>
			<div
				className="recaptcha-checkbox-spinner-overlay"
				style={{
					animationPlayState: 'running',
				}}
			></div>
		</div>
	</div>
)
