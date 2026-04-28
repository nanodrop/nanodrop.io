import { API_URL } from '@/config'
import { checkAddress, checkAmount, checkHash } from 'nanocurrency'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Logger from '@/lib/logger'
import HCaptcha from '@hcaptcha/react-hcaptcha'

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
	captchaToken?: string
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

interface ApiErrorBody {
	message?: string
	error?: string
}

interface DropResponseBody {
	hash: string
	amount: string
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
			const body = (await response.json()) as ApiErrorBody
			if (typeof body.message === 'string') {
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
	{ arg: { account, ticket, captchaToken } }: { arg: DropRequest },
): Promise<DropData> => {
	const response = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({ account, ticket, captchaToken }),
		headers: {
			'Content-Type': 'application/json',
		},
	})
	if (response.ok) {
		const data = (await response.json()) as DropResponseBody
		if (!checkHash(data.hash) || !checkAmount(data.amount)) {
			throw new Error('invalid response')
		}
		return { hash: data.hash, amount: data.amount, account }
	} else {
		let message = response.statusText
		try {
			const body = (await response.json()) as ApiErrorBody
			if (typeof body.message === 'string') {
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
	const [captchaToken, setCaptchaToken] = useState('')
	const [isCaptchaRendered, setIsCaptchaRendered] = useState(false)
	const [error, setError] = useState<FaucetError | null>(null)
	const [account, setAccount] = useState('')

	const captchaRef = useRef<HCaptcha>(null)

	const logger = useMemo(() => new Logger('USE_FAUCET', debug), [debug])

	const handleError = useCallback(
		(title: string, message: string) => {
			setError({ title, message })
			logger.error(`${title}: ${message}`)
		},
		[logger],
	)

	const onCaptchaLoad = useCallback(() => {
		setIsCaptchaRendered(true)
	}, [])

	const handleCaptchaVerify = useCallback(() => {
		setIsVerifying(true)
		captchaRef.current?.execute()
	}, [])

	const handleCaptchaVerified = useCallback(
		(token: string) => {
			logger.info('CAPTCHA VERIFIED')
			setIsVerifying(false)
			setIsVerified(true)
			setCaptchaToken(token)
		},
		[logger],
	)

	const handleCaptchaExpired = useCallback(() => {
		logger.warn('Captcha expired')
		setIsVerified(false)
		setCaptchaToken('')
	}, [logger])

	const handleCaptchaClosed = useCallback(() => {
		logger.warn('Captcha closed')
		setIsVerified(false)
		setCaptchaToken('')
	}, [logger])

	const handleCaptchaError = useCallback(() => {
		handleError('Verification Error', 'Check your network')
	}, [handleError])

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
			if (ticket.verificationRequired && !captchaToken) {
				setAccount(account)
				handleCaptchaVerify()
			} else {
				logger.info(
					`Dropping ${ticket.amount} to ${account} with ticket ${ticket.ticket}`,
				)
				dropTrigger({ account, ticket: ticket.ticket, captchaToken })
			}
		},
		[captchaToken, dropTrigger, handleCaptchaVerify, handleError, logger, ticket],
	)

	useEffect(() => {
		if (captchaToken && account) {
			void handleDrop(account)
		}
	}, [captchaToken, account, handleDrop])

	const Verification = useCallback(() => {
		return (
			<HCaptcha
				size="invisible"
				sitekey="96ef271f-d9f1-4d96-a362-d4b3921f6c33"
				onLoad={onCaptchaLoad}
				onVerify={handleCaptchaVerified}
				onClose={handleCaptchaClosed}
				onError={handleCaptchaError}
				onExpire={handleCaptchaExpired}
				onChalExpired={handleCaptchaExpired}
				ref={captchaRef}
			/>
		)
	}, [
		handleCaptchaClosed,
		handleCaptchaError,
		handleCaptchaExpired,
		handleCaptchaVerified,
		onCaptchaLoad,
	])

	return {
		isReady: !isTicketLoading,
		isLoading:
			isTicketLoading || (ticket?.verificationRequired && !isCaptchaRendered),
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
