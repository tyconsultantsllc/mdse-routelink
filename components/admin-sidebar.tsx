"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { useState } from "react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: Home },
  { name: "Users", href: "/admin/users", icon: UserCog },
  { name: "Pharmacies", href: "/admin/pharmacies", icon: Building2 },
  { name: "Drivers", href: "/admin/drivers", icon: Users },
  { name: "Routes", href: "/admin/routes", icon: MapIcon },
  { name: "Calendar", href: "/admin/calendar", icon: CalendarIcon },
  { name: "Delivery Logs", href: "/admin/logs", icon: Clock },
  { name: "Reports", href: "/admin/reports", icon: BarChart2 },
  { name: "Performance", href: "/admin/performance", icon: TrendingUp },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
                  <p className="text-sm font-medium text-foreground">Admin User</p>
                  <p className="text-xs font-medium text-muted-foreground">Super Admin</p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-4 w-full bg-transparent">
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
