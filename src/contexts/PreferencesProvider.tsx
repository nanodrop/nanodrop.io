'use client'

import { DARK_MODE_BY_DEFAULT } from '@/config'
import { createContext, useContext, useEffect, useState } from 'react'

export interface Preferences {
	darkMode: boolean
}

export interface PreferencesContextProps extends Preferences {
	toggleDarkMode: () => void
}

const PreferencesContext = createContext<PreferencesContextProps>({
	darkMode: false,
	toggleDarkMode: () => {},
})

export function PreferencesProvider({
	children,
}: {
	children: React.ReactNode
}) {
	const [darkMode, setDarkMode] = useState(DARK_MODE_BY_DEFAULT)
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		if (localStorage.theme !== undefined) {
			setDarkMode(localStorage.theme === 'dark')
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			setDarkMode(true)
		}
	}, [])

	useEffect(() => {
		if (darkMode) {
			document.documentElement.classList.add('dark')
		} else {
			document.documentElement.classList.remove('dark')
		}
		setIsLoading(false)
	}, [darkMode])

	const toggleDarkMode = () => {
		localStorage.setItem('theme', !darkMode ? 'dark' : 'light')
		setDarkMode(!darkMode)
	}

	if (isLoading) {
		return
	}

	return (
		<PreferencesContext.Provider value={{ darkMode, toggleDarkMode }}>
			{children}
		</PreferencesContext.Provider>
	)
}

export function usePreferences() {
	return useContext(PreferencesContext)
}
