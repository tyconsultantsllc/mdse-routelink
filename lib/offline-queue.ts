// A small durable queue for the handful of driver actions that must never
// silently vanish just because a delivery van lost signal for a minute:
// starting a stop, confirming a delivery, marking one failed, and recording
// a barcode scan. IndexedDB (not localStorage) is used because a delivery
// confirmation carries base64 photo/signature data that can be several MB -
// comfortably past what localStorage can reliably hold.
//
// This is intentionally simple: actions are stored and replayed in the
// order they were queued, one at a time. If replaying an item fails, the
// whole queue stops for that pass rather than skipping or dropping
// anything - it'll be retried automatically next time the app comes back
// online (or on the periodic timer in app/driver/page.tsx), rather than
// ever silently discarding something a driver recorded.

export type OfflineActionType = "startStop" | "confirmDelivery" | "failDelivery" | "scan"

export interface QueuedAction {
  id: number
  type: OfflineActionType
  payload: any
  queuedAt: number
}

const DB_NAME = "routelink-offline-queue"
const STORE_NAME = "actions"
const DB_VERSION = 1

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser"))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function enqueueOfflineAction(type: OfflineActionType, payload: any): Promise<void> {
  const db = await openQueueDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).add({ type, payload, queuedAt: Date.now() })
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  const db = await openQueueDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      db.close()
      resolve(request.result as QueuedAction[])
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function deleteQueuedAction(id: number): Promise<void> {
  const db = await openQueueDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function countQueuedActions(): Promise<number> {
  try {
    const items = await getQueuedActions()
    return items.length
  } catch {
    // IndexedDB can be unavailable (private browsing in some browsers,
    // storage disabled by policy) - treat that as "nothing queued" rather
    // than crashing the page over what's ultimately a convenience feature.
    return 0
  }
}

// A fetch/network-level failure looks like a TypeError in every browser
// (Supabase's client is a thin wrapper over fetch, so this applies to its
// calls too) - that's the signal used everywhere in this module to decide
// "queue this for later" instead of "show the driver a real error".
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  return error instanceof TypeError
}
