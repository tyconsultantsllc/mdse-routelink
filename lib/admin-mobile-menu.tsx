"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface AdminMobileMenuContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const AdminMobileMenuContext = createContext<AdminMobileMenuContextValue | null>(null)

/**
 * Shared open/closed state for the mobile nav drawer on the admin portal.
 * AdminSidebar (the drawer itself, with its own hamburger button in its own
 * top bar) and AdminHeader (the per-page header, which also has a hamburger
 * button meant to open that same drawer) are rendered as independent
 * siblings by every admin page individually - there's no shared parent
 * between the two components directly, so this state lives here instead,
 * provided once from app/admin/layout.tsx (which already wraps every route
 * under /admin) and read by both components.
 */
export function AdminMobileMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const value: AdminMobileMenuContextValue = {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  }

  return <AdminMobileMenuContext.Provider value={value}>{children}</AdminMobileMenuContext.Provider>
}

/**
 * Falls back to a harmless, always-closed no-op instead of throwing if
 * somehow used outside AdminMobileMenuProvider, so a future page structure
 * change degrades to "the button silently does nothing" rather than
 * crashing the page.
 */
export function useAdminMobileMenu(): AdminMobileMenuContextValue {
  const ctx = useContext(AdminMobileMenuContext)
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useAdminMobileMenu() was called outside an AdminMobileMenuProvider")
    }
    return { isOpen: false, open: () => {}, close: () => {}, toggle: () => {} }
  }
  return ctx
}
