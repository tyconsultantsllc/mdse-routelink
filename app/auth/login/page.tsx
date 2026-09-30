"use client"

import type React from "react"
import { useState } from "react"
import { Truck, Mail, Lock, Fingerprint } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { createClient } from "@/lib/supabase/client"
import { finishLogin } from "@/lib/finish-login"
import { useBiometricSignIn } from "@/lib/use-biometric-signin"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const router = useRouter()
  const biometricSignIn = useBiometricSignIn()

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

      const result = await finishLogin(authData.user.id)

      if (!result.ok) {
        setError(result.error)
        setIsLoading(false)
        return
      }

      router.push(result.redirectPath)

    } catch (err) {
      console.error("Login error:", err)
      setError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  const handleBiometricSignIn = async () => {
    setError("")
    setIsBiometricLoading(true)

    const result = await biometricSignIn.signIn()

    if (!result.ok) {
      if (!result.silent && result.error) {
        setError(result.error)
      }
      setIsBiometricLoading(false)
      return
    }

    router.push(result.redirectPath)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10 p-6">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-primary py-6 px-8 text-center">
          <Truck className="h-12 w-12 text-primary-foreground mx-auto" />
          <h2 className="mt-2 text-2xl font-bold text-primary-foreground">MDSE RouteLink</h2>
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

            {/* "Remember me" used to sit here as a checkbox that did nothing -
                sessions already always persist (lib/supabase/client.ts sets
                persistSession: true unconditionally), so the box could never
                actually change how long a session lasts. Making it real
                would mean switching between localStorage and sessionStorage
                per-login, which the shared client singleton doesn't support
                today - removed rather than leave a control with no effect. */}
            <div className="flex justify-end">
              <Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading || isBiometricLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Only shown once we know there's a stored sign-in this can
              actually use - a deliberate tap-to-trigger button, never an
              automatic prompt on page load. */}
          {biometricSignIn.checked && biometricSignIn.available && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isLoading || isBiometricLoading}
                onClick={handleBiometricSignIn}
              >
                <Fingerprint className="mr-2 h-4 w-4" />
                {isBiometricLoading ? "Signing in..." : "Sign in with fingerprint"}
              </Button>
            </>
          )}
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
