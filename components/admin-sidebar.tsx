"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Users,
  MapIcon,
  Clock,
  BarChart2,
  LogOut,
  Truck,
  Building2,
  UserCog,
  Menu,
  X,
  TrendingUp,
  CalendarIcon,
  Settings,
  Megaphone,
  MessageSquare,
  AlertCircle,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Users", href: "/admin/users", icon: UserCog },
  { name: "Pharmacies", href: "/admin/pharmacies", icon: Building2 },
  { name: "Drivers", href: "/admin/drivers", icon: Users },
  { name: "Routes", href: "/admin/routes", icon: MapIcon },
  { name: "Calendar", href: "/admin/calendar", icon: CalendarIcon },
  { name: "Messages", href: "/admin/messages", icon: MessageSquare },
  { name: "Pharmacy Reports", href: "/admin/pharmacy-reports", icon: AlertCircle },
  { name: "Delivery Logs", href: "/admin/logs", icon: Clock },
  { name: "Payroll", href: "/admin/payroll", icon: DollarSign },
  { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { name: "Reports", href: "/admin/reports", icon: BarChart2 },
  { name: "Performance", href: "/admin/performance", icon: TrendingUp },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openReportsCount, setOpenReportsCount] = useState(0)
  const [adminName, setAdminName] = useState("Admin User")

  useEffect(() => {
    const loadAdminProfile = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single()
      if (data) {
        const name = `${data.first_name || ""} ${data.last_name || ""}`.trim()
        if (name) setAdminName(name)
      }
    }
    loadAdminProfile()
  }, [])

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      })
    } catch (error) {
      console.error("Sign out error:", error)
      toast({
        title: "Logged Out",
        description: "Signed out locally - your session may still be active on the server.",
      })
    } finally {
      router.push("/auth/login")
    }
  }

  useEffect(() => {
    const checkReports = async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from("pharmacy_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
      setOpenReportsCount(count || 0)
    }
    checkReports()
    const interval = setInterval(checkReports, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Truck className="text-primary h-6 w-6" />
            <span className="ml-2 text-lg font-bold text-foreground">MDSE RouteLink</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={`${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out fixed md:relative inset-y-0 left-0 z-40 md:flex md:flex-shrink-0`}
      >
        <TooltipProvider>
          <div className="flex flex-col w-64 bg-card border-r border-border h-full">
            {/* Logo */}
            <div className="flex items-center justify-center h-16 px-4 bg-primary">
              <Truck className="text-primary-foreground h-8 w-8" />
              <span className="ml-2 text-xl font-bold text-primary-foreground">MDSE RouteLink</span>
            </div>

            {/* Navigation */}
            <div className="flex flex-col flex-grow overflow-y-auto">
              <nav className="flex-1 px-2 py-4 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center px-4 py-2 text-sm font-medium rounded-md group transition-colors ${
                            isActive
                              ? "text-primary-foreground bg-primary"
                              : "text-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          <Icon
                            className={`mr-3 h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}
                          />
                          {item.name}
                          {item.name === "Pharmacy Reports" && openReportsCount > 0 && (
                            <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
                              {openReportsCount > 9 ? "9+" : openReportsCount}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {item.name === "Dashboard" && "View system overview and live tracking"}
                        {item.name === "Users" && "Manage user accounts and roles"}
                        {item.name === "Pharmacies" && "Manage pharmacy locations and details"}
                        {item.name === "Drivers" && "Manage driver accounts and assignments"}
                        {item.name === "Routes" && "Create and manage delivery routes"}
                        {item.name === "Calendar" && "View and schedule routes on calendar"}
                        {item.name === "Delivery Logs" && "View delivery history and records"}
                        {item.name === "Reports" && "View analytics and performance reports"}
                        {item.name === "Performance" && "Monitor driver performance metrics"}
                        {item.name === "Settings" && "Configure system settings and preferences"}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </nav>
            </div>

            {/* User Profile */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" />
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <div className="ml-3">
                  <p className="text-sm font-medium text-foreground">{adminName}</p>
                  <p className="text-xs font-medium text-muted-foreground">Admin</p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-4 w-full bg-transparent" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Log out of your account</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </>
  )
}
