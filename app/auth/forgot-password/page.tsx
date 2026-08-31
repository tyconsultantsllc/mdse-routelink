"use client"

import type React from "react"

import { useState } from "react"
import { Truck, Mail, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) throw resetError

      setSuccess(true)
    } catch (error: any) {
      setError(error.message || "Failed to send reset email")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10 p-6">
        <Card className="w-full max-w-md overflow-hidden shadow-xl">
          <div className="bg-primary py-6 px-8 text-center">
            <Truck className="h-12 w-12 text-primary-foreground mx-auto" />
            <h2 className="mt-2 text-2xl font-bold text-primary-foreground">Check Your Email</h2>
          </div>

          <div className="p-8 text-center">
            <p className="text-muted-foreground mb-6">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <Link href="/auth/login">
              <Button className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-primary/10 p-6">
      <Card className="w-full max-w-md overflow-hidden shadow-xl">
        <div className="bg-primary py-6 px-8 text-center">
          <Truck className="h-12 w-12 text-primary-foreground mx-auto" />
          <h2 className="mt-2 text-2xl font-bold text-primary-foreground">Reset Password</h2>
          <p className="mt-1 text-primary-foreground/80">Enter your email to receive a reset link</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
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

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Back to login
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
