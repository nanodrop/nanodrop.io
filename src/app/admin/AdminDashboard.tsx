'use client'

import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowRightOnRectangleIcon,
	CheckCircleIcon,
	KeyIcon,
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
}

type Drop = {
	hash: string
	account: string
	amount: string
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
		temporaryIpBlacklistCount: number
		temporaryAccountBlacklistCount: number
	}
}

type SessionResponse = {
	authenticated: boolean
	expiresIn: number
}

type ReceivableValue = {
	amount?: string
	balance?: string
	link?: string
	hash?: string
	[key: string]: unknown
}

type ReceivablePayload = Record<string, ReceivableValue> | ReceivableValue[]

type RequestOptions = Omit<RequestInit, 'body'> & {
	body?: unknown
}

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

const resolveReceivableItems = (receivables: ReceivablePayload | null) => {
	if (!receivables) return []

	if (Array.isArray(receivables)) {
		return receivables.map((value, index) => ({
			key: value.link || value.hash || String(index),
			value,
		}))
	}

	return Object.entries(receivables).map(([key, value]) => ({ key, value }))
}

function Metric({
	label,
	value,
	accent,
}: {
	label: string
	value: string
	accent: string
}) {
	return (
		<div
			className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-midnight-2 ${accent}`}
		>
			<div className="text-xs font-semibold uppercase text-slate-500 dark:text-zinc-500">
				{label}
			</div>
			<div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-zinc-100">
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

function Panel({
	title,
	children,
	actions,
}: {
	title: string
	children: React.ReactNode
	actions?: React.ReactNode
}) {
	return (
		<section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-midnight-2">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
					{title}
				</h2>
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
	const [ipWhitelist, setIpWhitelist] = useState<string[]>([])
	const [accountWhitelist, setAccountWhitelist] = useState<string[]>([])
	const [ipInput, setIpInput] = useState('')
	const [accountInput, setAccountInput] = useState('')
	const [loading, setLoading] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [syncing, setSyncing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)

	const loadDashboard = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const [analyticsData, receivableData, ipData, accountData] =
				await Promise.all([
					faucetRequest<AdminAnalytics>('/analytics'),
					faucetRequest<ReceivablePayload>('/wallet/receivables'),
					faucetRequest<string[]>('/whitelist/ip'),
					faucetRequest<string[]>('/whitelist/account'),
				])

			setAnalytics(analyticsData)
			setReceivables(receivableData)
			setIpWhitelist(ipData)
			setAccountWhitelist(accountData)
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
	const maxCountryDrops = Math.max(
		1,
		...(analytics?.topCountries.map(country => country.count) || []),
	)
	const maxDailyDrops = Math.max(
		1,
		...(analytics?.dailyDrops.map(day => day.count) || []),
	)

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
		setIpWhitelist([])
		setAccountWhitelist([])
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

			{analytics && (
				<>
					<div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<Metric
							label="Total drops"
							value={formatInteger(analytics.totalDrops)}
							accent="border-l-4 border-l-nano"
						/>
						<Metric
							label="Last 24h"
							value={formatInteger(analytics.last24hDrops)}
							accent="border-l-4 border-l-emerald-500"
						/>
						<Metric
							label="Last 7d"
							value={formatInteger(analytics.last7dDrops)}
							accent="border-l-4 border-l-amber-500"
						/>
						<Metric
							label="Avg latency"
							value={formatMs(analytics.avgTookMs)}
							accent="border-l-4 border-l-fuchsia-500"
						/>
						<Metric
							label="Unique accounts"
							value={formatInteger(analytics.uniqueAccounts)}
							accent="border-l-4 border-l-indigo-500"
						/>
						<Metric
							label="Unique IPs"
							value={formatInteger(analytics.uniqueIps)}
							accent="border-l-4 border-l-cyan-500"
						/>
						<Metric
							label="Proxy drops"
							value={formatInteger(analytics.proxyDrops)}
							accent="border-l-4 border-l-rose-500"
						/>
						<Metric
							label="Receivable"
							value={formatNano(analytics.wallet.receivable)}
							accent="border-l-4 border-l-lime-500"
						/>
					</div>

					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
						<div className="space-y-4">
							<Panel
								title="Wallet"
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
								<div className="grid gap-3 text-sm sm:grid-cols-2">
									<div>
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Account
										</div>
										<div className="mt-1 break-all text-slate-900 dark:text-zinc-100">
											{analytics.wallet.account}
										</div>
									</div>
									<div>
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Balance
										</div>
										<div className="mt-1 text-slate-900 dark:text-zinc-100">
											{formatNano(analytics.wallet.balance)}
										</div>
									</div>
									<div>
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Frontier
										</div>
										<div className="mt-1 break-all text-slate-900 dark:text-zinc-100">
											{analytics.wallet.frontier || '-'}
										</div>
									</div>
									<div>
										<div className="font-semibold text-slate-500 dark:text-zinc-500">
											Representative
										</div>
										<div className="mt-1 break-all text-slate-900 dark:text-zinc-100">
											{analytics.wallet.representative || '-'}
										</div>
									</div>
								</div>
							</Panel>

							<Panel title="Receivables">
								{receivableItems.length === 0 ? (
									<p className="text-sm text-slate-500 dark:text-zinc-500">
										No receivable blocks.
									</p>
								) : (
									<div className="space-y-2">
										{receivableItems.map(({ key, value }) => {
											const link = value.link || value.hash || key
											const amount = value.amount || value.balance

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
									</div>
								)}
							</Panel>

							<Panel title="Recent drops">
								<div className="overflow-x-auto">
									<table className="min-w-full text-left text-sm">
										<thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-zinc-800 dark:text-zinc-500">
											<tr>
												<th className="py-2 pr-4">Account</th>
												<th className="py-2 pr-4">Amount</th>
												<th className="py-2 pr-4">Country</th>
												<th className="py-2 pr-4">Time</th>
												<th className="py-2">Proxy</th>
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
														{formatNano(drop.amount)}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{countryNames[drop.country_code] ||
															drop.country_code}
													</td>
													<td className="py-3 pr-4 text-slate-600 dark:text-zinc-400">
														{formatDateTime(drop.timestamp)}
													</td>
													<td className="py-3 text-slate-600 dark:text-zinc-400">
														{drop.is_proxy ? 'Yes' : 'No'}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</Panel>
						</div>

						<div className="space-y-4">
							<Panel title="Admin state">
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
										<div className="text-slate-500 dark:text-zinc-500">
											Temp IP blocks
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.temporaryIpBlacklistCount}
										</div>
									</div>
									<div className="flex items-center justify-between gap-4 py-3">
										<div className="text-slate-500 dark:text-zinc-500">
											Temp account blocks
										</div>
										<div className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
											{analytics.adminState.temporaryAccountBlacklistCount}
										</div>
									</div>
								</div>
							</Panel>

							<Panel title="Drops by country">
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

							<Panel title="Daily drops">
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

					<div className="mt-4 grid gap-4 lg:grid-cols-2">
						<Panel title="IP whitelist">
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

						<Panel title="Account whitelist">
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
					</div>
				</>
			)}
		</div>
	)
}
