import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { tosContent } from '@/data/tos'

export default function Tos() {
	return (
		<div className="p-4">
			<h1 className="sr-only">Terms of Service</h1>
			<article className="w-full max-w-5xl max-h-full overflow-y-auto">
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					className="markdown text-slate-700 dark:text-slate-200"
				>
					{tosContent}
				</ReactMarkdown>
			</article>
		</div>
	)
}
