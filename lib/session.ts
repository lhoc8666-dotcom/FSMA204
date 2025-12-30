import { createClient } from "@/lib/supabase/server"

interface AuthSession {
  user: {
    id: string
    email: string
    role: string
    companyId: string | null
  }
}

/**
 * Require authentication - throw error if not authenticated
 * Use this in API routes to protect endpoints
 */
export async function requireAuth(): Promise<AuthSession> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single()

  if (!profile) {
    throw new Error("Profile not found")
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
      role: profile.role,
      companyId: profile.company_id,
    },
  }
}
