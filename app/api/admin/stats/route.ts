import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error("[v0] Profile lookup failed:", profileError)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (profile.role !== "admin" && profile.role !== "system_admin") {
      console.error("[v0] Unauthorized access attempt by user:", user.id, "role:", profile.role)
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const isSystemAdmin = profile.role === "system_admin"
    const companyId = profile.company_id

    console.log("[v0] Stats API called by:", user.email, "role:", profile.role, "companyId:", companyId)

    // Use service role client to bypass RLS and get accurate statistics
    const serviceClient = createServiceRoleClient()

    if (isSystemAdmin) {
      const { data: authUsersData } = await serviceClient.auth.admin.listUsers()
      const totalUsers = authUsersData?.users?.length || 0

      const [companiesData, facilitiesData, productsData, tlcsData] = await Promise.all([
        serviceClient.from("companies").select("*", { count: "exact", head: true }),
        serviceClient.from("facilities").select("*", { count: "exact", head: true }),
        serviceClient.from("products").select("*", { count: "exact", head: true }),
        serviceClient.from("traceability_lot_codes").select("*", { count: "exact", head: true }),
      ])

      const stats = {
        totalUsers,
        totalCompanies: companiesData.count || 0,
        totalFacilities: facilitiesData.count || 0,
        totalProducts: productsData.count || 0,
        totalTLCs: tlcsData.count || 0,
      }

      console.log("[v0] System admin stats returned:", stats)

      // Load recent users from profiles
      const { data: recentUsers } = await serviceClient
        .from("profiles")
        .select(
          `
          id,
          full_name,
          email,
          role,
          created_at,
          company_id,
          companies (name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(5)

      return NextResponse.json({ ...stats, recentUsers: recentUsers || [] })
    }

    // Company admin stats
    if (!companyId) {
      console.log("[v0] Admin has no company_id, returning zero stats")
      return NextResponse.json({
        totalUsers: 0,
        totalCompanies: 0,
        totalFacilities: 0,
        totalProducts: 0,
        recentUsers: [],
      })
    }

    console.log("[v0] Filtering stats for company:", companyId)

    const [usersData, facilitiesData, productsData] = await Promise.all([
      serviceClient.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      serviceClient.from("facilities").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      serviceClient.from("products").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ])

    const stats = {
      totalUsers: usersData.count || 0,
      totalCompanies: 1,
      totalFacilities: facilitiesData.count || 0,
      totalProducts: productsData.count || 0,
    }

    console.log("[v0] Company admin stats returned:", stats)

    // Load recent users
    const { data: recentUsers } = await serviceClient
      .from("profiles")
      .select(
        `
        id,
        full_name,
        email,
        role,
        created_at,
        company_id,
        companies (name)
      `,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5)

    return NextResponse.json({ ...stats, recentUsers: recentUsers || [] })
  } catch (error: any) {
    console.error("[v0] Admin stats error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
