import jsQR from 'jsqr'

let inversionAttempts: 'dontInvert' | 'onlyInvert' | 'attemptBoth' =
	'dontInvert'

self.onmessage = event => {
	const id = event['data']['id']
	const type = event['data']['type']
	const data = event['data']['data']

	switch (type) {
		case 'decode':
			decode(data, id)
			break
		case 'inversionMode':
			setInversionMode(data)
			break
		case 'close':
			// close after earlier messages in the event loop finished processing
			self.close()
			break
	}
}

function decode(
	data: { data: Uint8ClampedArray; width: number; height: number },
	requestId: number,
): void {
	const rgbaData = data['data']
	const width = data['width']
	const height = data['height']
	const result = jsQR(rgbaData, width, height, {
		inversionAttempts: inversionAttempts,
	})
	if (!result) {
		;(self as unknown as Worker).postMessage({
			id: requestId,
			type: 'qrResult',
			data: null,
		})
		return
	}

	;(self as unknown as Worker).postMessage({
		id: requestId,
		type: 'qrResult',
		data: result.data,
		// equivalent to cornerPoints of native BarcodeDetector
		cornerPoints: [
			result.location.topLeftCorner,
			result.location.topRightCorner,
			result.location.bottomRightCorner,
			result.location.bottomLeftCorner,
		],
	})
}

function setInversionMode(inversionMode: 'original' | 'invert' | 'both') {
	switch (inversionMode) {
		case 'original':
			inversionAttempts = 'dontInvert'
			break
		case 'invert':
			inversionAttempts = 'onlyInvert'
			break
		case 'both':
			inversionAttempts = 'attemptBoth'
			break
		default:
			throw new Error('Invalid inversion mode')
	}
}

export {}
