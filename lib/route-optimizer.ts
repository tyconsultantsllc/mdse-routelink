// Route optimization using a greedy nearest-neighbor algorithm with priority weighting

export interface Stop {
  id?: string
  pharmacy_id?: string
  name?: string
  latitude: number
  longitude: number
  priority?: "urgent" | "high" | "medium" | "low"
  estimated_time?: number
}

export interface OptimizedRoute {
  stops: Stop[]
  totalDistance: number
  estimatedDuration: number
}

// Calculate distance between two points using Haversine formula (in miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// Get priority weight (higher priority = lower weight = visited sooner)
function getPriorityWeight(priority?: string): number {
  switch (priority) {
    case "urgent":
      return 0.5
    case "high":
      return 0.75
    case "medium":
      return 1.0
    case "low":
      return 1.5
    default:
      return 1.0
  }
}

// Nearest neighbor algorithm with priority weighting
export function optimizeRoute(stops: Stop[], startLat?: number, startLon?: number): OptimizedRoute {
  if (stops.length === 0) {
    return {
      stops: [],
      totalDistance: 0,
      estimatedDuration: 0,
    }
  }

  if (stops.length === 1) {
    return {
      stops: stops,
      totalDistance: 0,
      estimatedDuration: stops[0].estimated_time || 30,
    }
  }

  const unvisited = [...stops]
  const optimized: Stop[] = []
  let totalDistance = 0
  let totalDuration = 0

  // Start from provided location or first stop
  let currentLat = startLat || stops[0].latitude
  let currentLon = startLon || stops[0].longitude

  while (unvisited.length > 0) {
    let nearestIndex = 0
    let nearestScore = Number.POSITIVE_INFINITY

    // Find nearest stop considering both distance and priority
    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i]
      const distance = calculateDistance(currentLat, currentLon, stop.latitude, stop.longitude)

      // Priority weight reduces the effective distance
      const priorityWeight = getPriorityWeight(stop.priority)
      const score = distance * priorityWeight

      if (score < nearestScore) {
        nearestScore = score
        nearestIndex = i
      }
    }

    // Add nearest stop to optimized route
    const nextStop = unvisited[nearestIndex]
    optimized.push(nextStop)

    // Calculate actual distance (not weighted)
    const actualDistance = calculateDistance(currentLat, currentLon, nextStop.latitude, nextStop.longitude)

    totalDistance += actualDistance

    // Estimate time: 30 mph average speed + stop time
    const travelTime = (actualDistance / 30) * 60 // minutes
    const stopTime = nextStop.estimated_time || 30 // minutes
    totalDuration += travelTime + stopTime

    // Update current position
    currentLat = nextStop.latitude
    currentLon = nextStop.longitude

    // Remove from unvisited
    unvisited.splice(nearestIndex, 1)
  }

  return {
    stops: optimized,
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedDuration: Math.round(totalDuration),
  }
}

// Optimize stops and assign order numbers
export function optimizeStopsWithOrder(stops: Stop[], startLat?: number, startLon?: number) {
  const optimized = optimizeRoute(stops, startLat, startLon)

  return {
    ...optimized,
    stops: optimized.stops.map((stop, index) => ({
      ...stop,
      stop_order: index + 1,
    })),
  }
}

// Calculate route statistics
export function calculateRouteStats(stops: Stop[]) {
  let totalDistance = 0
  let totalDuration = 0

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i]
    const next = stops[i + 1]

    const distance = calculateDistance(current.latitude, current.longitude, next.latitude, next.longitude)

    totalDistance += distance
    const travelTime = (distance / 30) * 60
    const stopTime = current.estimated_time || 30
    totalDuration += travelTime + stopTime
  }

  // Add final stop time
  if (stops.length > 0) {
    totalDuration += stops[stops.length - 1].estimated_time || 30
  }

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    estimatedDuration: Math.round(totalDuration),
    stopCount: stops.length,
  }
}
