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
  // Guard against misconfiguration: the ATS exception below disables HTTPS for
  // ALL subdomains of this domain (NSIncludesSubdomains: true). If the value is
  // ever set to a public TLD or domain, the dev variant would silently allow
  // plaintext HTTP to that whole zone. Tailscale MagicDNS names always end in
  // `.ts.net`, so anchor on that.
  if (!/^[a-z0-9-]+\.ts\.net$/.test(tailnetDomain)) {
    throw new Error(
      `RENTAL_VOICE_TAILNET_DOMAIN must be a Tailscale MagicDNS name ending in .ts.net (got: ${tailnetDomain})`
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
