import { API_URL } from '@/config'
import { checkAddress, checkAmount, checkHash } from 'nanocurrency'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import Logger from '@/lib/logger'
import HCaptcha from '@hcaptcha/react-hcaptcha'

export interface FaucetStatus {
	amount: string
	amountNano: string
	verificationRequired: boolean
}

export interface DropRequest {
	account: string
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
	account?: string
	debug?: boolean
}

const getErrorMessage = async (response: Response) => {
	let message = response.statusText

	try {
		const body = (await response.json()) as ApiErrorBody
		if (typeof body.message === 'string') {
			message = body.message
		} else if ('error' in body && typeof body.error === 'string') {
			message = body.error
		}
	} catch {}

	return message
}

// TODO: Move error handle logic to a fetcher
const getFaucetStatus = async (url: string): Promise<FaucetStatus> => {
	const response = await fetch(url)
	if (response.ok) {
		return await response.json()
	}

	throw new Error(await getErrorMessage(response))
}

// TODO: Move error handle logic to a fetcher
const drop = async (
	url: string,
	{ arg: { account, captchaToken } }: { arg: DropRequest },
): Promise<DropData> => {
	const response = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({ account, captchaToken }),
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
	}

	throw new Error(await getErrorMessage(response))
}

const getStatusUrl = (account?: string) => {
	if (account && checkAddress(account)) {
		return `${API_URL}/status?account=${encodeURIComponent(account)}`
	}

	return `${API_URL}/status`
}

export default function useFaucet({
	account: activeAccount,
	debug = true,
}: UseFaucetProps = {}) {
	const [isVerified, setIsVerified] = useState(false)
	const [isVerifying, setIsVerifying] = useState(false)
	const [captchaToken, setCaptchaToken] = useState('')
	const [isCaptchaRendered, setIsCaptchaRendered] = useState(false)
	const [error, setError] = useState<FaucetError | null>(null)
	const [pendingAccount, setPendingAccount] = useState('')

	const captchaRef = useRef<HCaptcha>(null)

	const logger = useMemo(() => new Logger('USE_FAUCET', debug), [debug])
	const statusUrl = useMemo(() => getStatusUrl(activeAccount), [activeAccount])

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
		data: status,
		isLoading: isStatusLoading,
		error: statusError,
		mutate: mutateStatus,
		isValidating: isStatusValidating,
	} = useSWR(statusUrl, getFaucetStatus, {
		revalidateOnFocus: false,
		revalidateOnReconnect: false,
		onError: (error: Error) => {
			handleError('Status Error', error.message)
		},
		onSuccess: () => {
			setError(error => (error?.title === 'Status Error' ? null : error))
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
		await mutateStatus()
	}

	const handleDrop = useCallback(
		async (account: string): Promise<void> => {
			if (!checkAddress(account)) {
				handleError('Error Sending', 'Invalid account!')
				return
			}

			let currentStatus: FaucetStatus
			try {
				currentStatus = await getFaucetStatus(getStatusUrl(account))
				await mutateStatus(currentStatus, { revalidate: false })
				setError(error => (error?.title === 'Status Error' ? null : error))
			} catch (error) {
				handleError(
					'Status Error',
					error instanceof Error
						? error.message
						: 'Unable to check faucet status',
				)
				return
			}

			if (currentStatus.verificationRequired && !captchaToken) {
				setPendingAccount(account)
				handleCaptchaVerify()
			} else {
				logger.info(`Dropping ${currentStatus.amount} to ${account}`)
				dropTrigger({ account, captchaToken })
			}
		},
		[
			captchaToken,
			dropTrigger,
			handleCaptchaVerify,
			handleError,
			logger,
			mutateStatus,
		],
	)

	useEffect(() => {
		if (captchaToken && pendingAccount) {
			void handleDrop(pendingAccount)
		}
	}, [captchaToken, pendingAccount, handleDrop])

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
		isReady: !isStatusLoading,
		isLoading:
			isStatusLoading || (status?.verificationRequired && !isCaptchaRendered),
		statusError,
		amount: status?.amount,
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
		isRefreshing: !isStatusLoading && isStatusValidating,
	}
}
