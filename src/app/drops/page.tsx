'use client'

import useListDrops from '@/hooks/useListDrops'
import { ArrowPathIcon } from '@heroicons/react/24/solid'
import { ButtonBase, IconButton, Skeleton } from '@mui/material'
import clsx from 'clsx'
import DropListTableDesktop from './_components/DropListTableDesktop'
import DropListTableMobile from './_components/DropListTableMobile'

export default function Drops() {
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
			<>
				<Skeleton className="w-full h-10" />
				<div className="flex gap-4">
					<Skeleton className="w-full h-5 flex-1" />
					<Skeleton className="w-full h-5 flex-1" />
					<Skeleton className="w-full h-5 flex-1" />
				</div>
			</>
		)
	}
	return (
		<div className="px-2 sm:px-6 lg:px-8">
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
	)
}
