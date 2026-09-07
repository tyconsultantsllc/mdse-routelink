export const DEFAULT_ON_TIME_GRACE_PERIOD_MINUTES = 15

interface RouteEndTimeLookup {
  end_time: string | null
}

/**
 * A delivery is "on time" if it happened at or before the route's scheduled
 * end_time (set by the admin when creating/editing the route), plus a fixed
 * grace period. Returns null when it can't be determined - a route with no
 * end_time set has no scheduled deadline to measure against.
 */
export function isDeliveryOnTime(
  logTimestamp: string,
  routeEndTime: string | null | undefined,
  gracePeriodMinutes: number,
): boolean | null {
  if (!routeEndTime) return null
  const deadline = new Date(routeEndTime).getTime() + gracePeriodMinutes * 60000
  return new Date(logTimestamp).getTime() <= deadline
}

/**
 * Percentage of delivered logs that were on time, among those where it's
 * actually determinable (i.e. the route had a scheduled end_time). Logs tied
 * to a route with no end_time are excluded rather than counted either way.
 */
export function calculateOnTimeRate(
  logs: Array<{ route_id: string; timestamp: string; action: string }>,
  routesById: Map<string, RouteEndTimeLookup>,
  gracePeriodMinutes: number,
): number {
  const delivered = logs.filter((l) => l.action === "delivered")
  const determinable = delivered.filter((l) => routesById.get(l.route_id)?.end_time)

  if (determinable.length === 0) return 0

  const onTimeCount = determinable.filter(
    (l) => isDeliveryOnTime(l.timestamp, routesById.get(l.route_id)!.end_time, gracePeriodMinutes) === true,
  ).length

  return Math.round((onTimeCount / determinable.length) * 100)
}
