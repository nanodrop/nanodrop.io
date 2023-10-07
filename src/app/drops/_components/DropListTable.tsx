import { Drop } from '@/hooks/useListDrops'
import { explorerLinkFromHash } from '@/utils'
import { Unit, convert } from 'nanocurrency'
import Link from 'next/link'
import TimeAgo from 'react-timeago'
import Countries from '../_assets/countries.json'

export default function DropListTable({ drops }: { drops: Drop[] }) {
	return (
		<div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
			<div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
				<table className="min-w-full divide-y divide-gray-300">
					<thead>
						<tr>
							<th
								scope="col"
								className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
							>
								Account / Block
							</th>
							<th
								scope="col"
								className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>
								Amount
							</th>
							<th
								scope="col"
								className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>
								Country
							</th>
							<th
								scope="col"
								className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>
								Timestamp
							</th>
							<th
								scope="col"
								className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
							>
								Took
							</th>
							<th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
								<span className="sr-only">Edit</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{drops.map(drop => (
							<tr key={drop.hash}>
								<td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-800 sm:pl-0">
									<p className="mb-1">{drop.account}</p>
									<p>
										<Link
											href={explorerLinkFromHash(drop.hash)}
											target="_blank"
											className="text-sky-700 hover:underline"
										>
											{drop.hash}
										</Link>
									</p>
								</td>
								<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
									{convert(drop.amount, {
										from: Unit.raw,
										to: Unit.NANO,
									})}{' '}
									NANO
								</td>
								<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
									{(Countries as Record<string, string>)[drop.country] ||
										'unknown'}
								</td>
								<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
									<TimeAgo date={drop.timestamp} />
								</td>
								<td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
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
		</div>
	)
}
