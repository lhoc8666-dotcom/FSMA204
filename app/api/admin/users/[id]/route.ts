import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { logAdminAction } from "@/lib/utils/admin-audit-logger"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params

    console.log("[v0] Fetching user details for ID:", userId)

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Current user ID:", user.id)

    // Get current user's profile to check role and company
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, company_id, organization_type")
      .eq("id", user.id)
      .single()

    if (profileError || !currentProfile) {
      console.error("[v0] Current profile error:", profileError)
      return NextResponse.json({ error: "User profile not found" }, { status: 403 })
    }

    console.log("[v0] Current profile:", currentProfile)

    const isSystemAdmin = currentProfile.role === "system_admin"
    const isAdmin = currentProfile.role === "admin"

    if (!isSystemAdmin && !isAdmin) {
      console.error("[v0] Insufficient permissions. Role:", currentProfile.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const adminClient = createServiceRoleClient()

    let email = "N/A"
    let lastSignIn = null
    let authUser = null

    try {
      const { data: authData, error: authDataError } = await adminClient.auth.admin.getUserById(userId)

      if (authDataError) {
        console.error("[v0] Auth data fetch error:", authDataError)
        return NextResponse.json({ error: "User not found in authentication system" }, { status: 404 })
      } else if (authData && authData.user) {
        authUser = authData.user
        email = authData.user.email || "N/A"
        lastSignIn = authData.user.last_sign_in_at
      }
    } catch (authErr) {
      console.error("[v0] Failed to fetch auth data:", authErr)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: profile, error: userError } = await adminClient
      .from("profiles")
      .select(
        "id, company_id, full_name, role, phone, language_preference, created_at, updated_at, organization_type, allowed_cte_types",
      )
      .eq("id", userId)
      .single()

    if (userError && userError.code !== "PGRST116") {
      console.error("[v0] User fetch error:", userError)
      return NextResponse.json({ error: "Error fetching user profile", details: userError.message }, { status: 500 })
    }

    const userProfile = profile || {
      id: userId,
      company_id: null,
      full_name: authUser?.user_metadata?.full_name || email,
      role: authUser?.user_metadata?.role || "viewer",
      phone: null,
      language_preference: "vi",
      created_at: authUser?.created_at || new Date().toISOString(),
      updated_at: authUser?.updated_at || new Date().toISOString(),
      organization_type: null,
      allowed_cte_types: null,
    }

    console.log("[v0] User profile:", userProfile)

    if (!isSystemAdmin && userProfile.company_id && userProfile.company_id !== currentProfile.company_id) {
      console.error("[v0] Company mismatch. Target:", userProfile.company_id, "Current:", currentProfile.company_id)
      return NextResponse.json({ error: "Cannot access users from other companies" }, { status: 403 })
    }

    console.log("[v0] Returning user data with email:", email)

    return NextResponse.json({
      profile: userProfile,
      auth: {
        email,
        last_sign_in_at: lastSignIn,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error fetching user details:", error)
    return NextResponse.json({ error: error.message || "Internal server error", stack: error.stack }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params
    const body = await request.json()

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Current user ID:", user.id)

    // Get current user's profile to check role and company
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role, company_id, organization_type")
      .eq("id", user.id)
      .single()

    if (profileError || !currentProfile) {
      console.error("[v0] Current profile error:", profileError)
      return NextResponse.json({ error: "User profile not found" }, { status: 403 })
    }

    console.log("[v0] Current profile:", currentProfile)

    const isSystemAdmin = currentProfile.role === "system_admin"
    const isAdmin = currentProfile.role === "admin"

    if (!isSystemAdmin && !isAdmin) {
      console.error("[v0] Insufficient permissions. Role:", currentProfile.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const adminClient = createServiceRoleClient()

    // Get target user to check authorization
    const { data: targetUser, error: targetError } = await adminClient
      .from("profiles")
      .select("company_id, role, organization_type")
      .eq("id", userId)
      .single()

    if (targetError) {
      console.error("[v0] Target user error:", targetError)
      return NextResponse.json({ error: "User not found", details: targetError.message }, { status: 404 })
    }

    if (!targetUser) {
      console.error("[v0] Target user profile is null for ID:", userId)
      return NextResponse.json({ error: "User profile is null" }, { status: 404 })
    }

    console.log("[v0] Target user profile:", targetUser)

    // Authorization check: Company admin can only update users in their company
    if (!isSystemAdmin && targetUser.company_id && targetUser.company_id !== currentProfile.company_id) {
      console.error("[v0] Company mismatch. Target:", targetUser.company_id, "Current:", currentProfile.company_id)
      return NextResponse.json({ error: "Cannot update users from other companies" }, { status: 403 })
    }

    // Prevent non-system admins from creating/modifying system admins or other admins
    if (!isSystemAdmin && (body.role === "system_admin" || body.role === "admin")) {
      console.error("[v0] Attempting to assign admin or system admin role by non-system admin")
      return NextResponse.json({ error: "Cannot assign admin or system admin role" }, { status: 403 })
    }

    // Prevent non-system admins from modifying admins
    if (!isSystemAdmin && (targetUser.role === "admin" || targetUser.role === "system_admin")) {
      console.error("[v0] Attempting to modify admin user by non-system admin")
      return NextResponse.json({ error: "Cannot modify admin users" }, { status: 403 })
    }

    const beforeState = {
      full_name: targetUser.full_name,
      role: targetUser.role,
      phone: targetUser.phone,
      company_id: targetUser.company_id,
      organization_type: targetUser.organization_type,
    }

    // Update profile
    const updates = {
      full_name: body.full_name,
      role: body.role,
      phone: body.phone,
      company_id: body.company_id,
      language_preference: body.language_preference,
      organization_type: body.organization_type,
      allowed_cte_types: body.allowed_cte_types,
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await adminClient.from("profiles").update(updates).eq("id", userId)

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      throw new Error(updateError.message)
    }

    const roleChanged = beforeState.role !== body.role
    await logAdminAction({
      action: roleChanged ? "user_role_change" : "user_update",
      targetUserId: userId,
      targetCompanyId: body.company_id,
      description: roleChanged
        ? `Changed user role from ${beforeState.role} to ${body.role} for user: ${body.full_name}`
        : `Updated user profile for: ${body.full_name}`,
      changes: {
        before: beforeState,
        after: updates,
      },
      metadata: {
        updated_fields: Object.keys(body),
        role_changed: roleChanged,
        old_role: beforeState.role,
        new_role: body.role,
      },
      severity: roleChanged ? "high" : "medium",
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error updating user:", error)
    return NextResponse.json({ error: error.message || "Internal server error", stack: error.stack }, { status: 500 })
  }
}
