"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"

interface FilterOptions {
  dateFrom?: Date
  dateTo?: Date
  driver?: string
  pharmacy?: string
  status?: string[]
  priority?: string[]
  minStops?: number
  maxStops?: number
}

interface AdvancedFilterPanelProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  onClose: () => void
  onApply: () => void
  onReset: () => void
}

const statusOptions = [
  { value: "completed", label: "Completed" },
  { value: "in-progress", label: "In Progress" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const priorityOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

export function AdvancedFilterPanel({ filters, onFiltersChange, onClose, onApply, onReset }: AdvancedFilterPanelProps) {
  const handleStatusToggle = (status: string) => {
    const currentStatus = filters.status || []
    const newStatus = currentStatus.includes(status)
      ? currentStatus.filter((s) => s !== status)
      : [...currentStatus, status]
    onFiltersChange({ ...filters, status: newStatus })
  }

  const handlePriorityToggle = (priority: string) => {
    const currentPriority = filters.priority || []
    const newPriority = currentPriority.includes(priority)
      ? currentPriority.filter((p) => p !== priority)
      : [...currentPriority, priority]
    onFiltersChange({ ...filters, priority: newPriority })
  }

  return (
    <div className="bg-card border rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Advanced Filters</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Date Range */}
        <div className="space-y-2">
          <Label>Date From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateFrom}
                onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Date To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(filters.dateTo, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.dateTo}
                onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Driver Selection */}
        <div className="space-y-2">
          <Label htmlFor="driverFilter">Driver</Label>
          <Select value={filters.driver} onValueChange={(value) => onFiltersChange({ ...filters, driver: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              <SelectItem value="john-smith">John Smith</SelectItem>
              <SelectItem value="maria-garcia">Maria Garcia</SelectItem>
              <SelectItem value="robert-johnson">Robert Johnson</SelectItem>
              <SelectItem value="sarah-williams">Sarah Williams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Pharmacy Selection */}
        <div className="space-y-2">
          <Label htmlFor="pharmacyFilter">Pharmacy</Label>
          <Select value={filters.pharmacy} onValueChange={(value) => onFiltersChange({ ...filters, pharmacy: value })}>
            <SelectTrigger>
              <SelectValue placeholder="All Pharmacies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pharmacies</SelectItem>
              <SelectItem value="medlife">MedLife Downtown</SelectItem>
              <SelectItem value="northside">Northside Medical</SelectItem>
              <SelectItem value="central">Central Health</SelectItem>
              <SelectItem value="westside">Westside Pharmacy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Number of Stops Range */}
        <div className="space-y-2">
          <Label htmlFor="minStops">Min Stops</Label>
          <Input
            id="minStops"
            type="number"
            placeholder="0"
            value={filters.minStops || ""}
            onChange={(e) => onFiltersChange({ ...filters, minStops: Number.parseInt(e.target.value) || undefined })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxStops">Max Stops</Label>
          <Input
            id="maxStops"
            type="number"
            placeholder="100"
            value={filters.maxStops || ""}
            onChange={(e) => onFiltersChange({ ...filters, maxStops: Number.parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>

      {/* Status Checkboxes */}
      <div className="space-y-3">
        <Label>Status</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statusOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${option.value}`}
                checked={filters.status?.includes(option.value)}
                onCheckedChange={() => handleStatusToggle(option.value)}
              />
              <Label htmlFor={`status-${option.value}`} className="text-sm font-normal cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Checkboxes */}
      <div className="space-y-3">
        <Label>Priority</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {priorityOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`priority-${option.value}`}
                checked={filters.priority?.includes(option.value)}
                onCheckedChange={() => handlePriorityToggle(option.value)}
              />
              <Label htmlFor={`priority-${option.value}`} className="text-sm font-normal cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onReset}>
          Clear All
        </Button>
        <Button onClick={onApply}>Apply Filters</Button>
      </div>
    </div>
  )
}
