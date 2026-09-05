import { AnnouncementBanner } from "@/components/announcement-banner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBanner />
      {children}
    </>
  )
}
