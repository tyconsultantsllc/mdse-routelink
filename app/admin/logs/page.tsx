"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AdvancedFilterPanel } from "@/components/advanced-filter-panel"
import { createClient } from "@/lib/supabase/client"
import { getDeliveryLogs, getUsers, getPharmacies } from "@/app/actions/data-actions"

export default function DeliveryLogs() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<any>({
    dateFrom: undefined,
    dateTo: undefined,
    driver: "all",
    pharmacy: "all",
    status: [],
    priority: [],
    minStops: undefined,
    maxStops: undefined,
  })

  const [appliedFilters, setAppliedFilters] = useState<any>({})
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeliveryLogs()
  }, [])

  const fetchDeliveryLogs = async () => {
    try {
      const [logsData, usersData, pharmaciesData] = await Promise.all([
        getDeliveryLogs(),
        getUsers(),
        getPharmacies()
      ])

      setDeliveries(
        logsData?.map((d: any) => {
          const driver = usersData.find((u: any) => u.id === d.driver_id && u.role === "driver")
          const pharmacy = pharmaciesData.find((p: any) => p.id === d.pharmacy_id)
          
          return {
            id: d.id,
            driver: driver ? `${driver.first_name} ${driver.last_name}` : "Unknown",
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.driver_id}`,
            pharmacy: pharmacy?.name || "Unknown Pharmacy",
            address: pharmacy?.address || "N/A",
            date: new Date(d.timestamp || d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            time: new Date(d.timestamp || d.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            status: d.status || "pending",
            priority: "medium",
            stops: 1,
          }
        }) || []
      )
    } catch (error) {
      console.error("Error fetching delivery logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        delivery.id.toLowerCase().includes(query) ||
        delivery.driver.toLowerCase().includes(query) ||
        delivery.pharmacy.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Advanced filters
    if (appliedFilters.status && appliedFilters.status.length > 0) {
      if (!appliedFilters.status.includes(delivery.status)) return false
    }

    if (appliedFilters.priority && appliedFilters.priority.length > 0) {
      if (!appliedFilters.priority.includes(delivery.priority)) return false
    }

    if (appliedFilters.minStops !== undefined) {
      if (delivery.stops < appliedFilters.minStops) return false
    }

    if (appliedFilters.maxStops !== undefined) {
      if (delivery.stops > appliedFilters.maxStops) return false
    }

    return true
  })

  const handleApplyFilters = () => {
    setAppliedFilters(filters)
    setShowFilters(false)
  }

  const handleResetFilters = () => {
    const resetFilters = {
      dateFrom: undefined,
      dateTo: undefined,
      driver: "all",
      pharmacy: "all",
      status: [],
      priority: [],
      minStops: undefined,
      maxStops: undefined,
    }
    setFilters(resetFilters)
    setAppliedFilters(resetFilters)
  }

  const activeFilterCount = [
    ...(appliedFilters.status || []),
    ...(appliedFilters.priority || []),
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.driver !== "all" ? appliedFilters.driver : null,
    appliedFilters.pharmacy !== "all" ? appliedFilters.pharmacy : null,
    appliedFilters.minStops,
    appliedFilters.maxStops,
  ].filter(Boolean).length

  const totalResults = filteredDeliveries.length
  const resultsPerPage = 10
  const currentPage = 1
  const startResult = (currentPage - 1) * resultsPerPage + 1
  const endResult = Math.min(currentPage * resultsPerPage, totalResults)

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden pt-16 md:pt-0">
          <AdminHeader title="Delivery Logs" />

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Search and Filters */}
            <Card className="p-6 mb-6">
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by delivery ID, driver, or pharmacy..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showFilters ? "default" : "outline"}
                        onClick={() => setShowFilters(!showFilters)}
                        className="relative"
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                        {activeFilterCount > 0 && (
                          <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="secondary">
                            {activeFilterCount}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showFilters ? "Hide advanced filters" : "Show advanced filters"}</TooltipContent>
                  </Tooltip>
                  {activeFilterCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleResetFilters}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Clear all filters</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(appliedFilters.status || []).map((status: string) => (
                      <Badge key={status} variant="secondary" className="gap-1">
                        Status: {status}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            const newStatus = appliedFilters.status.filter((s: string) => s !== status)
                            setAppliedFilters({ ...appliedFilters, status: newStatus })
                          }}
                        />
                      </Badge>
                    ))}
                    {(appliedFilters.priority || []).map((priority: string) => (
                      <Badge key={priority} variant="secondary" className="gap-1">
                        Priority: {priority}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => {
                            const newPriority = appliedFilters.priority.filter((p: string) => p !== priority)
                            setAppliedFilters({ ...appliedFilters, priority: newPriority })
                          }}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {showFilters && (
              <div className="mb-6">
                <AdvancedFilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClose={() => setShowFilters(false)}
                  onApply={handleApplyFilters}
                  onReset={handleResetFilters}
                />
              </div>
            )}

            {/* Delivery Logs Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Delivery ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pharmacy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Stops
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                          Loading delivery logs...
                        </td>
                      </tr>
                    ) : filteredDeliveries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                          No deliveries found matching your filters
                        </td>
                      </tr>
                    ) : (
                      filteredDeliveries.map((delivery) => (
                        <tr key={delivery.id} className="hover:bg-accent transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-foreground">{delivery.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={delivery.avatar || "/placeholder.svg"} />
                                <AvatarFallback>{delivery.driver[0]}</AvatarFallback>
                              </Avatar>
                              <span className="ml-2 text-sm text-foreground">{delivery.driver}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{delivery.pharmacy}</div>
                            <div className="text-sm text-muted-foreground">{delivery.address}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{delivery.date}</div>
                            <div className="text-sm text-muted-foreground">{delivery.time}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-foreground">{delivery.stops}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              className={
                                delivery.priority === "urgent"
                                  ? "bg-red-100 text-red-800 hover:bg-red-100"
                                  : delivery.priority === "high"
                                    ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                    : delivery.priority === "medium"
                                      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                      : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                              }
                            >
                              {delivery.priority.charAt(0).toUpperCase() + delivery.priority.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              className={
                                delivery.status === "completed"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : delivery.status === "in-progress"
                                    ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                    : delivery.status === "pending"
                                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                      : "bg-red-100 text-red-800 hover:bg-red-100"
                              }
                            >
                              {delivery.status === "in-progress"
                                ? "In Progress"
                                : delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="link" className="p-0 h-auto">
                                  View Details
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View full delivery information</TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-card px-4 py-3 border-t border-border sm:px-6">
                <div className="flex-1 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="font-medium">{totalResults > 0 ? startResult : 0}</span> to{" "}
                      <span className="font-medium">{endResult}</span> of{" "}
                      <span className="font-medium">{totalResults}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-r-none bg-transparent">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Previous page</TooltipContent>
                      </Tooltip>
                      <Button variant="outline" size="sm" className="rounded-none bg-transparent">
                        1
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-none bg-transparent">
                        2
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-none bg-transparent">
                        3
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-l-none bg-transparent">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Next page</TooltipContent>
                      </Tooltip>
                    </nav>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
