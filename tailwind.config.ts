import type { Config } from 'tailwindcss'

const config: Config = {
	content: [
		'./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/components/**/*.{js,ts,jsx,tsx,mdx}',
		'./src/app/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				nano: '#209CE9',
				'midnight-1': '#101217',
				'midnight-2': '#0d0f13',
				danger: '#d9534f',
			},
		},
	},
	darkMode: 'class',
	plugins: [require('tailwindcss-safe-area'), require('tailwind-scrollbar')],
}
export default config
