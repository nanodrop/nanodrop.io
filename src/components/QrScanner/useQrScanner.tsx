import QrScanner, {
	Camera,
	DeviceId,
	FacingMode,
	ScanResult,
} from './QrScanner'
import { useEffect, useRef, useState } from 'react'

export interface UseQrScannerOptions {
	autoStart: boolean
}

export default function useQrScanner(
	options: UseQrScannerOptions = { autoStart: true },
) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const scannerRef = useRef<QrScanner | null>(null)

	const [cameras, setCameras] = useState<Camera[]>([])
	const [data, setData] = useState<string | null>(null)
	const [isReady, setIsReady] = useState(false)

	const onDecodeHandler = ({ data }: ScanResult) => {
		scannerRef.current?.pause()
		setData(data)
		setTimeout(() => {
			void scannerRef.current?.start()
		}, 3000)
	}

	const onDecodeErrorHandler = () => {
		setData(null)
	}

	const calculateScanRegion = (video: HTMLVideoElement) => {
		const width = video.videoWidth
		const height = video.videoHeight
		const size = Math.min(width, height) * 0.8
		const x = (width - size) / 2
		const y = (height - size) / 2
		return {
			x,
			y,
			width: size,
			height: size,
		}
	}

	useEffect(() => {
		if (!videoRef.current || scannerRef.current) return

		const scanner = new QrScanner(videoRef.current, onDecodeHandler, {
			preferredCamera: 'environment',
			highlightScanRegion: true,
			highlightCodeOutline: true,
			calculateScanRegion,
			onDecodeError: onDecodeErrorHandler,
		})

		scannerRef.current = scanner
		setIsReady(true)

		if (options.autoStart) {
			void scanner.start()
		}

		return () => {
			scanner.destroy()
			scannerRef.current = null
			setIsReady(false)
		}
	}, [options.autoStart])

	const loadCameras = async () => {
		const cameras = await QrScanner.listCameras()
		setCameras(cameras)
	}

	useEffect(() => {
		loadCameras()
	}, [])

	const hasCamera = !!cameras.length

	return {
		ref: videoRef,
		isReady,
		start: () => scannerRef.current?.start(),
		stop: () => scannerRef.current?.stop(),
		pause: () => scannerRef.current?.pause(),
		data,
		hasCamera,
		listCameras: () => QrScanner.listCameras(),
		cameras,
		setCamera: (facingModeOrDeviceId: FacingMode | DeviceId) =>
			scannerRef.current?.setCamera(facingModeOrDeviceId),
		hasFlash: () => scannerRef.current?.hasFlash(),
		isFlashOn: () => scannerRef.current?.isFlashOn(),
		turnFlashOn: () => scannerRef.current?.turnFlashOn(),
		turnFlashOff: () => scannerRef.current?.turnFlashOff(),
		updateOverlayColor: (color: string) =>
			scannerRef.current?.updateOverlayColor(color),
		destroy: () => {
			scannerRef.current?.destroy()
			scannerRef.current = null
			setIsReady(false)
		},
	}
}
