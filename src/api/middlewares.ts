import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler = (err: Error, c: Context) => {
	console.error('API Error:', err.message, err.stack)

	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status)
	}

	if (err instanceof Error) {
		return c.json({ error: err.message }, 500)
	}

	return c.json({ error: 'Unknown error' }, 500)
}
