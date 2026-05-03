'use client'

import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowRightOnRectangleIcon,
	CheckCircleIcon,
	Cog6ToothIcon,
	InformationCircleIcon,
	KeyIcon,
	NoSymbolIcon,
	PlusIcon,
	ShieldCheckIcon,
	TrashIcon,
	WalletIcon,
	XCircleIcon,
} from '@heroicons/react/24/solid'
import { Unit, convert } from 'nanocurrency'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

import Countries from '../drops/_assets/countries.json'

type WalletState = {
	account: string
	balance: string
	receivable: string
	frontier?: string
	representative?: string
	proofOfWork: 'cached' | 'pending'
}

type Drop = {
	hash: string
	account: string
	amount: string
	ip: string
	took: number
	timestamp: number
	country_code: string
	is_proxy: boolean
}

type AdminAnalytics = {
	generatedAt: number
	totalDrops: number
	last24hDrops: number
	last7dDrops: number
	uniqueAccounts: number
	uniqueIps: number
	proxyDrops: number
	avgTookMs: number
	topCountries: Array<{ country_code: string; count: number }>
	dailyDrops: Array<{ day: string; count: number }>
	recentDrops: Drop[]
	wallet: WalletState
	adminState: {
		ipWhitelistCount: number
		accountWhitelistCount: number
		ipBlacklistCount: number
		accountBlacklistCount: number
	}
}

type SessionResponse = {
	authenticated: boolean
	expiresIn: number
}

type ReceivableValue = {
	amount?: string
	balance?: string
	blockHash?: string
	link?: string
	hash?: string
	[key: string]: unknown
}

type ReceivablePayload = Record<string, ReceivableValue> | ReceivableValue[]
type ReceivableConfig = {
	minReceivableAmount: string
	minReceivableAmountRaw: string
}
type FaucetConfig = {
	minDropAmount: string
	maxDropAmount: string
	divideBalanceBy: number
	periodDays: number
	periodMs: number
	maxDropPerIpSimultaneously: number
	maxDropsPerAccount: number
	maxDropsPerIp: number
	maxDropsPerProxyIp: number
	maxDropsPerIpInLimitedCountry: number
	verificationRequiredByDefault: boolean
	verifyWhenProxy: boolean
	banProxies: boolean
	proxyAmountDivideBy: number
	limitedCountries: string[]
}
type WalletNetworkConfig = {
	rpcUrls: string[]
	workerUrls: string[]
	representative: string
}
type FaucetConfigInputs = {
	minDropAmount: string
	maxDropAmount: string
	divideBalanceBy: string
	periodDays: string
	maxDropPerIpSimultaneously: string
	maxDropsPerAccount: string
	maxDropsPerIp: string
	maxDropsPerProxyIp: string
	maxDropsPerIpInLimitedCountry: string
	verificationRequiredByDefault: boolean
	verifyWhenProxy: boolean
	banProxies: boolean
	proxyAmountDivideBy: string
	limitedCountries: string
}
type WalletNetworkConfigInputs = {
	rpcUrls: string
	workerUrls: string
	representative: string
}
type ReceivableItem = {
	key: string
	link: string
	amount?: string
	value: ReceivableValue
}

type RequestOptions = Omit<RequestInit, 'body'> & {
	body?: unknown
}

const EMPTY_FAUCET_CONFIG_INPUTS: FaucetConfigInputs = {
	minDropAmount: '',
	maxDropAmount: '',
	divideBalanceBy: '',
	periodDays: '',
	maxDropPerIpSimultaneously: '',
	maxDropsPerAccount: '',
	maxDropsPerIp: '',
	maxDropsPerProxyIp: '',
	maxDropsPerIpInLimitedCountry: '',
	verificationRequiredByDefault: false,
	verifyWhenProxy: false,
	banProxies: false,
	proxyAmountDivideBy: '',
	limitedCountries: '',
}
const EMPTY_WALLET_NETWORK_CONFIG_INPUTS: WalletNetworkConfigInputs = {
	rpcUrls: '',
	workerUrls: '',
	representative: '',
}
const RECEIVABLES_PAGE_SIZE = 10
const countryNames = Countries as Record<string, string>

const jsonRequest = async <T,>(url: string, options: RequestOptions = {}) => {
	const headers = new Headers(options.headers)
	if (options.body !== undefined) {
		headers.set('content-type', 'application/json')
	}

	const response = await fetch(url, {
		...options,
		headers,
		credentials: 'same-origin',
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	})
	const payload = (await response.json().catch(() => null)) as
		| { error?: string; message?: string }
		| T
		| null
	const payloadObject =
		payload && typeof payload === 'object'
			? (payload as { error?: string; message?: string })
			: null

	if (!response.ok) {
		const message =
			payloadObject && typeof payloadObject.error === 'string'
				? payloadObject.error
				: payloadObject && typeof payloadObject.message === 'string'
					? payloadObject.message
					: response.statusText
		throw new Error(message || 'Request failed')
	}

	return payload as T
}

const faucetRequest = <T,>(path: string, options: RequestOptions = {}) =>
	jsonRequest<T>(`/api/admin/faucet${path}`, options)

const formatInteger = (value: number) =>
	new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatMs = (value: number) =>
	`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
		value || 0,
	)} ms`

const formatNano = (raw?: string) => {
	if (!raw) return '0 XNO'

	try {
		const nano = convert(raw, { from: Unit.raw, to: Unit.NANO })
		const numeric = Number(nano)
		if (Number.isFinite(numeric)) {
			return `${new Intl.NumberFormat('en-US', {
				maximumFractionDigits: 6,
			}).format(numeric)} XNO`
		}

		return `${nano} XNO`
	} catch {
		return raw
	}
}

const formatDateTime = (timestamp: number) =>
	new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(timestamp))

const formatCountryCodes = (countries: string[]) => {
	if (countries.length === 0) return 'None'

	return countries
		.map(country => {
			const name = countryNames[country]
			return name ? `${name} (${country})` : country
		})
		.join(', ')
}

const parseCountryCodesInput = (value: string) =>
	Array.from(
		new Set(
			value
				.split(/[\s,;]+/)
				.map(country => country.trim().toUpperCase())
				.filter(Boolean),
		),
	)

const resolveUrlListInput = (value: string) =>
	Array.from(
		new Set(
			value
				.split(/[,\n]+/)
				.map(url => url.trim())
				.filter(Boolean),
		),
	)

const resolveReceivableItems = (receivables: ReceivablePayload | null) => {
	if (!receivables) return []

	const toItem = (
		value: ReceivableValue,
		fallbackKey: string,
	): ReceivableItem => {
		const link = value.blockHash || value.link || value.hash || fallbackKey

		return {
			key: link,
			link,
			amount: value.amount || value.balance,
			value,
		}
	}

	const sortByAmountDesc = (left: ReceivableItem, right: ReceivableItem) => {
		const leftAmount = parseRawAmount(left.amount)
		const rightAmount = parseRawAmount(right.amount)

		if (leftAmount > rightAmount) return -1
		if (leftAmount < rightAmount) return 1

		return left.link.localeCompare(right.link)
	}

	if (Array.isArray(receivables)) {
		return receivables
			.map((value, index) => toItem(value, String(index)))
			.sort(sortByAmountDesc)
	}

	return Object.entries(receivables)
		.map(([key, value]) => toItem(value, key))
		.sort(sortByAmountDesc)
}

const parseRawAmount = (amount?: string) => {
	if (!amount || !/^\d+$/.test(amount)) return BigInt(0)

	try {
		return BigInt(amount)
	} catch {
		return BigInt(0)
	}
}

