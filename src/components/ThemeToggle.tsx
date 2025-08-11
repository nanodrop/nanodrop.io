'use client'

import { ButtonBase } from '@mui/material'
import { MoonIcon, SunIcon } from '@heroicons/react/24/solid'
import { usePreferences } from '@/contexts/PreferencesProvider'

export function ThemeToggle() {
	const { darkMode, toggleDarkMode } = usePreferences()

	return (
		<ButtonBase className="!rounded-full" onClick={toggleDarkMode}>
			<div className="flex text-sm items-center sm:gap-1 text-white sm:text-slate-500 hover:text-nano hover:border-nano sm:border sm:border-slate-300 sm:dark:border-zinc-800 dark:border-zinc-800 px-2 py-1.5 rounded-full">
				{darkMode ? (
					<>
						<span className="hidden sm:block">Dark</span>
						<MoonIcon className="w-5 h-5" />
					</>
				) : (
					<>
						<span className="hidden sm:block">Light</span>
						<SunIcon className="w-5 h-5" />
					</>
				)}
			</div>
		</ButtonBase>
	)
}
