'use client'

import {
	ThemeProvider as MuiThemeProvider,
	createTheme,
} from '@mui/material/styles'
import { ReactNode } from 'react'

const theme = createTheme({
	palette: {
		primary: {
			main: '#209CE9',
		},
	},
})

export default function ThemeProvider({ children }: { children: ReactNode }) {
	return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
}
