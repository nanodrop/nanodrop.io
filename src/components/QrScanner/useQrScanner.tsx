import QrScanner, {
	Camera,
	DeviceId,
	FacingMode,
	ScanResult,
} from './QrScanner'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface UseQrScannerOptions {
	autoStart: boolean
}

export default function useQrScanner(
	options: UseQrScannerOptions = { autoStart: true },
) {
	const videoRef = useRef<HTMLVideoElement>(null)

	const [cameras, setCameras] = useState<Camera[]>([])
	const [data, setData] = useState<string | null>(null)

	const onDecodeHandler = ({ data }: ScanResult) => {
		scanner?.pause()
		setData(data)
		setTimeout(() => {
			scanner?.start()
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

	const scanner = useMemo(() => {
		if (videoRef.current) {
			const qrscanner = new QrScanner(videoRef.current, onDecodeHandler, {
				preferredCamera: 'environment',
				highlightScanRegion: true,
				highlightCodeOutline: true,
				calculateScanRegion,
				onDecodeError: onDecodeErrorHandler,
			})
			if (options.autoStart) {
				qrscanner.start()
			}
			return qrscanner
		} else {
			return null
		}
	}, [videoRef.current])

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
		isReady: !!scanner,
		start: () => scanner?.start(),
		stop: () => scanner?.stop,
		pause: () => scanner?.pause(),
		data,
		hasCamera,
		listCameras: () => QrScanner.listCameras(),
		cameras,
		setCamera: (facingModeOrDeviceId: FacingMode | DeviceId) =>
			scanner?.setCamera(facingModeOrDeviceId),
		hasFlash: () => scanner?.hasFlash(),
		isFlashOn: () => scanner?.isFlashOn(),
		turnFlashOn: () => scanner?.turnFlashOn(),
		turnFlashOff: () => scanner?.turnFlashOff(),
		updateOverlayColor: (color: string) => scanner?.updateOverlayColor(color),
		destroy: () => scanner?.destroy(),
	}
}
