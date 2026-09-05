import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (request.nextUrl.pathname.startsWith("/auth")) {
    return supabaseResponse
  }

  if (!user && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single()

    const role = userData?.role
    const pathname = request.nextUrl.pathname

    const roleHomePage: Record<string, string> = {
      admin: "/admin",
      driver: "/driver",
      pharmacy: "/pharmacy",
    }

    const isWrongPortal =
      (pathname.startsWith("/admin") && role !== "admin") ||
      (pathname.startsWith("/driver") && role !== "driver") ||
      (pathname.startsWith("/pharmacy") && role !== "pharmacy")

    if (isWrongPortal && role && roleHomePage[role]) {
      const url = request.nextUrl.clone()
      url.pathname = roleHomePage[role]
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
