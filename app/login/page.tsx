"use client"

import type React from "react"

import { useState } from "react"
import { Truck, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"

const DEMO_USERS = [
  { email: "admin@pharmatrack.com", password: "admin123", role: "admin", name: "Admin User" },
  { email: "driver1@pharmatrack.com", password: "driver123", role: "driver", name: "John Smith" },
  { email: "driver2@pharmatrack.com", password: "driver123", role: "driver", name: "Sarah Johnson" },
  { email: "pharmacy@pharmatrack.com", password: "pharmacy123", role: "pharmacy", name: "Central Pharmacy" },
]

export default function LoginPage() {
  console.log("[v0] Login page rendering")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    console.log("[v0] Login attempt with email:", email)

    // Find user by credentials
    const user = DEMO_USERS.find((u) => u.email === email && u.password === password)

    if (user) {
      console.log("[v0] User found:", user.name, "Role:", user.role)
      // Store user info and their assigned role
      if (typeof window !== "undefined") {
        localStorage.setItem("userRole", user.role)
        localStorage.setItem("userName", user.name)
        localStorage.setItem("userEmail", user.email)
      }

      // Route based on assigned role
      const targetPath = user.role === "driver" ? "/driver" : user.role === "pharmacy" ? "/pharmacy" : "/admin"
      console.log("[v0] Redirecting to:", targetPath)
      router.push(targetPath)
    } else {
      console.log("[v0] Invalid credentials")
      setError("Invalid email or password")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10 p-6">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-primary py-6 px-8 text-center">
          <Truck className="h-12 w-12 text-primary-foreground mx-auto" />
          <h2 className="mt-2 text-2xl font-bold text-primary-foreground">PharmaTrack Express</h2>
          <p className="mt-1 text-primary-foreground/80">Pharmaceutical Delivery Tracking</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
            <p className="font-semibold mb-1">Demo Accounts:</p>
            <p className="text-muted-foreground">Admin: admin@pharmatrack.com / admin123</p>
            <p className="text-muted-foreground">Driver: driver1@pharmatrack.com / driver123</p>
            <p className="text-muted-foreground">Pharmacy: pharmacy@pharmatrack.com / pharmacy123</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked as boolean)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  Remember me
                </Label>
              </div>
              <Link href="#" className="text-sm font-medium text-primary hover:text-primary/80">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-muted py-4 px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="#" className="font-medium text-primary hover:text-primary/80">
              Contact Admin
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
