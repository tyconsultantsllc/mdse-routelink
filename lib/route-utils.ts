export function generateStreetPath(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  numWaypoints = 8,
): [number, number][] {
  const path: [number, number][] = [[start.lat, start.lng]]

  // Calculate the total distance and direction
  const latDiff = end.lat - start.lat
  const lngDiff = end.lng - start.lng

  // Determine if we should go more north-south or east-west first
  const goVerticalFirst = Math.abs(latDiff) > Math.abs(lngDiff)

  // Generate waypoints that follow a street grid pattern
  for (let i = 1; i < numWaypoints; i++) {
    const progress = i / numWaypoints

    // Add some randomness to make it look more realistic
    const randomOffset = (Math.random() - 0.5) * 0.002

    if (goVerticalFirst) {
      // Go vertical first, then horizontal
      if (progress < 0.6) {
        // Moving vertically
        path.push([start.lat + latDiff * (progress / 0.6) + randomOffset, start.lng + lngDiff * 0.1 + randomOffset])
      } else {
        // Moving horizontally
        const horizontalProgress = (progress - 0.6) / 0.4
        path.push([
          start.lat + latDiff * 0.95 + randomOffset,
          start.lng + lngDiff * 0.1 + lngDiff * 0.9 * horizontalProgress + randomOffset,
        ])
      }
    } else {
      // Go horizontal first, then vertical
      if (progress < 0.6) {
        // Moving horizontally
        path.push([start.lat + latDiff * 0.1 + randomOffset, start.lng + lngDiff * (progress / 0.6) + randomOffset])
      } else {
        // Moving vertically
        const verticalProgress = (progress - 0.6) / 0.4
        path.push([
          start.lat + latDiff * 0.1 + latDiff * 0.9 * verticalProgress + randomOffset,
          start.lng + lngDiff * 0.95 + randomOffset,
        ])
      }
    }

    // Add occasional turns to simulate street corners
    if (i % 3 === 0 && i < numWaypoints - 1) {
      const lastPoint = path[path.length - 1]
      path.push([lastPoint[0] + (Math.random() - 0.5) * 0.003, lastPoint[1] + (Math.random() - 0.5) * 0.003])
    }
  }

  path.push([end.lat, end.lng])
  return path
}

export function generateMultiStopStreetPath(stops: { lat: number; lng: number }[]): [number, number][] {
  if (stops.length < 2) return stops.map((s) => [s.lat, s.lng])

  const fullPath: [number, number][] = []

  for (let i = 0; i < stops.length - 1; i++) {
    const segmentPath = generateStreetPath(stops[i], stops[i + 1], 6)
    // Add all points except the last one (to avoid duplicates)
    fullPath.push(...segmentPath.slice(0, -1))
  }

  // Add the final destination
  fullPath.push([stops[stops.length - 1].lat, stops[stops.length - 1].lng])

  return fullPath
}
