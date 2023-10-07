import { Unit, convert } from 'nanocurrency'
import TimeAgo from 'react-timeago'
import Countries from '../_assets/countries.json'
import Link from 'next/link'
import { explorerLinkFromHash } from '@/utils'
import { Drop } from '@/hooks/useListDrops'

export default function DropListTableMobile({ drops }: { drops: Drop[] }) {
	return (
		<div className="flex flex-col divide-y divide-slate-200">
			{drops.map(drop => (
				<div key={drop.hash} className="flex flex-col py-4 gap-2">
					<div className="flex flex-col">
						<p className="text-sm text-slate-800 break-all">{drop.account}</p>
					</div>
					<div className="flex justify-between items-center">
						<div className="flex flex-col items-end">
							<p className="text-sm font-semibold text-slate-900">
								{convert(drop.amount, { from: Unit.raw, to: Unit.NANO })} NANO
							</p>
						</div>
						<div className="flex flex-col items-end">
							<p className="text-sm font-semibold text-slate-900">
								<TimeAgo date={drop.timestamp} />
							</p>
						</div>
					</div>
					<div className="flex justify-between items-center">
						<div className="flex flex-col">
							<p className="text-xs text-slate-500">Country</p>
							<p className="text-sm font-semibold text-slate-900">
								{(Countries as Record<string, string>)[drop.country] ||
									'unknown'}
							</p>
						</div>
						<div className="flex flex-col">
							<p className="text-xs text-slate-500">Took</p>
							<p className="text-sm font-semibold text-slate-900">
								{drop.took} ms
							</p>
						</div>
					</div>
					<div className="flex justify-between items-center break-all">
						<div className="flex flex-col items-start">
							<p className="text-xs text-slate-500">Block</p>
							<p className="text-sm font-semibold text-slate-900">
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
