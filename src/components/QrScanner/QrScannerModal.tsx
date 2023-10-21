import useQrScanner from './useQrScanner'
import { IconButton } from '@mui/material'
import { useEffect, useState } from 'react'
import { FacingMode } from './QrScanner'
import SelectBox from '../SelectBox'
import { Roboto } from 'next/font/google'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { checkAddress } from 'nanocurrency'
import { rose } from 'tailwindcss/colors'

const roboto = Roboto({
	weight: ['400', '500'],
	subsets: ['latin'],
})

interface QrScannerModalProps {
	onScan?: (data: string) => void
	onClose?: () => void
}

export default function QrScannerModal({
	onScan,
	onClose,
}: QrScannerModalProps) {
	const [invalidAddress, setInvalidAddress] = useState(false)

	const {
		ref,
		isReady,
		data,
		cameras,
		setCamera,
		destroy,
		updateOverlayColor,
	} = useQrScanner()
	const [facingMode, setFacingMode] = useState<FacingMode>('environment')

	useEffect(() => {
		if (isReady) {
			setCamera(facingMode)
		}
	}, [isReady, facingMode])

	useEffect(() => {
		if (!data) {
			updateOverlayColor('#4a90e2')
			setInvalidAddress(false)
			return
		}
		if (!checkAddress(data)) {
			setInvalidAddress(true)
			updateOverlayColor(rose[600])
			return
		}
		setInvalidAddress(false)
		onScan && onScan(data)
	}, [data])

	const handleClose = () => {
		destroy()
		onClose && onClose()
	}

	return (
		<>
			<div className="fixed z-50 bg-black/50 h-screen-safe w-full inset-0 flex flex-col justify-end sm:justify-center sm:items-center">
				<div className="bg-white dark:bg-midnight-2 w-full max-w-2xl rounded-t-lg sm:rounded-b-lg outline-none">
					<div className="w-full flex justify-between p-2 items-center">
						<IconButton onClick={handleClose}>
							<XCircleIcon className="w-8 h-8 text-slate-700 dark:text-zinc-600" />
						</IconButton>
						{cameras?.length > 0 ? (
							<div>
								<SelectBox
									defaultValue={cameras[0]?.id}
									options={cameras.map(camera => ({
										value: camera.id,
										title: camera.label,
										description: '',
									}))}
									onChange={setCamera}
								/>
							</div>
						) : (
							<div className="text-slate-700 dark:text-zinc-500 font-semibold text-sm p-2">
								No cameras found
							</div>
						)}
					</div>
					<div className="w-full flex justify-center max-h-[320px] bg-slate-200 dark:bg-zinc-950 relative">
						<video
							ref={ref}
							style={{
								width: '100%',
								height: 'auto',
								maxWidth: 'auto',
							}}
						/>
						{invalidAddress && (
							<div
								className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 p-2 rounded left-1/2 border border-rose-500 bg-rose-700 font-semibold text-white ${roboto.className} uppercase text-sm`}
							>
								Invalid Nano Address!
							</div>
						)}
					</div>
					<div className="py-8 flex justify-center">
						<IconButton
							onClick={() =>
								setFacingMode(current =>
									current === 'environment' ? 'user' : 'environment',
								)
							}
							className="relative !bg-slate-600 dark:!bg-zinc-600 shadow"
						>
							<svg
								focusable="false"
								aria-hidden="true"
								viewBox="0 0 24 24"
								data-testid="FlipCameraIosIcon"
								className="w-10 h-10 text-white"
							>
								<path
									d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-8 13c-2.76 0-5-2.24-5-5H5l2.5-2.5L10 13H8c0 2.21 1.79 4 4 4 .58 0 1.13-.13 1.62-.35l.74.74c-.71.37-1.5.61-2.36.61zm4.5-2.5L14 13h2c0-2.21-1.79-4-4-4-.58 0-1.13.13-1.62.35l-.74-.73C10.35 8.24 11.14 8 12 8c2.76 0 5 2.24 5 5h2l-2.5 2.5z"
									fill="currentColor"
								></path>
							</svg>
						</IconButton>
					</div>
				</div>
			</div>
		</>
	)
}
