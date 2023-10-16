import { API_URL, TURNSTILE_KEY } from '@/config'
import { checkAddress, checkAmount, checkHash } from 'nanocurrency'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Turnstile, { BoundTurnstileObject, useTurnstile } from 'react-turnstile'
import Logger from '@/lib/logger'

export interface Ticket {
	amount: string
	ticket: string
	createdAt: number
	expiresAt: number
	verificationRequired: boolean
}

export interface DropRequest {
	account: string
	ticket: string
	turnstileToken?: string
}

export interface DropData {
	hash: string
	amount: string
	account: string
}

export interface FaucetError {
	title: string
	message: string
}

export interface UseFaucetProps {
	debug?: boolean
}

// TODO: Move error handle logic to a fetcher
const getTicket = async (url: string): Promise<Ticket> => {
	const response = await fetch(url)
	if (response.ok) {
		return await response.json()
	} else {
		let message = response.statusText
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

// TODO: Move error handle logic to a fetcher
const drop = async (
	url: string,
	{ arg: { account, ticket, turnstileToken } }: { arg: DropRequest },
): Promise<DropData> => {
	const response = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({ account, ticket, turnstileToken }),
		headers: {
			'Content-Type': 'application/json',
		},
	})
	if (response.ok) {
		const data = await response.json()
		if (!checkHash(data.hash) || !checkAmount(data.amount)) {
			throw new Error('invalid response')
		}
		return { hash: data.hash, amount: data.amount, account }
	} else {
		let message = response.statusText
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

export default function useFaucet({ debug }: UseFaucetProps = { debug: true }) {
	const [isVerified, setIsVerified] = useState(false)
	const [isVerifying, setIsVerifying] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState('')
	const [error, setError] = useState<FaucetError | null>(null)

	const turnstile = useTurnstile()

	const logger = useMemo(() => new Logger('USE_FAUCET', debug), [debug])

	const handleError = (title: string, message: string) => {
		setError({ title, message })
		logger.error(`${title}: ${message}`)
	}

	const handleTurstileVerified = (token: string) => {
		setIsVerifying(false)
		setIsVerified(true)
		setTurnstileToken(token)
	}

	const handleTurnstileExpired = (turnstile: BoundTurnstileObject) => {
		setIsVerified(false)
		setTurnstileToken('')
		turnstile.reset()
	}

	const handleTurnstileError = (error: any) => {
		handleError('Verification Error', JSON.stringify(error))
	}

	const handleTurnstileUnsupported = () => {
		handleError('Verification Error', 'Unsuported')
	}

	const {
		data: ticket,
		isLoading: isTicketLoading,
		error: ticketError,
		mutate: refreshTicket,
		isValidating: isTicketValidating,
	} = useSWR(`${API_URL}/ticket`, getTicket, {
		refreshInterval: 1000 * 60 * 4, // 4 minutes
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		onError: (error: Error) => {
			handleError('Ticket Error', error.message)
		},
	})

	useEffect(() => {
		if (turnstile && ticket?.verificationRequired) {
			setIsVerifying(true)
			turnstile.execute()
		}
	}, [turnstile, ticket])

	const {
		data: dropData,
		trigger: dropTrigger,
		isMutating: isDropping,
		error: dropError,
		reset: resetDrop,
	} = useSWRMutation(`${API_URL}/drop`, drop, {
		onError: (error: Error) => {
			handleError('Error Sending', error.message)
		},
	})

	const refresh = async () => {
		setError(null)
		resetDrop()
		await refreshTicket()
	}

	const handleDrop = useCallback(
		async (account: string): Promise<void> => {
			if (!checkAddress(account)) {
				handleError('Error Sending', 'Invalid account!')
				return
			}
			if (!ticket) {
				handleError('Error Sending', 'Ticket is not ready!')
				return
			}
			if (ticket.verificationRequired && !turnstileToken) {
				handleError('Error Sending', 'Verification missing!')
				turnstile?.reset()
				return
			}
			dropTrigger({ account, ticket: ticket.ticket, turnstileToken })
		},
		[ticket, turnstileToken],
	)

	const Verification = () => {
		return (
			<Turnstile
				execution="execute"
				sitekey={TURNSTILE_KEY as string}
				onVerify={handleTurstileVerified}
				onExpire={(_, turnstile) => handleTurnstileExpired(turnstile)}
				onError={handleTurnstileError}
				onTimeout={handleTurnstileExpired}
				onUnsupported={handleTurnstileUnsupported}
			/>
		)
	}

	return {
		isReady: !isTicketLoading,
		isLoading: isTicketLoading,
		ticketError,
		amount: ticket?.amount,
		expiresAt: ticket?.expiresAt,
		drop: handleDrop,
		isDropping,
		dropError,
		dropData,
		isSent: !!dropData,
		isVerifying,
		isVerified,
		Verification,
		isError: !!error,
		error,
		refresh,
		isRefreshing: !isTicketLoading && isTicketValidating,
	}
}
