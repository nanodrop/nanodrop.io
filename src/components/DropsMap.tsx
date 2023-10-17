import useCountryDrop from '@/hooks/useCountryDrops'
import { useEffect, useRef, useState } from 'react'
import WorldMap, { DataItem } from 'react-svg-worldmap'
import { slate } from 'tailwindcss/colors'
interface DropsMapProps {
	theme: 'light' | 'dark'
}

export default function DropsMap({ theme }: DropsMapProps) {
	const { data } = useCountryDrop()

	const mapData: DataItem[] = data
		? Object.entries(data).map(([country, value]) => ({
				country,
				value,
		  }))
		: []

	const [width, setWidth] = useState(0)

	const containerRef = useRef<HTMLDivElement>(null)

	const loadWidth = () => {
		if (containerRef.current) {
			const rect = containerRef.current.getBoundingClientRect()

			// ensure 3/4 aspect ratio
			setWidth(
				rect.width > (rect.height * 4) / 3 ? (rect.height * 4) / 3 : rect.width,
			)
		}
	}

	useEffect(loadWidth, [containerRef])

	useEffect(() => {
		window.addEventListener('resize', loadWidth)
		return () => window.removeEventListener('resize', loadWidth)
	}, [])

	return (
		<div
			className="w-full flex flex-col flex-1 items-center justify-center overflow-hidden"
			ref={containerRef}
		>
			<WorldMap
				borderColor={theme === 'dark' ? slate[600] : slate[400]}
				color="#209CE9"
				backgroundColor="transparent"
				value-suffix="people"
				size={width || 'responsive'}
				data={mapData}
				richInteraction
			/>
		</div>
	)
}
