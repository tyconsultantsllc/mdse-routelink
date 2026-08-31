import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase is not configured, allow access to all pages
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If there's an auth error, allow access (demo mode)
    if (authError) {
      return NextResponse.next()
    }

    // Redirect to login if not authenticated and not on auth pages
    if (!user && !request.nextUrl.pathname.startsWith("/auth") && request.nextUrl.pathname !== "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users from auth pages to their dashboard
    if (user && request.nextUrl.pathname.startsWith("/auth")) {
      try {
        const { data: userData, error: dbError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()

        // If database query fails, just allow access (demo mode)
        if (dbError) {
          return NextResponse.next()
        }

        const url = request.nextUrl.clone()
        if (userData?.role === "admin") {
          url.pathname = "/admin"
        } else if (userData?.role === "driver") {
          url.pathname = "/driver"
        } else if (userData?.role === "pharmacy") {
          url.pathname = "/pharmacy"
        }
        return NextResponse.redirect(url)
      } catch (dbError) {
        // If database query throws, allow access
        return NextResponse.next()
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error("[v0] Middleware error:", error)
    return NextResponse.next()
  }
}
