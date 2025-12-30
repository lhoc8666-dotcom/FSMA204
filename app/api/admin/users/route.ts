import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id, organization_type")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (profile.role !== "admin" && profile.role !== "system_admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const isSystemAdmin = profile.role === "system_admin"

    const serviceClient = createServiceRoleClient()

    const { data: authUsers, error: authError } = await serviceClient.auth.admin.listUsers()

    if (authError) {
      console.error("[v0] Failed to list auth users:", authError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Get all profiles
    let profilesQuery = serviceClient
      .from("profiles")
      .select("id, full_name, role, phone, created_at, organization_type, allowed_cte_types, company_id")

    if (!isSystemAdmin && profile.company_id) {
      profilesQuery = profilesQuery.eq("company_id", profile.company_id)
    }

    const { data: profilesData } = await profilesQuery

    // Create a map of profiles by user id
    const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || [])

    // Merge auth users with profiles
    const mergedUsers = (authUsers.users || []).map((authUser) => {
      const userProfile = profilesMap.get(authUser.id)

      return {
        id: authUser.id,
        email: authUser.email || "",
        full_name: userProfile?.full_name || authUser.email || "",
        role: userProfile?.role || "viewer",
        phone: userProfile?.phone || null,
        created_at: userProfile?.created_at || authUser.created_at,
        organization_type: userProfile?.organization_type || null,
        allowed_cte_types: userProfile?.allowed_cte_types || null,
        company_id: userProfile?.company_id || null,
      }
    })

    // Filter by company if not system admin
    let filteredUsers = mergedUsers
    if (!isSystemAdmin && profile.company_id) {
      filteredUsers = mergedUsers.filter((u) => u.company_id === profile.company_id)
    }

    // Sort by created_at descending
    filteredUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    let companiesQuery = serviceClient.from("companies").select("id, name, display_name").order("name")

    if (!isSystemAdmin && profile.company_id) {
      companiesQuery = companiesQuery.eq("id", profile.company_id)
    }

    const { data: companies } = await companiesQuery

    return NextResponse.json({ profiles: filteredUsers, companies: companies || [] })
  } catch (error: any) {
    console.error("[v0] Admin users API error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
