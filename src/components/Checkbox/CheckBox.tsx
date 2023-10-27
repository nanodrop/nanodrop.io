'use client'

import { useCallback, useEffect } from 'react'
import Image from 'next/image'

import clsx from 'clsx'
import { ButtonBase } from '@mui/material'
import { convert, Unit } from 'nanocurrency'

import useFaucet from '@/hooks/useFaucet'
import './checkbox.css'

import RefreshSVG from './assets/refresh.svg'
import XnoDropSvg from './assets/xno-drop.svg'
import { explorerLinkFromHash } from '@/utils'

export interface CheckBoxProps {
	nanoAddress?: string
}

export default function CheckBox({ nanoAddress }: CheckBoxProps) {
	const {
		drop,
		amount,
		isDropping,
		isReady,
		isVerifying,
		Verification,
		isError,
		error,
		isSent,
		dropData,
		refresh,
		isRefreshing,
	} = useFaucet()

	const handleClick = useCallback(
		async (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
			event.stopPropagation()
			if (event.isTrusted) {
				if (isSent) return
				if (isError) await refresh()
				await drop(nanoAddress as string)
			}
		},
		[isSent, isError, nanoAddress],
	)

	useEffect(() => {
		if (dropData && dropData?.account === nanoAddress) {
			const audio = new Audio('/assets/drip.mp3')
			audio.play()
		}
	}, [nanoAddress, dropData])

	useEffect(() => {
		if (dropData && dropData?.account !== nanoAddress) {
			refresh()
		}
	}, [dropData, nanoAddress])

	const isLoading = !isReady || isVerifying || isDropping

	return (
		<ButtonBase
			sx={{
				'.MuiTouchRipple-child': {
					backgroundColor: '#000',
				},
			}}
			className={clsx('!rounded')}
			disabled={isLoading}
			href={isSent ? explorerLinkFromHash(dropData?.hash || '') : ''}
			target="_blank"
		>
			<Verification />
			<div
				id="nd-anchor-container"
				className="group w-fit max-w-full flex space-x-3 p-3 rounded hover:shadow cursor-pointer h-16 border border-slate-200 dark:border-zinc-700 bg-[aliceblue] dark:bg-zinc-400/10 nd-anchor-light text-center"
				onClick={handleClick}
			>
				<div
					id="nd-anchor-content"
					className="relative inline-flex items-center space-x-2 w-48"
				>
					<div id="nd-anchor-checkbox-holder">
						<div
							id="nd-anchor-checkbox"
							role="checkbox"
							aria-checked="false"
							aria-labelledby="recaptcha-anchor-label"
						>
							{(isError && <ErrorMark />) ||
								(isLoading && <CheckboxSpinner />) ||
								(isSent && <CheckMark />) || (
									<div
										id="recaptcha-checkbox-border"
										className="w-6 h-6 border-2 border-[#c1c1c1] dark:border-zinc-700 text-slate-700 rounded group-hover:border-nano bg-white dark:bg-[#101217]"
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
							className="text-sm text-slate-600 dark:text-zinc-400"
							aria-hidden="true"
							role="presentation"
						>
							{(error && (
								<>
									<p aria-label="error-title" className="font-medium text-sm">
										{error.title || 'Error'}
									</p>
									<p aria-label="error-message" className="text-[10px]">
										{error.message}
									</p>
								</>
							)) ||
								(isVerifying && <>Proxy Verifying</>) ||
								(isSent && dropData && (
									<>
										<span
											aria-live="polite"
											aria-labelledby="recaptcha-accessible-status"
										></span>
										Sent{' '}
										<span id="drop-amount">
											{convert(dropData.amount, {
												from: Unit.raw,
												to: Unit.NANO,
											})}
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
											{amount !== undefined
												? convert(amount, {
														from: Unit.raw,
														to: Unit.NANO,
												  })
												: 'some'}
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
						)) ||
						(isSent && (
							<div className="flex flex-col items-center relative group">
								<svg
									className="w-[18px] h-[18px] text-slate-500 group-hover:text-nano mx-auto"
									viewBox="0 0 512 512.0015"
									xmlns="http://www.w3.org/2000/svg"
									fill="currentColor"
								>
									<path d="m220.769531 376.726562-47.066406 47.066407c-23.570313 23.570312-61.921875 23.578125-85.503906 0-23.566407-23.570313-23.558594-61.921875.011719-85.492188l94.503906-94.503906c21.839844-21.839844 56.378906-23.453125 80.078125-4.816406 1.875 1.472656 3.683593 3.078125 5.414062 4.808593 10.496094 10.492188 26.769531 10.664063 37.046875.382813l29.617188-29.617187c-4.867188-7.386719-10.492188-14.277344-16.824219-20.609376-8.925781-8.921874-18.824219-16.292968-29.371094-22.09375-41.265625-22.761718-92.300781-21.625-132.601562 3.40625-8.371094 5.199219-16.289063 11.429688-23.554688 18.699219l-94.152343 94.152344c-51.152344 51.152344-51.152344 134.378906-.007813 185.527344 51.15625 51.152343 134.378906 51.152343 185.535156 0l84.699219-84.699219c-29.585938 3.914062-60.039062-.148438-87.824219-12.210938zm0 0"></path>
									<path d="m473.636719 38.359375c-51.148438-51.148437-134.371094-51.148437-185.527344.007813l-84.691406 84.691406c29.585937-3.917969 60.039062.144531 87.824219 12.210937l47.070312-47.070312c23.570312-23.570313 61.914062-23.570313 85.484375 0 23.578125 23.578125 23.578125 61.921875.007813 85.492187l-94.515626 94.515625c-21.597656 21.597657-55.875 23.089844-79.546874 4.542969-1.9375-1.503906-3.789063-3.148438-5.566407-4.925781-10.320312-10.320313-27.105469-10.3125-37.425781.007812l-29.617188 29.617188c4.871094 7.371093 10.503907 14.269531 16.824219 20.589843 8.988281 8.988282 18.972657 16.394532 29.59375 22.226563 41.492188 22.777344 92.785157 21.445313 133.113281-3.980469 8.101563-5.105468 15.769532-11.1875 22.816407-18.238281l94.15625-94.152344c51.152343-51.15625 51.152343-134.378906 0-185.535156zm0 0"></path>
								</svg>
								<div className="text-xs mt-1 text-slate-500 group-hover:text-nano">
									Explorer
								</div>
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
								<div
									id="nd-anchor-logo-text"
									className="text-xs text-slate-500 hidden"
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
			className="recaptcha-checkbox-spinner dark:!bg-transparent"
			role="presentation"
			style={{
				animationPlayState: 'running',
			}}
		>
			<div
				className="recaptcha-checkbox-spinner-overlay dark:!bg-transparent"
				style={{
					animationPlayState: 'running',
				}}
			></div>
		</div>
	</div>
)
