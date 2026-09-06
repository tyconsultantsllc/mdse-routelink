import { createClient } from "@/lib/supabase/client"

export type PharmacyReportType = "problem" | "pickup_request" | "other"

export async function createPharmacyReport(params: {
  pharmacyId: string
  reportedBy: string
  type: PharmacyReportType
  message: string
  routeStopId?: string
}) {
  const supabase = createClient()

  const { error } = await supabase.from("pharmacy_reports").insert({
    pharmacy_id: params.pharmacyId,
    reported_by: params.reportedBy,
    type: params.type,
    message: params.message,
    route_stop_id: params.routeStopId || null,
  })

  if (error) throw new Error(`Could not submit report: ${error.message}`)
}
