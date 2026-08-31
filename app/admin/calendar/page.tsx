"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, Plus, CalendarIcon } from 'lucide-react'
import { useState, useEffect } from "react"
import { AddRouteModal } from "@/components/add-route-modal"
import { getRoutes, getUsers } from "@/app/actions/data-actions"
import { useToast } from "@/components/ui/use-toast"

interface ScheduledRoute {
  id: number
  name: string
  driver: string
  driverAvatar: string
  startTime: string
  endTime: string
  priority: "low" | "medium" | "high" | "urgent"
  stops: number
  status: "scheduled" | "in-progress" | "completed"
}

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [addRouteModalOpen, setAddRouteModalOpen] = useState(false)
  const [scheduledRoutes, setScheduledRoutes] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchRoutes()
  }, [currentDate])

  const fetchRoutes = async () => {
    try {
      const [routes, users] = await Promise.all([getRoutes(), getUsers()])
      
      const groupedRoutes: Record<string, any[]> = {}
      routes.forEach((route: any) => {
        if (route.start_time) {
          const dateKey = formatDateKey(new Date(route.start_time))
          if (!groupedRoutes[dateKey]) {
            groupedRoutes[dateKey] = []
          }
          
          const driver = users.find((u: any) => u.id === route.driver_id)
          groupedRoutes[dateKey].push({
            id: route.id,
            name: route.name || 'Unnamed Route',
            driver: driver ? `${driver.first_name} ${driver.last_name}` : 'Unassigned',
            driverAvatar: driver ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${driver.id}` : '',
            startTime: new Date(route.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            endTime: route.end_time ? new Date(route.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            priority: route.priority || 'medium',
            stops: 0, // Would need to join with route_stops table
            status: route.status || 'scheduled'
          })
        }
      })
      
      setScheduledRoutes(groupedRoutes)
    } catch (error) {
      console.error('Error fetching routes:', error)
      toast({
        title: 'Error',
        description: 'Failed to load routes',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-300"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300"
      case "medium":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "low":
        return "bg-gray-100 text-gray-800 border-gray-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "scheduled":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const today = new Date()
  const days = getDaysInMonth(currentDate)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />

      <div className="flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
        <AdminHeader title="Route Calendar" notifications={[]} />

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Schedule and manage delivery routes</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button onClick={() => setAddRouteModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Route
              </Button>
            </div>
          </div>

          {/* Legend */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Urgent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm">High Priority</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">Medium Priority</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-sm">Low Priority</span>
              </div>
            </div>
          </Card>

          {/* Calendar Grid */}
          <Card className="p-6">
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Day Headers */}
              {daysOfWeek.map((day) => (
                <div key={day} className="bg-muted p-3 text-center">
                  <span className="font-semibold text-sm">{day}</span>
                </div>
              ))}

              {/* Calendar Days */}
              {days.map((day, index) => {
                const dateKey = day ? formatDateKey(day) : ""
                const routes = day ? scheduledRoutes[dateKey] || [] : []
                const isToday =
                  day &&
                  day.getDate() === today.getDate() &&
                  day.getMonth() === today.getMonth() &&
                  day.getFullYear() === today.getFullYear()

                return (
                  <div
                    key={index}
                    className={`bg-card p-2 min-h-[120px] ${day ? "cursor-pointer hover:bg-accent/50" : "bg-muted/30"} ${
                      isToday ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => day && setSelectedDate(day)}
                  >
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-sm font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}
                          >
                            {day.getDate()}
                          </span>
                          {routes.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {routes.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          {routes.slice(0, 2).map((route) => (
                            <div
                              key={route.id}
                              className={`text-xs p-1.5 rounded border ${getPriorityColor(route.priority)}`}
                            >
                              <div className="font-medium truncate">{route.name}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Avatar className="h-3 w-3">
                                  <AvatarImage src={route.driverAvatar || "/placeholder.svg"} />
                                  <AvatarFallback>{route.driver[0]}</AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs">{route.startTime}</span>
                              </div>
                            </div>
                          ))}
                          {routes.length > 2 && (
                            <div className="text-xs text-muted-foreground text-center">+{routes.length - 2} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Selected Date Details */}
          {selectedDate && (
            <Card className="mt-6 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {daysOfWeek[selectedDate.getDay()]}, {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()},{" "}
                  {selectedDate.getFullYear()}
                </h3>
                <Button size="sm" onClick={() => setAddRouteModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Route
                </Button>
              </div>

              {scheduledRoutes[formatDateKey(selectedDate)]?.length > 0 ? (
                <div className="space-y-3">
                  {scheduledRoutes[formatDateKey(selectedDate)].map((route) => (
                    <div key={route.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={route.driverAvatar || "/placeholder.svg"} />
                          <AvatarFallback>{route.driver[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{route.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {route.driver} • {route.stops} stops
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {route.startTime} - {route.endTime}
                          </p>
                        </div>
                        <Badge className={getPriorityColor(route.priority)}>
                          {route.priority.charAt(0).toUpperCase() + route.priority.slice(1)}
                        </Badge>
                        <Badge className={getStatusColor(route.status)}>
                          {route.status === "in-progress"
                            ? "In Progress"
                            : route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No routes scheduled for this date</p>
                  <Button className="mt-4" onClick={() => setAddRouteModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule a Route
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <AddRouteModal open={addRouteModalOpen} onOpenChange={setAddRouteModalOpen} />
    </div>
  )
}
