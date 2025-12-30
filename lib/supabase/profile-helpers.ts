import { createClient } from "./server"
import type { User } from "@supabase/supabase-js"

/**
 * Ensures a profile exists for the given user
 * Creates one if it doesn't exist
 */
export async function ensureProfileExists(user: User) {
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()

  // If profile exists, return it
  if (profile && !profileError) {
    return { profile, error: null, created: false, invalidSession: false }
  }

  const isNotFoundError =
    !profileError ||
    profileError.code === "PGRST116" ||
    profileError.message?.includes("no rows") ||
    profileError.details?.includes("0 rows") ||
    profileError.message?.includes("not found")

  if (profileError && !isNotFoundError) {
    // For other non-"not found" errors, return the error
    console.error("[v0] Profile fetch error:", {
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
    })
    return { profile: null, error: profileError, created: false, invalidSession: false }
  }

  // Profile not found, attempt to create
  console.log("[v0] Profile not found, attempting to create for user:", user.email)

  const newProfile = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email || "User",
    role: user.user_metadata?.role || "viewer",
    language_preference: user.user_metadata?.language_preference || "vi",
  }

  const { data: createdProfile, error: createError } = await supabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .maybeSingle()

  if (createError) {
    console.error("[v0] Failed to create profile:", {
      message: createError.message,
      code: createError.code,
      details: createError.details,
      hint: createError.hint,
    })

    return { profile: null, error: createError, created: false, invalidSession: false }
  }

  console.log("[v0] Successfully created profile for user:", user.email)
  return { profile: createdProfile, error: null, created: true, invalidSession: false }
}
