"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Every 15-minute mark across a 24-hour day, e.g. "00:00", "00:15", ... "23:45".
// Stored/returned as 24-hour "HH:MM" to stay compatible with the rest of the
// app (Postgres TIME columns, timestamp math, etc.) - only the on-screen
// label is 12-hour.
const TIME_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const options: Array<{ value: string; label: string }> = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      const period = h < 12 ? "AM" : "PM"
      const hour12 = h % 12 === 0 ? 12 : h % 12
      const label = `${hour12}:${m.toString().padStart(2, "0")} ${period}`
      options.push({ value, label })
    }
  }
  return options
})()

const NONE = "__none__"

interface TimeSelectProps {
  id?: string
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Whether an explicit "No time set" option is offered to clear the value. Default true. */
  allowClear?: boolean
}

/**
 * A time picker restricted to 15-minute increments. Replaces the native
 * <input type="time" step={900}> used previously - the step attribute only
 * hints at 15-minute increments to the browser's own picker/spinner and
 * doesn't reliably stop someone from typing an off-increment value, so this
 * offers only the 96 valid times as actual selectable options instead.
 */
export function TimeSelect({ id, value, onChange, placeholder = "Select time", disabled, className, allowClear = true }: TimeSelectProps) {
  return (
    <Select
      value={value ? value : allowClear ? NONE : undefined}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear && <SelectItem value={NONE}>No time set</SelectItem>}
        {TIME_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
