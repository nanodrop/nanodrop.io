import { API_URL, TURNSTILE_KEY } from '@/config'
import { checkAddress, checkAmount, checkHash } from 'nanocurrency'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile'
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

	const turnstile = useRef<TurnstileInstance>(null)

	const logger = useMemo(() => new Logger('USE_FAUCET', debug), [debug])

	const handleError = (title: string, message: string) => {
		setError({ title, message })
		logger.error(`${title}: ${message}`)
	}

	const handleTurstileVerified = (token: string) => {
		logger.info('TURNSTILE VERIFIED')
		setIsVerifying(false)
		setIsVerified(true)
		setTurnstileToken(token)
	}

	const handleTurnstileExpired = () => {
		logger.warn('Turnstile expired')
		setIsVerified(false)
		setTurnstileToken('')
		turnstile.current?.reset()
	}

	const handleTurnstileError = () => {
		handleError('Verification Error', 'Check your network')
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
		if (!ticket?.verificationRequired) return
		if (isVerifying || isVerified) return
		if (turnstile.current) {
			logger.info('Turnstile verifying')
			setIsVerifying(true)
			turnstile.current.execute()
		} else {
			handleError('Verification Error', 'Turnstile not rendered')
		}
	}, [turnstile.current, ticket, isVerifying])

	const {
		data: dropData,
		trigger: dropTrigger,
		isMutating: isDropping,
		error: dropError,
		reset: resetDrop,
	} = useSWRMutation(`${API_URL}/drop`, drop, {
		onSuccess: data => {
			logger.info(
				`Dropped ${data.amount} to ${data.account} with hash ${data.hash}`,
			)
		},
		onError: (error: Error) => {
			handleError('Error Sending', error.message)
		},
	})

	const refresh = async () => {
		logger.info('Refreshing')
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
				turnstile.current?.reset()
				return
			}
			logger.info(
				`Dropping ${ticket.amount} to ${account} with ticket ${ticket.ticket}`,
			)
			dropTrigger({ account, ticket: ticket.ticket, turnstileToken })
		},
		[ticket, turnstileToken],
	)

	const Verification = useCallback(() => {
		return (
			<Turnstile
				options={{
					execution: 'execute',
					size: 'invisible',
				}}
				siteKey={TURNSTILE_KEY as string}
				onSuccess={handleTurstileVerified}
				onExpire={handleTurnstileExpired}
				onError={handleTurnstileError}
				onUnsupported={handleTurnstileUnsupported}
				ref={turnstile}
			/>
		)
	}, [])

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