const resolveFaucetConfigInputs = (
	config: FaucetConfig | null,
): FaucetConfigInputs => {
	if (!config) return EMPTY_FAUCET_CONFIG_INPUTS

	return {
		minDropAmount: config.minDropAmount,
		maxDropAmount: config.maxDropAmount,
		divideBalanceBy: String(config.divideBalanceBy),
		periodDays: String(config.periodDays),
		maxDropPerIpSimultaneously: String(config.maxDropPerIpSimultaneously),
		maxDropsPerAccount: String(config.maxDropsPerAccount),
		maxDropsPerIp: String(config.maxDropsPerIp),
		maxDropsPerProxyIp: String(config.maxDropsPerProxyIp),
		maxDropsPerIpInLimitedCountry: String(config.maxDropsPerIpInLimitedCountry),
		verificationRequiredByDefault: config.verificationRequiredByDefault,
		verifyWhenProxy: config.verifyWhenProxy,
		banProxies: config.banProxies,
		proxyAmountDivideBy: String(config.proxyAmountDivideBy),
		limitedCountries: config.limitedCountries.join(', '),
	}
}

const resolveWalletNetworkConfigInputs = (
	config: WalletNetworkConfig | null,
): WalletNetworkConfigInputs => {
	if (!config) return EMPTY_WALLET_NETWORK_CONFIG_INPUTS

	return {
		rpcUrls: config.rpcUrls.join('\n'),
		workerUrls: config.workerUrls.join('\n'),
		representative: config.representative,
	}
}

function InfoTooltip({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	const [open, setOpen] = useState(false)

	return (
		<span className="relative inline-flex">
			<button
				type="button"
				aria-label={`About ${label}`}
				aria-expanded={open}
				onClick={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onFocus={() => setOpen(true)}
				onMouseEnter={() => setOpen(true)}
				onMouseLeave={() => setOpen(false)}
				className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:text-nano focus:outline-none focus:ring-2 focus:ring-nano/30 dark:text-zinc-500 dark:hover:text-sky-300"
			>
				<InformationCircleIcon className="h-5 w-5" />
			</button>
			<span
				role="tooltip"
				className={`pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium normal-case leading-5 text-slate-600 shadow-lg transition dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300 ${
					open ? 'visible opacity-100' : 'invisible opacity-0'
				}`}
			>
				{children}
			</span>
		</span>
	)
}

function CardTitle({
	title,
	description,
}: {
	title: string
	description?: React.ReactNode
}) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
				{title}
			</h2>
			{description && <InfoTooltip label={title}>{description}</InfoTooltip>}
		</div>
	)
}

function Metric({
	label,
	value,
	accent,
	description,
}: {
	label: string
	value: string
	accent: string
	description?: React.ReactNode
}) {
	return (
		<div
			className={`rounded-md border border-slate-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-800 dark:bg-midnight-2 ${accent}`}
		>
			<div className="flex min-w-0 items-center gap-1.5 text-[0.68rem] font-semibold uppercase leading-4 text-slate-500 sm:text-xs dark:text-zinc-500">
				<span>{label}</span>
				{description && <InfoTooltip label={label}>{description}</InfoTooltip>}
			</div>
			<div className="mt-2 break-words text-xl font-semibold text-slate-900 sm:text-2xl dark:text-zinc-100">
				{value}
			</div>
		</div>
	)
}

