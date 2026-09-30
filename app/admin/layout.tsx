import { AnnouncementBanner } from "@/components/announcement-banner"
import { AdminMobileMenuProvider } from "@/lib/admin-mobile-menu"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminMobileMenuProvider>
      <AnnouncementBanner />
      {children}
    </AdminMobileMenuProvider>
  )
}
