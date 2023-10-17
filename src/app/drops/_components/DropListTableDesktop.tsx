import { Drop } from '@/hooks/useListDrops'
import { explorerLinkFromHash } from '@/utils'
import { Unit, convert } from 'nanocurrency'
import Link from 'next/link'
import TimeAgo from 'react-timeago'
import Countries from '../_assets/countries.json'

export default function DropListTableDesktop({ drops }: { drops: Drop[] }) {
	return (
		<div className="inline-block min-w-full py-2 align-middle">
			<table className="min-w-full divide-y divide-slate-300 dark:divide-zinc-700">
				<thead>
					<tr className="text-slate-900 dark:text-zinc-500">
						<th
							scope="col"
							className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0"
						>
							Account / Block
						</th>
						<th
							scope="col"
							className="px-3 py-3.5 text-left text-sm font-semibold"
						>
							Amount
						</th>
						<th
							scope="col"
							className="px-3 py-3.5 text-left text-sm font-semibold"
						>
							Country
						</th>
						<th
							scope="col"
							className="px-3 py-3.5 text-left text-sm font-semibold"
						>
							Timestamp
						</th>
						<th
							scope="col"
							className="px-3 py-3.5 text-left text-sm font-semibold "
						>
							Took
						</th>
						<th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
							<span className="sr-only">Edit</span>
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
					{drops.map(drop => (
						<tr key={drop.hash} className="text-slate-500 dark:text-zinc-600">
							<td className="py-4 pl-4 pr-3 text-sm font-medium text-slate-800 dark:text-zinc-400 sm:pl-0">
								<p className="mb-1 break-all">{drop.account}</p>
								<p>
									<Link
										href={explorerLinkFromHash(drop.hash)}
										target="_blank"
										className="text-sky-700 hover:underline break-all"
									>
										{drop.hash}
									</Link>
								</p>
							</td>
							<td className="whitespace-nowrap px-3 py-4 text-sm">
								{convert(drop.amount, {
									from: Unit.raw,
									to: Unit.NANO,
								})}{' '}
								NANO
							</td>
							<td className="whitespace-nowrap px-3 py-4 text-sm">
								{(Countries as Record<string, string>)[drop.country_code] ||
									'unknown'}
							</td>
							<td className="whitespace-nowrap px-3 py-4 text-sm">
								<TimeAgo date={drop.timestamp} />
							</td>
							<td className="whitespace-nowrap px-3 py-4 text-sm">
								{drop.took} ms
							</td>
							<td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
								{drop.is_proxy}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
