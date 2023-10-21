'use client'

import InputBase from '@mui/material/InputBase'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { checkAddress } from 'nanocurrency'
import { useRef, useState } from 'react'
import QrScannerModal from './QrScanner/QrScannerModal'

export interface AddressInputProps {
	onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
	onChange?: (value: string) => void
	onReset?: () => void
	onValidAddress?: (address: string) => void
	onInvalidAddress?: (text: string) => void
}

export default function AddressInput({
	onSubmit,
	onChange,
	onReset,
	onValidAddress,
	onInvalidAddress,
}: AddressInputProps) {
	const [value, setValue] = useState('')
	const [openScanner, setOpenScanner] = useState(false)

	const inputRef = useRef<HTMLInputElement>(null)

	const validate = (value: string) => {
		if (checkAddress(value)) {
			onValidAddress && onValidAddress(value)
		} else {
			onInvalidAddress && onInvalidAddress(value)
		}
	}

	const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		onChange && onChange(event.target.value)
		setValue(event.target.value)
		validate(event.target.value)
	}

	const handleOnScan = (text: string) => {
		onChange && onChange(text)
		setValue(text)
		validate(text)
		setOpenScanner(false)
	}

	const handleReset = () => {
		onChange && onChange('')
		onReset && onReset()
		setValue('')
	}

	const clipboardPaste = async () => {
		try {
			const value = await navigator.clipboard.readText()
			onChange && onChange(value)
			setValue(value)
			validate(value)
		} catch (error) {
			console.error('Cliboard Paste Error:', error)
		}
	}

	const inputFocus = () => {
		inputRef.current?.focus()
	}

	return (
		<form
			className="w-full select-none p-2 flex items-center rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent"
			action={'#'}
			onSubmit={onSubmit}
			onClick={inputFocus}
		>
			<div className="w-4"></div>
			<InputBase
				id="nano-address"
				sx={{ ml: 1, flex: 1 }}
				placeholder="Your Nano address: nano_"
				value={value}
				inputProps={{ 'aria-label': 'your nano address' }}
				onChange={handleOnChange}
				className="!text-slate-700 dark:!text-zinc-400"
				inputRef={inputRef}
				autoFocus={true}
			/>
			{value ? (
				<>
					<IconButton
						color="error"
						sx={{ p: '10px' }}
						aria-label="directions"
						onClick={handleReset}
						className="group"
					>
						<XMarkIcon className="w-5 h-5 text-slate-600 dark:text-zinc-500 group-hover:text-rose-500" />
					</IconButton>{' '}
				</>
			) : (
				<>
					<IconButton
						type="button"
						sx={{ p: '10px' }}
						aria-label="qr-scanner"
						onClick={e => {
							setOpenScanner(true)
						}}
					>
						<QrCodeIcon className="w-5 h-5 text-slate-600 dark:text-zinc-500" />
					</IconButton>
					<Divider
						sx={{ height: 28, m: 0.5 }}
						orientation="vertical"
						className="dark:bg-zinc-800"
					/>
					<IconButton
						color="primary"
						sx={{ p: '10px' }}
						aria-label="directions"
						onClick={clipboardPaste}
					>
						<ClipboardDocumentIcon className="w-5 h-5 text-slate-600 dark:text-zinc-500" />
					</IconButton>
				</>
			)}
			{openScanner && (
				<QrScannerModal
					onClose={() => setOpenScanner(false)}
					onScan={handleOnScan}
				/>
			)}
		</form>
	)
}
