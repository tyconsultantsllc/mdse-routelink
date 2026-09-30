// A brief branded loading screen shown the instant the app's HTML first
// paints - server-rendered (no "use client", no JS needed to show it), so
// it appears immediately on a hard page load/refresh with zero hydration
// delay, then fades itself out on a pure CSS animation.
//
// This exists because Android 12+ has a hard platform restriction: the
// native, OS-level launch splash can only show a small icon on a plain
// background color, never a full custom image (that's intentional on
// Google's part, not something any app config can override). This overlay
// is how the actual full "logo on white" splash design shows up - as the
// first thing the web page itself renders, right after that brief native
// frame. It's rendered from the root layout, so it appears once per real
// page load (a fresh visit, a refresh, or the Android app's cold start)
// and is skipped on ordinary in-app client-side navigation between pages,
// since Next.js doesn't remount the root layout for those.
//
// The background is intentionally always white, regardless of light/dark
// mode - like most apps' splash screens, this is meant to look the same
// and on-brand every time, not adapt to the visitor's theme.
export function AppLoadingOverlay() {
  return (
    <div id="app-loading-overlay" aria-hidden="true">
      <img src="/mds-express-logo.png" alt="" width={140} height={140} />
      <style>{`
        #app-loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          animation: app-splash-fade 1.8s ease forwards;
        }
        #app-loading-overlay img {
          width: 140px;
          height: 140px;
          animation: app-splash-pop 0.6s ease;
        }
        @keyframes app-splash-fade {
          0%, 65% { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
        @keyframes app-splash-pop {
          0% { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          #app-loading-overlay {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
