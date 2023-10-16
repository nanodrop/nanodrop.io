import * as Sentry from '@sentry/nextjs'

type LoggerLevel = 'info' | 'error' | 'warn'

export default class Logger {
	private name: string = 'LOGGER'
	private debug: boolean = true
	private enableSentry = true

	constructor(name?: string, debug?: boolean, enableSentry?: boolean) {
		if (name) this.name = name
		if (debug !== undefined) this.debug = debug
		if (enableSentry !== undefined) this.enableSentry = enableSentry
	}

	private formatedDateTime() {
		const date = new Date()
		const year = date.getFullYear()
		const month = date.getMonth() + 1
		const day = date.getDate()
		const hours = `0${date.getHours()}`.slice(-2)
		const minutes = `0${date.getMinutes()}`.slice(-2)
		const seconds = `0${date.getSeconds()}`.slice(-2)
		const milliseconds = `00${date.getMilliseconds()}`.slice(-3)
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
	}

	private colorize(text: string, level?: LoggerLevel): string {
		// Adding ANSI escape codes
		switch (level) {
			case 'info':
				return `\x1b[32m${text.toUpperCase()}\x1b[0m`
			case 'error':
				return `\x1b[31m${text.toUpperCase()}\x1b[0m`
			case 'warn':
				return `\x1b[33m${text.toUpperCase()}\x1b[0m`
			default:
				return `\x1b[32m${text.toUpperCase()}\x1b[0m`
		}
	}

	private formatMessage(data: any[], level: LoggerLevel): string {
		let prefix = `${this.formatedDateTime()} | ${this.colorize(
			level,
			level,
		)} | ${this.colorize(level)}`
		return `${prefix} | ${data.join(' ')}`
	}

	info(...data: any[]) {
		if (this.enabled) {
			console.info(this.formatMessage(data, 'info'))
		}
	}

	error(...data: any[]) {
		if (this.enabled) {
			const errorMessage = this.formatMessage(data, 'error')
			console.error(`${errorMessage}`)
		}
		this.sendToSentry(data)
	}

	warn(...data: any[]) {
		if (this.enabled) {
			const errorMessage = this.formatMessage(data, 'warn')
			console.warn(`${errorMessage}`)
		}
	}

	private sendToSentry(...data: any[]) {
		if (!this.enableSentry) return
		const sentryIsInited = Sentry.getCurrentHub()?.getClient()?.getDsn()
		if (sentryIsInited) {
			Sentry.captureMessage(`${this.name} | ${data.join(' ')}`)
		}
	}

	private get enabled() {
		return this.debug || window.debug === true
	}
}

declare global {
	interface Window {
		debug: boolean
	}
}
