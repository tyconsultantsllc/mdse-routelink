# Browser tab favicon

Independent of the last round — merges cleanly against current `master`
regardless of whether you've merged `logo-round.zip` yet.

## What this does

- **`app/icon.png`** — the full circular logo badge, transparent corners,
  512×512. Next.js's App Router picks up a file at this exact path
  automatically (no code change needed anywhere else) and generates the
  right `<link rel="icon">` tag for it. This is what shows up in the
  browser tab, bookmarks, and history for admin/pharmacy/driver alike,
  since they all share the same Next.js app.
- **`app/apple-icon.png`** — same logo, 180×180, on a solid white square
  instead of transparent corners. This is the icon iOS uses if someone
  adds the site to their home screen from Safari ("Add to Home Screen").
  iOS applies its own rounded-corner mask on top of whatever image is
  given, and expects a fully opaque square to mask — a transparent PNG
  there can show through to whatever's behind it, so this one intentionally
  isn't transparent like the tab icon is.

This fixes the pre-existing gap I mentioned last round — the web app
never had a favicon (or a home-screen icon for iOS) set up at all before
this. Nothing to do with the Android app specifically; this is the actual
website, for anyone who opens it in a browser.

Takes effect on your next normal Vercel deploy — no rebuild, no native
Android changes involved here at all.

## Files changed
- `app/icon.png` (new)
- `app/apple-icon.png` (new)

## Merge commands (cmd)

```
git add app\icon.png app\apple-icon.png
git commit -m "Add browser tab favicon and iOS home-screen icon"
git push
```
