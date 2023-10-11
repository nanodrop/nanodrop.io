import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

export interface SelectBoxOption {
	value: string
	title: string
	description: string
}

export interface SelectBoxProps {
	options: SelectBoxOption[]
	defaultValue?: string
	onChange?: (optionValue: string) => void
}

export default function SelectBox({
	options,
	defaultValue,
	onChange,
}: SelectBoxProps) {
	const [selectedValue, setSelectedValue] = useState(defaultValue)

	const selected = defaultValue
		? options.find(option => option.value === selectedValue)
		: options[0]

	const handleChange = (value: string) => {
		setSelectedValue(value)
		onChange && onChange(value)
	}

	return (
		<Listbox value={selectedValue} onChange={handleChange}>
			{({ open }) => (
				<>
					<div className="relative">
						<div className="inline-flex rounded-md shadow-sm">
							<div className="inline-flex items-center gap-x-1.5 rounded-l-md bg-slate-600 border border-white/10 p-2 text-white shadow-sm w-40">
								<p className="text-xs font-semibold">{selected?.title}</p>
							</div>
							<Listbox.Button
								className={clsx(
									'inline-flex items-center rounded-l-none rounded-r-md border border-white/10 p-2 bg-slate-600 hover:bg-slate-700 focus:outline-none',
									open && 'bg-slate-700',
								)}
							>
								<ChevronDownIcon
									className="h-5 w-5 text-white"
									aria-hidden="true"
								/>
							</Listbox.Button>
						</div>

						<Transition
							show={open}
							as={Fragment}
							leave="transition ease-in duration-100"
							leaveFrom="opacity-100"
							leaveTo="opacity-0"
						>
							<Listbox.Options className="absolute right-0 z-10 mt-1 w-40 origin-top-right divide-y divide-slate-600 overflow-hidden rounded-md bg-[#374349] shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
								{options.map(option => (
									<Listbox.Option
										key={option.title}
										className={({ active }) =>
											clsx(
												active ? 'bg-slate-600 text-white' : 'text-white',
												'cursor-pointer select-none p-2 text-xs',
											)
										}
										value={option.value}
									>
										{({ selected, active }) => (
											<div className="flex flex-col">
												<div className="flex justify-between">
													<p>{option.title}</p>
													{selected ? (
														<span className={'text-white'}>
															<CheckIcon
																className="h-4 w-4"
																aria-hidden="true"
															/>
														</span>
													) : null}
												</div>
												<p
													className={clsx(
														active ? 'text-rose-200' : 'text-slate-300',
														'mt-2',
													)}
												>
													{option.description}
												</p>
											</div>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</Transition>
					</div>
				</>
			)}
		</Listbox>
	)
}
