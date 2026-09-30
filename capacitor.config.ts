import type { CapacitorConfig } from '@capacitor/cli';

// IMPORTANT: confirm this is your real production URL before building.
// This app doesn't bundle the web app as static files - it can't, since
// the app relies on Next.js server actions and server-rendered pages that
// only work with a real Next.js server behind them (a static export would
// break login, route assignment, delivery confirmation, everything that
// currently goes through app/actions/data-actions.ts). Instead, the
// Android app's WebView is pointed straight at your live, deployed site
// below - functionally the same as a mobile browser tab, just wrapped in a
// real installable app with its own icon and (once added) access to native
// device features.
const PRODUCTION_URL = 'https://mdse-routelink-git.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.mdseroutelink.app',
  appName: 'MDSE RouteLink',
  // Only used as a local fallback/placeholder - see www/index.html and the
  // comment above. The real content always comes from server.url below.
  webDir: 'www',
  server: {
    url: PRODUCTION_URL,
    // Keeps cookies/session storage scoped to your real domain instead of
    // Capacitor's default "https://localhost" origin, so Supabase auth
    // (which relies on cookies) behaves exactly like it does in a browser.
    androidScheme: 'https',
  },
  android: {
    // Since everything here is served over https, there's no legitimate
    // reason for the WebView to ever load insecure (http) content - block
    // it outright rather than silently allowing it.
    allowMixedContent: false,
  },
  plugins: {
    // Android 12+ restricts the OS-level launch splash to a small icon on a
    // plain color for the very first instant the app process starts - a
    // platform rule, not a Capacitor limitation, and it can't be made to
    // show a full custom image (see the windowSplashScreen* attributes in
    // android/app/src/main/res/values/styles.xml, which control how that
    // small native splash looks). This plugin just holds that native splash
    // on screen briefly via launchShowDuration, bridging straight into the
    // web app's own full-size branded loading screen
    // (components/app-loading-overlay.tsx), which is where the real "big
    // logo" splash design actually lives. So this duration is intentionally
    // short - just long enough to avoid a flash of blank white before the
    // web content paints, not the whole splash experience.
    SplashScreen: {
      launchShowDuration: 500,
      launchFadeOutDuration: 200,
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
