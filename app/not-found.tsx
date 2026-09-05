import Link from "next/link"
import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
      <Truck className="h-12 w-12 text-primary mb-4" />
      <h1 className="text-3xl font-bold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Button asChild>
        <Link href="/">Back to MDSE RouteLink</Link>
      </Button>
    </div>
  )
}
