"use client"

import type React from "react"
import { Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationCenter, type Notification } from "@/components/notification-center"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

interface AdminHeaderProps {
  title: string
  children?: React.ReactNode
  notifications?: Notification[]
  onMarkAsRead?: (id: string) => void
  onMarkAllAsRead?: () => void
  onDismiss?: (id: string) => void
}

export function AdminHeader({
  title,
  children,
  notifications = [],
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onDismiss = () => {},
}: AdminHeaderProps) {
  const router = useRouter()
  const { toast } = useToast()

  const handleLogout = () => {
    localStorage.removeItem("pharmatrack_user")
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out",
    })
    router.push("/login")
  }

  return (
    <div className="flex-shrink-0 bg-card border-b border-border">
      <div className="flex justify-between items-center h-16 px-4">
        <div className="flex items-center md:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-lg font-medium text-foreground">{title}</h1>
          </div>
          <div className="ml-4 flex items-center md:ml-6 gap-2">
            {children}
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onDismiss={onDismiss}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Logout</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  )
}
