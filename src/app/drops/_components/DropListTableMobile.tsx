import { Unit, convert } from 'nanocurrency'
import TimeAgo from 'react-timeago'
import Countries from '../_assets/countries.json'
import Link from 'next/link'
import { explorerLinkFromHash } from '@/utils'
import { Drop } from '@/hooks/useListDrops'
import { ClockIcon } from '@heroicons/react/24/outline'
import { BoltIcon, GlobeEuropeAfricaIcon } from '@heroicons/react/24/solid'

export default function DropListTableMobile({ drops }: { drops: Drop[] }) {
	return (
		<div className="flex flex-col divide-y divide-slate-200 dark:divide-zinc-700">
			{drops.map(drop => (
				<div key={drop.hash} className="flex flex-col py-4 gap-2">
					<div className="flex flex-col">
						<p className="text-sm break-all">{drop.account}</p>
					</div>
					<div className="flex justify-between items-center">
						<div className="flex flex-col items-end">
							<p className="text-sm font-semibold text-slate-800 dark:text-zinc-400">
								{convert(drop.amount, { from: Unit.raw, to: Unit.NANO })} NANO
							</p>
						</div>
						<div className="flex flex-col items-end">
							<p className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-zinc-400">
								<ClockIcon className="w-3 h-3 text-slate-500 dark:text-zinc-600" />
								<TimeAgo date={drop.timestamp} />
							</p>
						</div>
					</div>
					<div className="flex justify-between items-center">
						<div className="flex flex-col">
							<p className="text-xs text-slate-500 dark:text-zinc-600">
								Country
							</p>
							<div className="flex items-center gap-1">
								<GlobeEuropeAfricaIcon className="w-3 h-3 text-slate-500 dark:text-zinc-600" />
								<p className="text-sm font-semibold text-slate-800 dark:text-zinc-400">
									{(Countries as Record<string, string>)[drop.country] ||
										'unknown'}
								</p>
							</div>
						</div>
						<div className="flex flex-col">
							<p className="text-xs text-slate-500 dark:text-zinc-600">Took</p>
							<div className="flex items-center gap-1">
								<BoltIcon className="w-3 h-3 text-slate-500 dark:text-zinc-600" />
								<p className="text-sm font-semibold text-slate-800 dark:text-zinc-400">
									{drop.took} ms
								</p>
							</div>
						</div>
					</div>
					<div className="flex justify-between items-center break-all">
						<div className="flex flex-col items-start">
							<p className="text-xs text-slate-500 dark:text-zinc-600">Block</p>
							<p className="text-sm font-semibold text-slate-800 dark:text-zinc-400">
								<Link
									href={explorerLinkFromHash(drop.hash)}
									target="_blank"
									className="text-sky-700 hover:underline"
								>
									{drop.hash}
								</Link>
							</p>
						</div>
					</div>
				</div>
			))}
		</div>
	)
}
