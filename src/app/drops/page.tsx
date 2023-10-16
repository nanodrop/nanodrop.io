'use client'

import useListDrops from '@/hooks/useListDrops'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import { ButtonBase, IconButton, Skeleton } from '@mui/material'
import clsx from 'clsx'

import DropListTableDesktop from './_components/DropListTableDesktop'
import DropListTableMobile from './_components/DropListTableMobile'
import DropsMap from '@/components/DropsMap'
import { usePreferences } from '@/contexts/PreferencesProvider'

export default function Drops() {
	const { darkMode } = usePreferences()

	const { drops, isLoading, error, refresh, isRefreshing, hasMore, loadMore } =
		useListDrops()
	if (error)
		return (
			<div className="border border-rose-200 bg-rose-100 text-rose-800 text-lg font-semibold rounded-lg px-4 py-2">
				{error}
			</div>
		)
	if (isLoading) {
		return (
			<div className="w-full flex justify-center">
				<div className="p-4 w-full max-w-5xl">
					<Skeleton className="w-full !h-12 dark:bg-slate-800" />
					<Skeleton className="w-full !h-8 dark:bg-slate-800" />
					<div className="flex gap-4">
						<Skeleton className="w-full 1h-8 flex-1 dark:bg-slate-800" />
						<Skeleton className="w-full !h-8 flex-1 dark:bg-slate-800" />
						<Skeleton className="w-full !h-8 flex-1 dark:bg-slate-800" />
					</div>
				</div>
			</div>
		)
	}
	return (
		<div className="flex flex-col flex-1 2xl:flex-row 2xl:justify-between 2xl:gap-4 overflow-hidden">
			<div className="w-full relative flex flex-col flex-1 2xl:w-3/5 max-w-7xl max-h-[60%] 2xl:max-h-max">
				<DropsMap theme={darkMode ? 'dark' : 'light'} />
				<div className="w-full absolute top-0 left-0 p-2">
					<h1 className="text-sm font-semibold text-slate-400 dark:text-zinc-600">
						203.443 Drops
					</h1>
				</div>
			</div>
			<div className="flex flex-col flex-1 px-4 2xl:py-4 overflow-hidden">
				<div className="flex">
					<div className="flex-auto">
						<h1 className="text-base font-semibold leading-6 text-slate-900 dark:text-zinc-400">
							Drop List
						</h1>
						<p className="mt-2 text-xs sm:text-sm">
							A list of all transactions sent by NanoDrop
						</p>
					</div>
					<div className="sm:mt-6 sm:ml-16 sm:flex-none">
						<IconButton
							type="button"
							onClick={refresh}
							disabled={isLoading || isRefreshing}
							className="group"
						>
							<ArrowPathIcon
								className={clsx(
									'w-6 sm:w-8 h-6 sm:h-8 text-slate-600 dark:text-zinc-600 group-hover:text-nano',
									isRefreshing && 'animate animate-spin',
								)}
							/>
						</IconButton>
					</div>
				</div>
				<div className="flex flex-col flex-1 overflow-y-auto">
					<div className="mt-4 sm:mt-8 hidden sm:flow-root">
						<DropListTableDesktop drops={drops || []} />
					</div>
					<div className="mt-4 sm:mt-8 flow-root sm:hidden">
						<DropListTableMobile drops={drops || []} />
					</div>
					{hasMore && (
						<div className="flex justify-center p-4">
							<ButtonBase onClick={loadMore}>
								<div className="bg-nano px-4 py-2 font-semibold text-white uppercase rounded-lg">
									Load More
								</div>
							</ButtonBase>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
