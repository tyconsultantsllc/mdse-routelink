"use client"

import type React from "react"
import { useState } from "react"
import { Truck, Mail, Lock } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { createClient } from "@/lib/supabase/client"
import { getUserRole } from "@/app/auth/actions"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        setError("Login failed. Please try again.")
        setIsLoading(false)
        return
      }

      const result = await getUserRole(authData.user.id)

      if (result.error) {
        setError(result.error)
        setIsLoading(false)
        return
      }

      if (!result.data) {
        setError("User account not found. Please contact your administrator to set up your account.")
        setIsLoading(false)
        return
      }

      const userRecord = result.data

      localStorage.setItem("userRole", userRecord.role)
      localStorage.setItem("userEmail", userRecord.email)
      localStorage.setItem("userName", `${userRecord.first_name} ${userRecord.last_name}`)
      
      const rolePaths: Record<string, string> = {
        admin: "/admin",
        driver: "/driver",
        pharmacy: "/pharmacy",
      }

      const redirectPath = rolePaths[userRecord.role] || "/admin"
      router.push(redirectPath)
      
    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
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
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive whitespace-pre-wrap">
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
              <Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
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
            Need access?{" "}
            <Link href="#" className="font-medium text-primary hover:text-primary/80">
              Contact your administrator
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
