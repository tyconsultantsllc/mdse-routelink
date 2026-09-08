import { Badge } from "@/components/ui/badge"
import { REGION_LABELS, REGION_COLORS, type Region } from "@/lib/region-utils"

interface RegionBadgeProps {
  region: Region | null | undefined
  className?: string
}

export function RegionBadge({ region, className }: RegionBadgeProps) {
  if (!region) {
    return (
      <Badge variant="outline" className={`text-muted-foreground ${className || ""}`}>
        No region
      </Badge>
    )
  }

  return <Badge className={`${REGION_COLORS[region]} border ${className || ""}`}>{REGION_LABELS[region]}</Badge>
}
