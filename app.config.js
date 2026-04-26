/**
 * Expo dynamic config — wraps app.json so EAS can build a side-by-side
 * "development" variant with a different bundle ID and an ATS exception
 * for the owner's Tailscale tailnet.
 *
 * Production builds (APP_VARIANT unset) are byte-identical to app.json.
 *
 * Required env for the dev variant (set as EAS secrets, never committed):
 *   APP_VARIANT=development
 *   RENTAL_VOICE_TAILNET_DOMAIN=<your-tailnet>.ts.net
 *   EXPO_PUBLIC_API_BASE_URL=http://<host>.<your-tailnet>.ts.net:3001
 *
 * Set with: eas secret:create --scope project --name <NAME> --value <VAL>
 */
const baseConfig = require('./app.json').expo;

module.exports = () => {
  const isDev = process.env.APP_VARIANT === 'development';
  if (!isDev) return baseConfig;

  const tailnetDomain = process.env.RENTAL_VOICE_TAILNET_DOMAIN;
  if (!tailnetDomain) {
    throw new Error(
      'RENTAL_VOICE_TAILNET_DOMAIN must be set for the development variant. ' +
        'Run: eas secret:create --scope project --name RENTAL_VOICE_TAILNET_DOMAIN --value <your-tailnet>.ts.net'
    );
  }

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
            [tailnetDomain]: {
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
