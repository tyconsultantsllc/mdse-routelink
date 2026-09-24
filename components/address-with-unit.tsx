import { parseAddressUnit } from "@/lib/address-utils"
import { Building2 } from 'lucide-react'

interface AddressWithUnitProps {
  address: string
  className?: string
  /** Size of the unit badge - "sm" for tight table rows, "md" (default) elsewhere. */
  size?: "sm" | "md"
}

export function AddressWithUnit({ address, className, size = "md" }: AddressWithUnitProps) {
  const { mainAddress, unit } = parseAddressUnit(address)

  return (
    <span className={className}>
      {mainAddress}
      {unit && (
        <span
          className={`ml-1.5 inline-flex items-center gap-1 rounded-md bg-amber-400 text-amber-950 font-bold align-middle whitespace-nowrap ${
            size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
          }`}
        >
          <Building2 className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {unit}
        </span>
      )}
    </span>
  )
}