function IconButton({
	children,
	disabled,
	type = 'button',
	variant = 'primary',
	onClick,
}: {
	children: React.ReactNode
	disabled?: boolean
	type?: 'button' | 'submit'
	variant?: 'primary' | 'neutral' | 'danger'
	onClick?: () => void
}) {
	const styles = {
		primary:
			'border-nano bg-nano text-white enabled:hover:border-sky-600 enabled:hover:bg-sky-600',
		neutral:
			'border-slate-300 bg-white text-slate-700 enabled:hover:border-nano enabled:hover:text-nano dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300',
		danger:
			'border-rose-200 bg-rose-50 text-rose-700 enabled:hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300',
	}

	return (
		<button
			type={type}
			disabled={disabled}
			onClick={onClick}
			className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 ${styles[variant]}`}
		>
			{children}
		</button>
	)
}

function ConfigInput({
	id,
	label,
	value,
	onChange,
	min,
	max,
	step,
	suffix,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	min?: string
	max?: string
	step?: string
	suffix?: string
}) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
			>
				{label}
			</label>
			<div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:border-nano focus-within:ring-2 focus-within:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1">
				<input
					id={id}
					type="number"
					inputMode="decimal"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={event => onChange(event.target.value)}
					className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-3 text-slate-900 outline-none dark:text-zinc-100"
				/>
				{suffix && (
					<span className="px-3 text-sm font-semibold text-slate-500 dark:text-zinc-500">
						{suffix}
					</span>
				)}
			</div>
		</div>
	)
}

function ConfigTextarea({
	id,
	label,
	value,
	onChange,
	placeholder,
	rows = 3,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	rows?: number
}) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
			>
				{label}
			</label>
			<textarea
				id={id}
				value={value}
				onChange={event => onChange(event.target.value)}
				rows={rows}
				placeholder={placeholder}
				className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
			/>
		</div>
	)
}

function ConfigToggle({
	id,
	label,
	checked,
	onChange,
}: {
	id: string
	label: string
	checked: boolean
	onChange: (checked: boolean) => void
}) {
	return (
		<label
			htmlFor={id}
			className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300"
		>
			<span>{label}</span>
			<input
				id={id}
				type="checkbox"
				checked={checked}
				onChange={event => onChange(event.target.checked)}
				className="h-5 w-5 rounded border-slate-300 text-nano focus:ring-nano dark:border-zinc-700"
			/>
		</label>
	)
}

function Panel({
	title,
	children,
	actions,
	description,
}: {
	title: string
	children: React.ReactNode
	actions?: React.ReactNode
	description?: React.ReactNode
}) {
	return (
		<section className="w-full min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-midnight-2">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<CardTitle title={title} description={description} />
				{actions}
			</div>
			{children}
		</section>
	)
}

export default function AdminDashboard() {
	const [ready, setReady] = useState(false)
	const [authenticated, setAuthenticated] = useState(false)
	const [token, setToken] = useState('')
	const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
	const [receivables, setReceivables] = useState<ReceivablePayload | null>(null)
	const [receivableConfig, setReceivableConfig] =
		useState<ReceivableConfig | null>(null)
	const [receivableConfigOpen, setReceivableConfigOpen] = useState(false)
	const [minReceivableAmountInput, setMinReceivableAmountInput] = useState('')
	const [faucetConfig, setFaucetConfig] = useState<FaucetConfig | null>(null)
	const [faucetConfigOpen, setFaucetConfigOpen] = useState(false)
	const [faucetConfigInputs, setFaucetConfigInputs] =
		useState<FaucetConfigInputs>(EMPTY_FAUCET_CONFIG_INPUTS)
	const [walletNetworkConfig, setWalletNetworkConfig] =
		useState<WalletNetworkConfig | null>(null)
	const [walletNetworkConfigOpen, setWalletNetworkConfigOpen] = useState(false)
	const [walletNetworkConfigInputs, setWalletNetworkConfigInputs] =
		useState<WalletNetworkConfigInputs>(EMPTY_WALLET_NETWORK_CONFIG_INPUTS)
	const [receivablePage, setReceivablePage] = useState(0)
	const [ipWhitelist, setIpWhitelist] = useState<string[]>([])
	const [accountWhitelist, setAccountWhitelist] = useState<string[]>([])
	const [ipBlacklist, setIpBlacklist] = useState<string[]>([])
	const [accountBlacklist, setAccountBlacklist] = useState<string[]>([])
	const [ipInput, setIpInput] = useState('')
	const [accountInput, setAccountInput] = useState('')
	const [blockedIpInput, setBlockedIpInput] = useState('')
	const [blockedAccountInput, setBlockedAccountInput] = useState('')
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [syncing, setSyncing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [dropActionTarget, setDropActionTarget] = useState<Drop | null>(null)

	const loadDashboard = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const [
				analyticsData,
				receivableData,
				receivableConfigData,
				faucetConfigData,
				walletNetworkConfigData,
				ipData,
				accountData,
				blockedIpData,
				blockedAccountData,
			] = await Promise.all([
				faucetRequest<AdminAnalytics>('/analytics'),
				faucetRequest<ReceivablePayload>('/wallet/receivables'),
				faucetRequest<ReceivableConfig>('/wallet/receivables/config'),
				faucetRequest<FaucetConfig>('/config'),
				faucetRequest<WalletNetworkConfig>('/wallet/network-config'),
				faucetRequest<string[]>('/whitelist/ip'),
				faucetRequest<string[]>('/whitelist/account'),
				faucetRequest<string[]>('/blacklist/ip'),
				faucetRequest<string[]>('/blacklist/account'),
			])

			setAnalytics(analyticsData)
			setReceivables(receivableData)
			setReceivableConfig(receivableConfigData)
			setMinReceivableAmountInput(receivableConfigData.minReceivableAmount)
			setFaucetConfig(faucetConfigData)
			setFaucetConfigInputs(resolveFaucetConfigInputs(faucetConfigData))
			setWalletNetworkConfig(walletNetworkConfigData)
			setWalletNetworkConfigInputs(
				resolveWalletNetworkConfigInputs(walletNetworkConfigData),
			)
			setIpWhitelist(ipData)
			setAccountWhitelist(accountData)
			setIpBlacklist(blockedIpData)
			setAccountBlacklist(blockedAccountData)
		} catch (requestError) {
			const message =
				requestError instanceof Error ? requestError.message : 'Request failed'
			setError(message)
			if (message === 'Unauthorized') {
				setAuthenticated(false)
			}
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		let ignore = false

		jsonRequest<SessionResponse>('/api/admin/session')
			.then(session => {
				if (ignore) return
				setAuthenticated(session.authenticated)
				if (session.authenticated) {
					void loadDashboard()
				}
			})
			.catch(() => {
				if (!ignore) setAuthenticated(false)
			})
			.finally(() => {
				if (!ignore) setReady(true)
			})

		return () => {
			ignore = true
		}
	}, [loadDashboard])

	const receivableItems = useMemo(
		() => resolveReceivableItems(receivables),
		[receivables],
	)
	const receivablePageCount = Math.max(
		1,
		Math.ceil(receivableItems.length / RECEIVABLES_PAGE_SIZE),
	)
	const paginatedReceivableItems = receivableItems.slice(
		receivablePage * RECEIVABLES_PAGE_SIZE,
		receivablePage * RECEIVABLES_PAGE_SIZE + RECEIVABLES_PAGE_SIZE,
	)
	const receivableStart =
		receivableItems.length === 0
			? 0
			: receivablePage * RECEIVABLES_PAGE_SIZE + 1
	const receivableEnd = Math.min(
		receivableItems.length,
		(receivablePage + 1) * RECEIVABLES_PAGE_SIZE,
	)
	const maxCountryDrops = Math.max(
		1,
		...(analytics?.topCountries.map(country => country.count) || []),
	)
	const maxDailyDrops = Math.max(
		1,
		...(analytics?.dailyDrops.map(day => day.count) || []),
	)

	useEffect(() => {
		if (receivablePage > receivablePageCount - 1) {
			setReceivablePage(receivablePageCount - 1)
		}
	}, [receivablePage, receivablePageCount])

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setSubmitting(true)
		setError(null)

		try {
			await jsonRequest<SessionResponse>('/api/admin/session', {
				method: 'POST',
				body: { token },
			})
			setAuthenticated(true)
			setToken('')
			await loadDashboard()
		} catch (requestError) {
			setError(
				requestError instanceof Error ? requestError.message : 'Unauthorized',
			)
		} finally {
			setSubmitting(false)
		}
	}

	const handleLogout = async () => {
		await jsonRequest('/api/admin/session', { method: 'DELETE' }).catch(
			() => {},
		)
		setAuthenticated(false)
		setAnalytics(null)
		setReceivables(null)
		setReceivableConfig(null)
		setReceivableConfigOpen(false)
		setMinReceivableAmountInput('')
		setFaucetConfig(null)
		setFaucetConfigOpen(false)
		setFaucetConfigInputs(EMPTY_FAUCET_CONFIG_INPUTS)
		setWalletNetworkConfig(null)
		setWalletNetworkConfigOpen(false)
		setWalletNetworkConfigInputs(EMPTY_WALLET_NETWORK_CONFIG_INPUTS)
		setReceivablePage(0)
		setIpWhitelist([])
		setAccountWhitelist([])
		setIpBlacklist([])
		setAccountBlacklist([])
		setIpInput('')
		setAccountInput('')
		setBlockedIpInput('')
		setBlockedAccountInput('')
		setDropActionTarget(null)
		setNotice(null)
		setError(null)
	}

	const runAction = async (action: () => Promise<void>, message: string) => {
		setSubmitting(true)
		setError(null)
		setNotice(null)

		try {
			await action()
			setNotice(message)
			await loadDashboard()
		} catch (requestError) {
			setError(
				requestError instanceof Error ? requestError.message : 'Request failed',
			)
		} finally {
			setSubmitting(false)
		}
	}

	const openReceivableConfig = () => {
		setMinReceivableAmountInput(receivableConfig?.minReceivableAmount || '')
		setReceivableConfigOpen(true)
	}

	const saveReceivableConfig = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const minReceivableAmount = minReceivableAmountInput.trim()

		await runAction(async () => {
			const config = await faucetRequest<ReceivableConfig>(
				'/wallet/receivables/config',
				{
					method: 'PUT',
					body: { minReceivableAmount },
				},
			)
			setReceivableConfig(config)
			setMinReceivableAmountInput(config.minReceivableAmount)
			setReceivablePage(0)
			setReceivableConfigOpen(false)
		}, 'Receivable config updated')
	}

	const updateFaucetConfigInput = <Field extends keyof FaucetConfigInputs>(
		field: Field,
		value: FaucetConfigInputs[Field],
	) => {
		setFaucetConfigInputs(inputs => ({ ...inputs, [field]: value }))
	}

	const openFaucetConfig = () => {
		setFaucetConfigInputs(resolveFaucetConfigInputs(faucetConfig))
		setFaucetConfigOpen(true)
	}

	const faucetConfigInputComplete = (
		[
			'minDropAmount',
			'maxDropAmount',
			'divideBalanceBy',
			'periodDays',
			'maxDropPerIpSimultaneously',
			'maxDropsPerAccount',
			'maxDropsPerIp',
			'maxDropsPerProxyIp',
			'maxDropsPerIpInLimitedCountry',
			'proxyAmountDivideBy',
		] as const
	).every(field => faucetConfigInputs[field].trim().length > 0)

	const saveFaucetConfig = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		await runAction(async () => {
			const config = await faucetRequest<FaucetConfig>('/config', {
				method: 'PUT',
				body: {
					minDropAmount: faucetConfigInputs.minDropAmount.trim(),
					maxDropAmount: faucetConfigInputs.maxDropAmount.trim(),
					divideBalanceBy: faucetConfigInputs.divideBalanceBy.trim(),
					periodDays: faucetConfigInputs.periodDays.trim(),
					maxDropPerIpSimultaneously:
						faucetConfigInputs.maxDropPerIpSimultaneously.trim(),
					maxDropsPerAccount: faucetConfigInputs.maxDropsPerAccount.trim(),
					maxDropsPerIp: faucetConfigInputs.maxDropsPerIp.trim(),
					maxDropsPerProxyIp: faucetConfigInputs.maxDropsPerProxyIp.trim(),
					maxDropsPerIpInLimitedCountry:
						faucetConfigInputs.maxDropsPerIpInLimitedCountry.trim(),
					verificationRequiredByDefault:
						faucetConfigInputs.verificationRequiredByDefault,
					verifyWhenProxy: faucetConfigInputs.verifyWhenProxy,
					banProxies: faucetConfigInputs.banProxies,
					proxyAmountDivideBy: faucetConfigInputs.proxyAmountDivideBy.trim(),
					limitedCountries: parseCountryCodesInput(
						faucetConfigInputs.limitedCountries,
					),
				},
			})
			setFaucetConfig(config)
			setFaucetConfigInputs(resolveFaucetConfigInputs(config))
			setFaucetConfigOpen(false)
		}, 'Faucet config updated')
	}

	const updateWalletNetworkConfigInput = <
		Field extends keyof WalletNetworkConfigInputs,
	>(
		field: Field,
		value: WalletNetworkConfigInputs[Field],
	) => {
		setWalletNetworkConfigInputs(inputs => ({ ...inputs, [field]: value }))
	}

	const openWalletNetworkConfig = () => {
		setWalletNetworkConfigInputs(
			resolveWalletNetworkConfigInputs(walletNetworkConfig),
		)
		setWalletNetworkConfigOpen(true)
	}

	const walletNetworkConfigInputComplete =
		resolveUrlListInput(walletNetworkConfigInputs.rpcUrls).length > 0 &&
		resolveUrlListInput(walletNetworkConfigInputs.workerUrls).length > 0 &&
		walletNetworkConfigInputs.representative.trim().length > 0

	const saveWalletNetworkConfig = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		await runAction(async () => {
			const config = await faucetRequest<WalletNetworkConfig>(
				'/wallet/network-config',
				{
					method: 'PUT',
					body: {
						rpcUrls: resolveUrlListInput(walletNetworkConfigInputs.rpcUrls),
						workerUrls: resolveUrlListInput(
							walletNetworkConfigInputs.workerUrls,
						),
						representative: walletNetworkConfigInputs.representative.trim(),
					},
				},
			)
			setWalletNetworkConfig(config)
			setWalletNetworkConfigInputs(resolveWalletNetworkConfigInputs(config))
			setWalletNetworkConfigOpen(false)
		}, 'Wallet network config updated')
	}

	const syncWallet = async () => {
		setSyncing(true)
		try {
			await runAction(
				() =>
					faucetRequest('/wallet/sync', {
						method: 'POST',
					}),
				'Wallet synced',
			)
		} finally {
			setSyncing(false)
		}
	}

	const addIp = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const ip = ipInput.trim()
		if (!ip) return

		await runAction(async () => {
			await faucetRequest(`/whitelist/ip/${encodeURIComponent(ip)}`, {
				method: 'PUT',
			})
			setIpInput('')
		}, 'IP whitelist updated')
	}

	const addAccount = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const account = accountInput.trim()
		if (!account) return

		await runAction(async () => {
			await faucetRequest(`/whitelist/account/${encodeURIComponent(account)}`, {
				method: 'PUT',
			})
			setAccountInput('')
		}, 'Account whitelist updated')
	}

	const addBlockedIp = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const ip = blockedIpInput.trim()
		if (!ip) return

		await blockIp(ip)
	}

	const addBlockedAccount = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const account = blockedAccountInput.trim()
		if (!account) return

		await blockAccount(account)
	}

	const blockIp = async (ip: string) => {
		await runAction(async () => {
			await faucetRequest(`/blacklist/ip/${encodeURIComponent(ip)}`, {
				method: 'PUT',
			})
			setBlockedIpInput('')
		}, 'IP blacklist updated')
	}

	const blockAccount = async (account: string) => {
		await runAction(async () => {
			await faucetRequest(`/blacklist/account/${encodeURIComponent(account)}`, {
				method: 'PUT',
			})
			setBlockedAccountInput('')
		}, 'Account blacklist updated')
	}

	const blockSelectedDropIp = async () => {
		if (!dropActionTarget) return

		await blockIp(dropActionTarget.ip)
		setDropActionTarget(null)
	}

	const blockSelectedDropAccount = async () => {
		if (!dropActionTarget) return

		await blockAccount(dropActionTarget.account)
		setDropActionTarget(null)
	}

	if (!ready) {
		return (
			<div className="flex min-h-[60vh] w-full items-center justify-center">
				<ArrowPathIcon className="h-8 w-8 animate-spin text-nano" />
			</div>
		)
	}

	if (!authenticated) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-4 py-10">
				<form
					onSubmit={handleLogin}
					className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-midnight-2"
				>
					<div className="mb-5 flex items-center gap-2">
						<KeyIcon className="h-6 w-6 text-nano" />
						<h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
							Admin
						</h1>
					</div>
					<label
						htmlFor="admin-token"
						className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
					>
						ADMIN_TOKEN
					</label>
					<input
						id="admin-token"
						type="password"
						value={token}
						onChange={event => setToken(event.target.value)}
						autoComplete="current-password"
						className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
					/>
					{error && (
						<div className="mt-3 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-300">
							<XCircleIcon className="h-5 w-5" />
							{error}
						</div>
					)}
					<div className="mt-5">
						<IconButton type="submit" disabled={submitting || !token.trim()}>
							<KeyIcon className="h-5 w-5" />
							Sign in
						</IconButton>
					</div>
				</form>
			</div>
		)
	}

	return (
		<div className="w-full max-w-7xl px-4 py-6">
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-slate-950 dark:text-zinc-100">
						Admin Dashboard
					</h1>
					<p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
						{analytics
							? `Updated ${formatDateTime(analytics.generatedAt)}`
							: 'Loading'}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<IconButton
						variant="neutral"
						disabled={loading}
						onClick={() => void loadDashboard()}
					>
						<ArrowPathIcon
							className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
						/>
						Refresh
					</IconButton>
					<IconButton variant="neutral" onClick={() => void handleLogout()}>
						<ArrowRightOnRectangleIcon className="h-5 w-5" />
						Sign out
					</IconButton>
				</div>
			</div>

			{error && (
				<div className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
					<XCircleIcon className="h-5 w-5" />
					{error}
				</div>
			)}
			{notice && (
				<div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
					<CheckCircleIcon className="h-5 w-5" />
					{notice}
				</div>
			)}
			{receivableConfigOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
					<form
						onSubmit={saveReceivableConfig}
						className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-midnight-2"
					>
						<div className="mb-4 flex items-center justify-between gap-4">
							<h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
								Receivables
							</h2>
							<button
								type="button"
								aria-label="Close receivables settings"
								onClick={() => setReceivableConfigOpen(false)}
								className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:text-zinc-300"
							>
								<XCircleIcon className="h-5 w-5" />
							</button>
						</div>
						<label
							htmlFor="min-receivable-amount"
							className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
						>
							Min receivable amount
						</label>
						<div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:border-nano focus-within:ring-2 focus-within:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1">
							<input
								id="min-receivable-amount"
								type="number"
								inputMode="decimal"
								min="0"
								step="0.000000000001"
								value={minReceivableAmountInput}
								onChange={event =>
									setMinReceivableAmountInput(event.target.value)
								}
								className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-3 text-slate-900 outline-none dark:text-zinc-100"
							/>
							<span className="px-3 text-sm font-semibold text-slate-500 dark:text-zinc-500">
								XNO
							</span>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<IconButton
								variant="neutral"
								onClick={() => setReceivableConfigOpen(false)}
							>
								Cancel
							</IconButton>
							<IconButton
								type="submit"
								disabled={submitting || !minReceivableAmountInput.trim()}
							>
								Save
							</IconButton>
						</div>
					</form>
				</div>
			)}
			{faucetConfigOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6">
					<form
						onSubmit={saveFaucetConfig}
						className="w-full max-w-2xl rounded-md border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-midnight-2"
					>
						<div className="mb-4 flex items-center justify-between gap-4">
							<h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
								Faucet config
							</h2>
							<button
								type="button"
								aria-label="Close faucet settings"
								onClick={() => setFaucetConfigOpen(false)}
								className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:text-zinc-300"
							>
								<XCircleIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<ConfigInput
								id="min-drop-amount"
								label="Min drop amount"
								value={faucetConfigInputs.minDropAmount}
								onChange={value =>
									updateFaucetConfigInput('minDropAmount', value)
								}
								min="0"
								step="0.000000000001"
								suffix="XNO"
							/>
							<ConfigInput
								id="max-drop-amount"
								label="Max drop amount"
								value={faucetConfigInputs.maxDropAmount}
								onChange={value =>
									updateFaucetConfigInput('maxDropAmount', value)
								}
								min="0"
								step="0.000000000001"
								suffix="XNO"
							/>
							<ConfigInput
								id="divide-balance-by"
								label="Divide balance by"
								value={faucetConfigInputs.divideBalanceBy}
								onChange={value =>
									updateFaucetConfigInput('divideBalanceBy', value)
								}
								min="1"
								step="1"
							/>
							<ConfigInput
								id="period-days"
								label="Period"
								value={faucetConfigInputs.periodDays}
								onChange={value => updateFaucetConfigInput('periodDays', value)}
								min="1"
								max="30"
								step="1"
								suffix="days"
							/>
							<ConfigInput
								id="max-drop-per-ip-simultaneously"
								label="Max simultaneous IP drops"
								value={faucetConfigInputs.maxDropPerIpSimultaneously}
								onChange={value =>
									updateFaucetConfigInput('maxDropPerIpSimultaneously', value)
								}
								min="1"
								step="1"
							/>
							<ConfigInput
								id="max-drops-per-account"
								label="Max drops per account"
								value={faucetConfigInputs.maxDropsPerAccount}
								onChange={value =>
									updateFaucetConfigInput('maxDropsPerAccount', value)
								}
								min="0"
								step="1"
							/>
							<ConfigInput
								id="max-drops-per-ip"
								label="Max drops per IP"
								value={faucetConfigInputs.maxDropsPerIp}
								onChange={value =>
									updateFaucetConfigInput('maxDropsPerIp', value)
								}
								min="0"
								step="1"
							/>
							<ConfigInput
								id="max-drops-per-proxy-ip"
								label="Max drops per proxy IP"
								value={faucetConfigInputs.maxDropsPerProxyIp}
								onChange={value =>
									updateFaucetConfigInput('maxDropsPerProxyIp', value)
								}
								min="0"
								step="1"
							/>
							<ConfigInput
								id="proxy-amount-divide-by"
								label="Proxy amount divider"
								value={faucetConfigInputs.proxyAmountDivideBy}
								onChange={value =>
									updateFaucetConfigInput('proxyAmountDivideBy', value)
								}
								min="1"
								step="1"
							/>
							<ConfigInput
								id="max-drops-per-limited-country-ip"
								label="Max drops per limited country IP"
								value={faucetConfigInputs.maxDropsPerIpInLimitedCountry}
								onChange={value =>
									updateFaucetConfigInput(
										'maxDropsPerIpInLimitedCountry',
										value,
									)
								}
								min="0"
								step="1"
							/>
							<div className="sm:col-span-2">
								<label
									htmlFor="limited-countries"
									className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
								>
									Limited countries
								</label>
								<textarea
									id="limited-countries"
									value={faucetConfigInputs.limitedCountries}
									onChange={event =>
										updateFaucetConfigInput(
											'limitedCountries',
											event.target.value,
										)
									}
									rows={3}
									placeholder="BR, US, IN"
									className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
							</div>
							<ConfigToggle
								id="verification-required-by-default"
								label="Verification required by default"
								checked={faucetConfigInputs.verificationRequiredByDefault}
								onChange={checked =>
									updateFaucetConfigInput(
										'verificationRequiredByDefault',
										checked,
									)
								}
							/>
							<ConfigToggle
								id="verify-when-proxy"
								label="Verify when proxy"
								checked={faucetConfigInputs.verifyWhenProxy}
								onChange={checked =>
									updateFaucetConfigInput('verifyWhenProxy', checked)
								}
							/>
							<ConfigToggle
								id="ban-proxies"
								label="Ban proxies"
								checked={faucetConfigInputs.banProxies}
								onChange={checked =>
									updateFaucetConfigInput('banProxies', checked)
								}
							/>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<IconButton
								variant="neutral"
								onClick={() => setFaucetConfigOpen(false)}
							>
								Cancel
							</IconButton>
							<IconButton
								type="submit"
								disabled={submitting || !faucetConfigInputComplete}
							>
								Save
							</IconButton>
						</div>
					</form>
				</div>
			)}
			{walletNetworkConfigOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 px-4 py-6">
					<form
						onSubmit={saveWalletNetworkConfig}
						className="w-full max-w-2xl rounded-md border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-midnight-2"
					>
						<div className="mb-4 flex items-center justify-between gap-4">
							<h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
								Wallet network
							</h2>
							<button
								type="button"
								aria-label="Close wallet network settings"
								onClick={() => setWalletNetworkConfigOpen(false)}
								className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:text-zinc-300"
							>
								<XCircleIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="space-y-4">
							<ConfigTextarea
								id="rpc-urls"
								label="RPC URLs"
								value={walletNetworkConfigInputs.rpcUrls}
								onChange={value =>
									updateWalletNetworkConfigInput('rpcUrls', value)
								}
								placeholder="https://node.example.com"
								rows={4}
							/>
							<ConfigTextarea
								id="worker-urls"
								label="Worker URLs"
								value={walletNetworkConfigInputs.workerUrls}
								onChange={value =>
									updateWalletNetworkConfigInput('workerUrls', value)
								}
								placeholder="https://work.example.com"
								rows={4}
							/>
							<div>
								<label
									htmlFor="wallet-representative"
									className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300"
								>
									Representative
								</label>
								<input
									id="wallet-representative"
									value={walletNetworkConfigInputs.representative}
									onChange={event =>
										updateWalletNetworkConfigInput(
											'representative',
											event.target.value,
										)
									}
									placeholder="nano_..."
									className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
							</div>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<IconButton
								variant="neutral"
								onClick={() => setWalletNetworkConfigOpen(false)}
							>
								Cancel
							</IconButton>
							<IconButton
								type="submit"
								disabled={submitting || !walletNetworkConfigInputComplete}
							>
								Save
							</IconButton>
						</div>
					</form>
				</div>
			)}
			{dropActionTarget && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="drop-action-title"
				>
					<div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-midnight-2">
						<div className="mb-4 flex items-center justify-between gap-4">
							<h2
								id="drop-action-title"
								className="text-lg font-semibold text-slate-900 dark:text-zinc-100"
							>
								Ban drop source
							</h2>
							<button
								type="button"
								aria-label="Close drop actions"
								onClick={() => setDropActionTarget(null)}
								className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:text-zinc-300"
							>
								<XCircleIcon className="h-5 w-5" />
							</button>
						</div>
						<p className="mb-4 text-sm text-slate-600 dark:text-zinc-400">
							Choose whether to ban the IP address or the Nano account used by
							this drop.
						</p>
						<div className="mb-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-zinc-800 dark:bg-midnight-1">
							<div>
								<div className="mb-1 font-semibold uppercase text-slate-500 dark:text-zinc-500">
									IP
								</div>
								<div className="break-all text-slate-900 dark:text-zinc-100">
									{dropActionTarget.ip}
								</div>
							</div>
							<div>
								<div className="mb-1 font-semibold uppercase text-slate-500 dark:text-zinc-500">
									Account
								</div>
								<div className="break-all text-slate-900 dark:text-zinc-100">
									{dropActionTarget.account}
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
							<IconButton
								variant="neutral"
								onClick={() => setDropActionTarget(null)}
							>
								Cancel
							</IconButton>
							<IconButton
								variant="danger"
								disabled={
									submitting || ipBlacklist.includes(dropActionTarget.ip)
								}
								onClick={() => void blockSelectedDropIp()}
							>
								<NoSymbolIcon className="h-5 w-5" />
								Ban IP
							</IconButton>
							<IconButton
								variant="danger"
								disabled={
									submitting ||
									accountBlacklist.includes(dropActionTarget.account)
								}
								onClick={() => void blockSelectedDropAccount()}
							>
								<NoSymbolIcon className="h-5 w-5" />
								Ban account
							</IconButton>
						</div>
					</div>
				</div>
			)}

			{analytics && (
				<>
					<div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
						<Metric
							label="Total drops"
							value={formatInteger(analytics.totalDrops)}
							accent="border-l-4 border-l-nano"
							description="Total faucet drops recorded in analytics."
						/>
						<Metric
							label="Last 24h"
							value={formatInteger(analytics.last24hDrops)}
							accent="border-l-4 border-l-emerald-500"
							description="Drops completed during the last 24 hours."
						/>
						<Metric
							label="Last 7d"
							value={formatInteger(analytics.last7dDrops)}
							accent="border-l-4 border-l-amber-500"
							description="Drops completed during the last 7 days."
						/>
						<Metric
							label="Avg latency"
							value={formatMs(analytics.avgTookMs)}
							accent="border-l-4 border-l-fuchsia-500"
							description="Average request time recorded for recent drops."
						/>
						<Metric
							label="Unique accounts"
							value={formatInteger(analytics.uniqueAccounts)}
							accent="border-l-4 border-l-indigo-500"
							description="Distinct Nano accounts that received drops."
						/>
						<Metric
							label="Unique IPs"
							value={formatInteger(analytics.uniqueIps)}
							accent="border-l-4 border-l-cyan-500"
							description="Distinct IP addresses that requested drops."
						/>
						<Metric
							label="Proxy drops"
							value={formatInteger(analytics.proxyDrops)}
							accent="border-l-4 border-l-rose-500"
							description="Drops where the request was identified as proxy traffic."
						/>
						<Metric
							label="Receivable"
							value={formatNano(analytics.wallet.receivable)}
							accent="border-l-4 border-l-lime-500"
							description="Pending incoming wallet balance that can be received."
						/>
					</div>

					<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
						<div className="min-w-0 space-y-4">
							<Panel
								title="Wallet"
								description="Shows the faucet wallet account, balance, frontier, representative, and proof-of-work readiness. Sync refreshes wallet state from the network."
								actions={
									<IconButton
										disabled={submitting}
										onClick={() => void syncWallet()}
									>
										<ArrowPathIcon
											className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
										/>
										Sync
									</IconButton>
								}
							>
								<div className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
									<div className="min-w-0">
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Account
										</div>
										<div className="mt-1 break-words text-slate-900 [overflow-wrap:anywhere] dark:text-zinc-100">
											{analytics.wallet.account}
										</div>
									</div>
									<div className="min-w-0">
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Balance
										</div>
										<div className="mt-1 text-slate-900 dark:text-zinc-100">
											{formatNano(analytics.wallet.balance)}
										</div>
									</div>
									<div className="min-w-0">
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Frontier
										</div>
										<div className="mt-1 break-words text-slate-900 [overflow-wrap:anywhere] dark:text-zinc-100">
											{analytics.wallet.frontier || '-'}
										</div>
									</div>
									<div className="min-w-0">
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Representative
										</div>
										<div className="mt-1 break-words text-slate-900 [overflow-wrap:anywhere] dark:text-zinc-100">
											{analytics.wallet.representative || '-'}
										</div>
									</div>
									<div className="min-w-0">
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Proof of Work
										</div>
										<div className="mt-1 text-slate-900 dark:text-zinc-100">
											{analytics.wallet.proofOfWork}
										</div>
									</div>
								</div>
							</Panel>

							<Panel
								title="Receivables"
								description="Lists pending incoming blocks for the faucet wallet. Use Receive to pull a block into the wallet, or settings to change the minimum receivable amount."
								actions={
									<button
										type="button"
										aria-label="Receivables settings"
										title="Receivables settings"
										onClick={openReceivableConfig}
										className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300"
									>
										<Cog6ToothIcon className="h-5 w-5" />
									</button>
								}
							>
								{receivableItems.length === 0 ? (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No receivable blocks.
									</p>
								) : (
									<div className="space-y-2">
										{paginatedReceivableItems.map(({ key, link, amount }) => {
											return (
												<div
													key={key}
													className="flex flex-col gap-3 border-t border-slate-100 py-3 first:border-t-0 first:pt-0 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
												>
													<div className="min-w-0">
														<div className="break-all text-sm font-semibold text-slate-900 dark:text-zinc-100">
															{link}
														</div>
														<div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
															{amount
																? formatNano(amount)
																: 'Amount unavailable'}
														</div>
													</div>
													<IconButton
														disabled={submitting}
														onClick={() =>
															void runAction(
																() =>
																	faucetRequest(
																		`/wallet/receive/${encodeURIComponent(link)}`,
																		{ method: 'POST' },
																	),
																'Receivable block received',
															)
														}
													>
														<ArrowDownTrayIcon className="h-5 w-5" />
														Receive
													</IconButton>
												</div>
											)
										})}
										<div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
											<div className="text-sm text-slate-500 dark:text-zinc-500">
												{receivableStart}-{receivableEnd} of{' '}
												{receivableItems.length}
											</div>
											<div className="flex gap-2">
												<IconButton
													variant="neutral"
													disabled={receivablePage === 0}
													onClick={() =>
														setReceivablePage(page => Math.max(0, page - 1))
													}
												>
													Previous
												</IconButton>
												<IconButton
													variant="neutral"
													disabled={receivablePage >= receivablePageCount - 1}
													onClick={() =>
														setReceivablePage(page =>
															Math.min(receivablePageCount - 1, page + 1),
														)
													}
												>
													Next
												</IconButton>
											</div>
										</div>
									</div>
								)}
							</Panel>

							<Panel
								title="Recent drops"
								description="Shows the most recent faucet drops with account, IP, amount, country, proxy signal, and quick moderation actions."
							>
								<div className="space-y-3 md:hidden">
									{analytics.recentDrops.map(drop => (
										<div
											key={drop.hash}
											className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-midnight-1"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0 flex-1">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														Account
													</div>
													<div className="mt-1 break-words text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] dark:text-zinc-100">
														{drop.account}
													</div>
												</div>
												<button
													type="button"
													aria-label="Open drop actions"
													disabled={
														submitting ||
														(ipBlacklist.includes(drop.ip) &&
															accountBlacklist.includes(drop.account))
													}
													onClick={() => setDropActionTarget(drop)}
													className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition enabled:hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600"
												>
													<NoSymbolIcon className="h-5 w-5" />
												</button>
											</div>
											<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
												<div className="min-w-0">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														IP
													</div>
													<div className="mt-1 break-words text-slate-800 [overflow-wrap:anywhere] dark:text-zinc-200">
														{drop.ip}
													</div>
												</div>
												<div className="min-w-0">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														Amount
													</div>
													<div className="mt-1 text-slate-800 dark:text-zinc-200">
														{formatNano(drop.amount)}
													</div>
												</div>
												<div className="min-w-0">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														Country
													</div>
													<div className="mt-1 text-slate-800 dark:text-zinc-200">
														{countryNames[drop.country_code] ||
															drop.country_code}
													</div>
												</div>
												<div className="min-w-0">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														Time
													</div>
													<div className="mt-1 text-slate-800 dark:text-zinc-200">
														{formatDateTime(drop.timestamp)}
													</div>
												</div>
												<div className="min-w-0">
													<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
														Proxy
													</div>
													<div className="mt-1 text-slate-800 dark:text-zinc-200">
														{drop.is_proxy ? 'Yes' : 'No'}
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
								<div className="hidden overflow-x-auto md:block">
									<table className="min-w-full text-left text-sm">
										<thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-zinc-800 dark:text-zinc-500">
											<tr>
												<th className="py-2 pr-4">Account</th>
												<th className="py-2 pr-4">IP</th>
												<th className="py-2 pr-4">Amount</th>
												<th className="py-2 pr-4">Country</th>
												<th className="py-2 pr-4">Time</th>
												<th className="py-2 pr-4">Proxy</th>
												<th className="py-2">Actions</th>
											</tr>
										</thead>
										<tbody>
											{analytics.recentDrops.map(drop => (
												<tr
													key={drop.hash}
													className="border-b border-slate-100 last:border-0 dark:border-zinc-800"
												>
													<td className="max-w-[260px] break-all py-3 pr-4 text-slate-800 dark:text-zinc-200">
														{drop.account}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{drop.ip}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{formatNano(drop.amount)}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{countryNames[drop.country_code] ||
															drop.country_code}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{formatDateTime(drop.timestamp)}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{drop.is_proxy ? 'Yes' : 'No'}
													</td>
													<td className="py-3">
														<button
															type="button"
															aria-label="Open drop actions"
															disabled={
																submitting ||
																(ipBlacklist.includes(drop.ip) &&
																	accountBlacklist.includes(drop.account))
															}
															onClick={() => setDropActionTarget(drop)}
															className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition enabled:hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:disabled:border-zinc-800 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600"
														>
															<NoSymbolIcon className="h-5 w-5" />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</Panel>
						</div>

						<div className="min-w-0 space-y-4">
							<Panel
								title="Admin state"
								description="Summarizes the current allowlist and blocklist sizes used by drop readiness checks."
							>
								<div className="divide-y divide-slate-100 text-sm dark:divide-zinc-800">
									<div className="flex items-center justify-between gap-4 py-3 first:pt-0">
										<div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500">
											<ShieldCheckIcon className="h-5 w-5 text-emerald-500" />
											IP whitelist
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.ipWhitelistCount}
										</div>
									</div>
									<div className="flex items-center justify-between gap-4 py-3">
										<div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500">
											<WalletIcon className="h-5 w-5 text-nano" />
											Account whitelist
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.accountWhitelistCount}
										</div>
									</div>
									<div className="flex items-center justify-between gap-4 py-3">
										<div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500">
											<NoSymbolIcon className="h-5 w-5 text-rose-500" />
											IP blacklist
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.ipBlacklistCount}
										</div>
									</div>
									<div className="flex items-center justify-between gap-4 py-3">
										<div className="flex items-center gap-2 text-slate-500 dark:text-zinc-500">
											<NoSymbolIcon className="h-5 w-5 text-amber-500" />
											Account blacklist
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.accountBlacklistCount}
										</div>
									</div>
								</div>
							</Panel>

							{walletNetworkConfig && (
								<Panel
									title="Wallet network"
									description="Controls the RPC endpoints, work server endpoints, and representative used by faucet wallet operations."
									actions={
										<button
											type="button"
											aria-label="Wallet network settings"
											title="Wallet network settings"
											onClick={openWalletNetworkConfig}
											className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300"
										>
											<Cog6ToothIcon className="h-5 w-5" />
										</button>
									}
								>
									<div className="space-y-3 text-sm">
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												RPC URLs
											</div>
											<div className="mt-1 space-y-1">
												{walletNetworkConfig.rpcUrls.map(url => (
													<div
														key={url}
														className="break-all text-slate-900 dark:text-zinc-100"
													>
														{url}
													</div>
												))}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Worker URLs
											</div>
											<div className="mt-1 space-y-1">
												{walletNetworkConfig.workerUrls.map(url => (
													<div
														key={url}
														className="break-all text-slate-900 dark:text-zinc-100"
													>
														{url}
													</div>
												))}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Representative
											</div>
											<div className="mt-1 break-all text-slate-900 dark:text-zinc-100">
												{walletNetworkConfig.representative}
											</div>
										</div>
									</div>
								</Panel>
							)}

							{faucetConfig && (
								<Panel
									title="Faucet config"
									description="Controls live faucet limits, period rules, verification defaults, proxy behavior, and limited-country handling."
									actions={
										<button
											type="button"
											aria-label="Faucet settings"
											title="Faucet settings"
											onClick={openFaucetConfig}
											className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-nano hover:text-nano dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-300"
										>
											<Cog6ToothIcon className="h-5 w-5" />
										</button>
									}
								>
									<div className="grid gap-3 text-sm sm:grid-cols-2">
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Min drop
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.minDropAmount} XNO
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Max drop
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.maxDropAmount} XNO
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Balance divider
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.divideBalanceBy)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Period
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.periodDays} days
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Simultaneous IP drops
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.maxDropPerIpSimultaneously)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Account limit
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.maxDropsPerAccount)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												IP limit
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.maxDropsPerIp)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Proxy IP limit
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.maxDropsPerProxyIp)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Proxy amount divider
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(faucetConfig.proxyAmountDivideBy)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Limited country IP limit
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatInteger(
													faucetConfig.maxDropsPerIpInLimitedCountry,
												)}
											</div>
										</div>
										<div className="sm:col-span-2">
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Limited countries
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{formatCountryCodes(faucetConfig.limitedCountries)}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Default verification
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.verificationRequiredByDefault
													? 'On'
													: 'Off'}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Verify proxy
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.verifyWhenProxy ? 'On' : 'Off'}
											</div>
										</div>
										<div>
											<div className="font-semibold text-slate-500 dark:text-zinc-500">
												Ban proxies
											</div>
											<div className="mt-1 text-slate-900 dark:text-zinc-100">
												{faucetConfig.banProxies ? 'On' : 'Off'}
											</div>
										</div>
									</div>
								</Panel>
							)}

							<Panel
								title="Drops by country"
								description="Breaks down completed drops by detected country from the analytics dataset."
							>
								<div className="space-y-3">
									{analytics.topCountries.map(country => (
										<div key={country.country_code}>
											<div className="mb-1 flex justify-between text-sm">
												<span className="text-slate-700 dark:text-zinc-300">
													{countryNames[country.country_code] ||
														country.country_code}
												</span>
												<span className="font-semibold text-slate-900 dark:text-zinc-100">
													{formatInteger(country.count)}
												</span>
											</div>
											<div className="h-2 rounded-full bg-slate-100 dark:bg-midnight-1">
												<div
													className="h-2 rounded-full bg-emerald-500"
													style={{
														width: `${(country.count / maxCountryDrops) * 100}%`,
													}}
												/>
											</div>
										</div>
									))}
								</div>
							</Panel>

							<Panel
								title="Daily drops"
								description="Shows recent daily drop volume so traffic changes are easy to spot."
							>
								<div className="flex h-44 items-end gap-2">
									{analytics.dailyDrops.map(day => (
										<div
											key={day.day}
											className="flex min-w-0 flex-1 flex-col items-center gap-2"
											title={`${day.day}: ${day.count}`}
										>
											<div
												className="w-full rounded-t bg-nano"
												style={{
													height: `${Math.max(
														6,
														(day.count / maxDailyDrops) * 140,
													)}px`,
												}}
											/>
											<span className="w-full truncate text-center text-[10px] text-slate-500 dark:text-zinc-500">
												{day.day.slice(5)}
											</span>
										</div>
									))}
								</div>
							</Panel>
						</div>
					</div>

					<div className="mt-4 grid w-full min-w-0 gap-4 lg:grid-cols-2">
						<Panel
							title="IP whitelist"
							description="IP addresses in this list bypass regular faucet limits for normal traffic. Blacklist rules still block matching IPs."
						>
							<form onSubmit={addIp} className="mb-4 flex gap-2">
								<input
									value={ipInput}
									onChange={event => setIpInput(event.target.value)}
									placeholder="IP address"
									className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
								<IconButton
									type="submit"
									disabled={submitting || !ipInput.trim()}
								>
									<PlusIcon className="h-5 w-5" />
									Add
								</IconButton>
							</form>
							<div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
								{ipWhitelist.map(ip => (
									<div
										key={ip}
										className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-zinc-800"
									>
										<span className="break-all text-sm text-slate-800 dark:text-zinc-200">
											{ip}
										</span>
										<IconButton
											variant="danger"
											disabled={submitting}
											onClick={() =>
												void runAction(
													() =>
														faucetRequest(
															`/whitelist/ip/${encodeURIComponent(ip)}`,
															{ method: 'DELETE' },
														),
													'IP whitelist updated',
												)
											}
										>
											<TrashIcon className="h-5 w-5" />
											Remove
										</IconButton>
									</div>
								))}
								{ipWhitelist.length === 0 && (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No whitelisted IPs.
									</p>
								)}
							</div>
						</Panel>

						<Panel
							title="Account whitelist"
							description="Nano accounts in this list bypass regular faucet limits for normal accounts. Blacklist rules still block matching accounts."
						>
							<form onSubmit={addAccount} className="mb-4 flex gap-2">
								<input
									value={accountInput}
									onChange={event => setAccountInput(event.target.value)}
									placeholder="nano_..."
									className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
								<IconButton
									type="submit"
									disabled={submitting || !accountInput.trim()}
								>
									<PlusIcon className="h-5 w-5" />
									Add
								</IconButton>
							</form>
							<div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
								{accountWhitelist.map(account => (
									<div
										key={account}
										className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-zinc-800"
									>
										<span className="break-all text-sm text-slate-800 dark:text-zinc-200">
											{account}
										</span>
										<IconButton
											variant="danger"
											disabled={submitting}
											onClick={() =>
												void runAction(
													() =>
														faucetRequest(
															`/whitelist/account/${encodeURIComponent(
																account,
															)}`,
															{ method: 'DELETE' },
														),
													'Account whitelist updated',
												)
											}
										>
											<TrashIcon className="h-5 w-5" />
											Remove
										</IconButton>
									</div>
								))}
								{accountWhitelist.length === 0 && (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No whitelisted accounts.
									</p>
								)}
							</div>
						</Panel>

						<Panel
							title="IP blacklist"
							description="IP addresses in this list are blocked from receiving drops. This check runs before whitelist exemptions."
						>
							<form onSubmit={addBlockedIp} className="mb-4 flex gap-2">
								<input
									value={blockedIpInput}
									onChange={event => setBlockedIpInput(event.target.value)}
									placeholder="IP address"
									className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
								<IconButton
									type="submit"
									variant="danger"
									disabled={submitting || !blockedIpInput.trim()}
								>
									<NoSymbolIcon className="h-5 w-5" />
									Block
								</IconButton>
							</form>
							<div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
								{ipBlacklist.map(ip => (
									<div
										key={ip}
										className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-zinc-800"
									>
										<span className="break-all text-sm text-slate-800 dark:text-zinc-200">
											{ip}
										</span>
										<IconButton
											variant="neutral"
											disabled={submitting}
											onClick={() =>
												void runAction(
													() =>
														faucetRequest(
															`/blacklist/ip/${encodeURIComponent(ip)}`,
															{ method: 'DELETE' },
														),
													'IP blacklist updated',
												)
											}
										>
											<TrashIcon className="h-5 w-5" />
											Unblock
										</IconButton>
									</div>
								))}
								{ipBlacklist.length === 0 && (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No blocked IPs.
									</p>
								)}
							</div>
						</Panel>

						<Panel
							title="Account blacklist"
							description="Nano accounts in this list are blocked from receiving drops. This check runs before whitelist exemptions."
						>
							<form onSubmit={addBlockedAccount} className="mb-4 flex gap-2">
								<input
									value={blockedAccountInput}
									onChange={event => setBlockedAccountInput(event.target.value)}
									placeholder="nano_..."
									className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-nano focus:ring-2 focus:ring-nano/20 dark:border-zinc-700 dark:bg-midnight-1 dark:text-zinc-100"
								/>
								<IconButton
									type="submit"
									variant="danger"
									disabled={submitting || !blockedAccountInput.trim()}
								>
									<NoSymbolIcon className="h-5 w-5" />
									Block
								</IconButton>
							</form>
							<div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
								{accountBlacklist.map(account => (
									<div
										key={account}
										className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0 dark:border-zinc-800"
									>
										<span className="break-all text-sm text-slate-800 dark:text-zinc-200">
											{account}
										</span>
										<IconButton
											variant="neutral"
											disabled={submitting}
											onClick={() =>
												void runAction(
													() =>
														faucetRequest(
															`/blacklist/account/${encodeURIComponent(
																account,
															)}`,
															{ method: 'DELETE' },
														),
													'Account blacklist updated',
												)
											}
										>
											<TrashIcon className="h-5 w-5" />
											Unblock
										</IconButton>
									</div>
								))}
								{accountBlacklist.length === 0 && (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No blocked accounts.
									</p>
								)}
							</div>
						</Panel>
					</div>
				</>
			)}
		</div>
	)
}
