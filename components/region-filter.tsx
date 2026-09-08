"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface RegionFilterProps {
  value: string
  onChange: (value: string) => void
}

export function RegionFilter({ value, onChange }: RegionFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="All Regions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Regions</SelectItem>
        <SelectItem value="socal">Southern California</SelectItem>
        <SelectItem value="minnesota">Minnesota</SelectItem>
      </SelectContent>
    </Select>
  )
}
