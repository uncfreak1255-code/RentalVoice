/**
 * Expo dynamic config — wraps app.json so EAS can build a side-by-side
 * "development" variant with a different bundle ID and an ATS exception
 * for the owner's Tailscale tailnet.
 *
 * Production builds (APP_VARIANT unset) are byte-identical to app.json.
 * Set APP_VARIANT=development in eas.json or local env for the dev variant.
 */
const baseConfig = require('./app.json').expo;

const TAILNET_DOMAIN = 'tail251e71.ts.net';

module.exports = () => {
  const isDev = process.env.APP_VARIANT === 'development';
  if (!isDev) return baseConfig;

  return {
    ...baseConfig,
    name: 'Rental Voice (Dev)',
    ios: {
      ...baseConfig.ios,
      bundleIdentifier: 'com.rentalvoice.app.dev',
      infoPlist: {
        ...baseConfig.ios.infoPlist,
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            [TAILNET_DOMAIN]: {
              NSIncludesSubdomains: true,
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
    },
    android: {
      ...baseConfig.android,
      package: 'com.rentalvoice.app.dev',
    },
  };
};
