// Shared helper for handing an exported file to the user.
//
// Regular web browsers (and the Android app's own in-browser fallback, if
// ever used outside the wrapped app) get the classic blob + <a download>
// trick, which triggers the browser's normal download flow.
//
// Inside the wrapped native Capacitor app, that trick silently does nothing:
// Android WebViews have no default download-manager integration, so a
// clicked <a download> link there just... doesn't download. The standard
// Capacitor-recommended fix is to write the file into the app's own cache
// with @capacitor/filesystem, then hand it to the OS share sheet with
// @capacitor/share - letting the person save it to Files, share it by email,
// upload it to Drive, or open it in another app, whichever they'd rather do.
//
// Both capacitor packages are safe to import even when this code runs in a
// plain browser tab (no native platform) - Capacitor.isNativePlatform() is
// what actually branches the behavior, so nothing native-only ever runs
// outside the wrapped app.

import { Capacitor } from "@capacitor/core"

export type SaveOrShareResult = { method: "download" } | { method: "share" }

/**
 * Saves `content` as a file named `filename` and hands it off to the person.
 *
 * @param content   Plain text file content (CSV, JSON, or HTML source - not
 *                   binary data).
 * @param filename  Name the file should be saved/shared as, including its
 *                   extension (e.g. "deliveries-report.csv").
 * @param mimeType  MIME type used for the web-download fallback's Blob.
 */
export async function saveOrShareFile(
  content: string,
  filename: string,
  mimeType: string,
): Promise<SaveOrShareResult> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem")
    const { Share } = await import("@capacitor/share")

    const written = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    })

    await Share.share({
      title: filename,
      dialogTitle: `Save or share ${filename}`,
      files: [written.uri],
    })

    return { method: "share" }
  }

  // Unchanged web fallback.
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  return { method: "download" }
}

/** True while running inside the wrapped native Capacitor app. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
