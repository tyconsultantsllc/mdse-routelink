export interface Driver {
  id: number
  name: string
  email: string
  phone: string
  status: "active" | "inactive" | "on-break"
  avatar?: string
  currentLocation?: {
    lat: number
    lng: number
  }
}

export interface Pharmacy {
  id: number
  name: string
  address: string
  phone: string
  email: string
  status: "active" | "inactive"
  coordinates: {
    lat: number
    lng: number
  }
}

export interface RouteStop {
  id: number
  pharmacyId: number
  pharmacyName: string
  pickupAddress: string
  dropoffAddress: string
  estimatedTime: number // minutes
  sequence: number // order in route
  status: "pending" | "in-progress" | "completed"
  coordinates: {
    pickup: { lat: number; lng: number }
    dropoff: { lat: number; lng: number }
  }
}

export interface Route {
  id: number
  name: string
  assignedDriverId?: number
  assignedDriverName?: string
  stops: RouteStop[]
  startTime: string
  endTime: string
  estimatedDuration: number // minutes
  priority: "low" | "medium" | "high" | "urgent"
  status: "pending" | "in-progress" | "completed"
  totalDistance: number // miles
  createdAt: string
  completedAt?: string
}

export interface Notification {
  id: number
  type: "info" | "warning" | "error" | "success"
  title: string
  message: string
  timestamp: string
  read: boolean
  routeId?: number
}

export interface PharmacyUser {
  id: number
  pharmacyId: number
  name: string
  email: string
  phone: string
  notificationPreferences: {
    emailNotifications: boolean
    smsNotifications: boolean
    deliveryCompleted: boolean
    deliveryEnRoute: boolean
  }
}
