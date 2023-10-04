'use client'

import InputBase from '@mui/material/InputBase'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import { QrCodeIcon } from '@heroicons/react/24/solid'
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { checkAddress } from 'nanocurrency'
import { useState } from 'react'
import QrScannerModal from './QrScanner/QrScannerModal'

export interface AddressInputProps {
	onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
	onChange?: (value: string) => void
	onValidAddress?: (address: string) => void
	onInvalidAddress?: (text: string) => void
}

export default function AddressInput({
	onSubmit,
	onChange,
	onValidAddress,
	onInvalidAddress,
}: AddressInputProps) {
	const [value, setValue] = useState('')
	const [openScanner, setOpenScanner] = useState(false)

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

	return (
		<form
			className="w-full p-2 flex items-center rounded-md border border-slate-200 bg-slate-50"
			action={'#'}
			onSubmit={onSubmit}
		>
			<InputBase
				id="nano-address"
				sx={{ ml: 1, flex: 1 }}
				placeholder="Your Nano address: nano_"
				value={value}
				inputProps={{ 'aria-label': 'your nano address' }}
				onChange={handleOnChange}
				className="!text-slate-700"
			/>
			{openScanner && (
				<QrScannerModal
					onClose={() => setOpenScanner(false)}
					onScan={handleOnScan}
				/>
			)}
			<IconButton
				type="button"
				sx={{ p: '10px' }}
				aria-label="qr-scanner"
				onClick={() => setOpenScanner(true)}
			>
				<QrCodeIcon className="w-5 h-5 text-gray-500" />
			</IconButton>
			<Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
			<IconButton
				color="primary"
				sx={{ p: '10px' }}
				aria-label="directions"
				onClick={clipboardPaste}
			>
				<ClipboardDocumentIcon className="w-5 h-5 text-gray-600" />
			</IconButton>
		</form>
	)
}
