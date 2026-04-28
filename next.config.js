const path = require('node:path')
const isNextDev = process.argv.includes('dev')

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: false,
	outputFileTracingRoot: path.join(__dirname),
	logging: {
		fetches: {
			fullUrl: true,
		},
	},
	webpack: (config, { isServer }) => {
		config.ignoreWarnings = config.ignoreWarnings || []
		config.ignoreWarnings.push({
			module: /require-in-the-middle/,
			message:
				/Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
		})

		if (!isServer) {
			config.resolve.alias['@sentry/nextjs$'] = path.join(
				__dirname,
				'node_modules/@sentry/nextjs/build/esm/index.client.js',
			)
		}

		return config
	},
}

module.exports = nextConfig

// Injected content via Sentry wizard below

// const { withSentryConfig } = require('@sentry/nextjs')

// module.exports = withSentryConfig(
// 	module.exports,
// 	{
// 		// For all available options, see:
// 		// https://github.com/getsentry/sentry-webpack-plugin#options

// 		// Suppresses source map uploading logs during build
// 		silent: true,
// 	},
// 	{
// 		// For all available options, see:
// 		// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

// 		// Upload a larger set of source maps for prettier stack traces (increases build time)
// 		widenClientFileUpload: true,

// 		// Transpiles SDK to be compatible with IE11 (increases bundle size)
// 		transpileClientSDK: true,

// 		// Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
// 		tunnelRoute: '/monitoring',

// 		// Hides source maps from generated client bundles
// 		hideSourceMaps: true,

// 		// Automatically tree-shake Sentry logger statements to reduce bundle size
// 		disableLogger: true,
// 	},
// )

if (isNextDev && process.env.NEXT_DEV_USE_CF_BINDINGS === 'true') {
	import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
		void initOpenNextCloudflareForDev()
	})
}
