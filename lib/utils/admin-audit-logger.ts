import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"

export type AdminAction =
  | "user_create"
  | "user_update"
  | "user_delete"
  | "user_role_change"
  | "company_create"
  | "company_update"
  | "company_delete"
  | "facility_approve"
  | "facility_reject"
  | "subscription_change"
  | "quota_override"
  | "2fa_enrolled"
  | "2fa_unenrolled"
  | "2fa_verified"
  | "2fa_failed"
  | "admin_login"
  | "admin_logout"
  | "sensitive_data_access"

export interface AdminAuditLog {
  action: AdminAction
  targetUserId?: string
  targetCompanyId?: string
  targetEntityId?: string
  entityType?: string
  description: string
  metadata?: Record<string, any>
  changes?: {
    before: Record<string, any>
    after: Record<string, any>
  }
  ipAddress?: string
  userAgent?: string
  severity?: "low" | "medium" | "high" | "critical"
}

export async function logAdminAction(data: AdminAuditLog): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.error("[v0] Cannot log admin action: No authenticated user")
      return
    }

    // Get user profile for additional context
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id, full_name")
      .eq("id", user.id)
      .single()

    if (!profile || !["system_admin", "admin"].includes(profile.role)) {
      console.error("[v0] Cannot log admin action: User is not an admin")
      return
    }

    const serviceClient = createServiceRoleClient()

    // Log to system_logs table
    await serviceClient.from("system_logs").insert({
      user_id: user.id,
      action: data.action,
      entity_type: data.entityType || "admin_action",
      entity_id: data.targetEntityId || data.targetUserId || data.targetCompanyId || null,
      description: data.description,
      metadata: {
        ...data.metadata,
        admin_role: profile.role,
        admin_name: profile.full_name,
        admin_company_id: profile.company_id,
        target_user_id: data.targetUserId,
        target_company_id: data.targetCompanyId,
        changes: data.changes,
        severity: data.severity || "medium",
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
      },
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
    })

    // Log critical actions separately for enhanced monitoring
    if (data.severity === "critical" || data.action.includes("delete") || data.action.includes("role_change")) {
      console.log("[v0] CRITICAL ADMIN ACTION:", {
        action: data.action,
        admin: profile.full_name,
        role: profile.role,
        description: data.description,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("[v0] Failed to log admin action:", error)
    // Continue execution even if logging fails - don't break the main flow
  }
}

export async function getAdminAuditLogs(filters?: {
  action?: AdminAction
  userId?: string
  adminId?: string
  companyId?: string
  dateFrom?: string
  dateTo?: string
  severity?: string
  limit?: number
}) {
  const serviceClient = createServiceRoleClient()

  let query = serviceClient
    .from("system_logs")
    .select("*, profiles!system_logs_user_id_fkey(full_name, role, company_id)")
    .in("action", [
      "user_create",
      "user_update",
      "user_delete",
      "user_role_change",
      "company_create",
      "company_update",
      "company_delete",
      "facility_approve",
      "facility_reject",
      "subscription_change",
      "quota_override",
      "2fa_enrolled",
      "2fa_unenrolled",
      "2fa_verified",
      "2fa_failed",
      "admin_login",
      "admin_logout",
      "sensitive_data_access",
    ])
    .order("created_at", { ascending: false })

  if (filters?.action) {
    query = query.eq("action", filters.action)
  }

  if (filters?.adminId) {
    query = query.eq("user_id", filters.adminId)
  }

  if (filters?.userId) {
    query = query.contains("metadata", { target_user_id: filters.userId })
  }

  if (filters?.companyId) {
    query = query.contains("metadata", { target_company_id: filters.companyId })
  }

  if (filters?.severity) {
    query = query.contains("metadata", { severity: filters.severity })
  }

  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom)
  }

  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  } else {
    query = query.limit(100)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Failed to fetch admin audit logs:", error)
    return []
  }

  return data || []
}
