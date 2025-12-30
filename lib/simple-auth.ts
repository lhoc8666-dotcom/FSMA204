import { createClient } from "@/lib/supabase/server"

interface RegisterUserInput {
  email: string
  password: string
  full_name: string
  company_id: string
  role?: string
}

interface UserSession {
  id: string
  email: string
  full_name: string
  role: string
  company_id: string | null
}

/**
 * Login user with email and password
 */
export async function loginUser(email: string, password: string): Promise<UserSession> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    throw new Error(error?.message || "Login failed")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single()

  if (profileError || !profile) {
    throw new Error("Profile not found")
  }

  return {
    id: data.user.id,
    email: data.user.email!,
    full_name: profile.full_name,
    role: profile.role,
    company_id: profile.company_id,
  }
}

/**
 * Register a new user
 */
export async function registerUser(input: RegisterUserInput): Promise<UserSession> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name,
      },
    },
  })

  if (error || !data.user) {
    throw new Error(error?.message || "Registration failed")
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email: input.email,
    full_name: input.full_name,
    company_id: input.company_id,
    role: input.role || "viewer",
  })

  if (profileError) {
    throw new Error("Failed to create profile")
  }

  return {
    id: data.user.id,
    email: input.email,
    full_name: input.full_name,
    role: input.role || "viewer",
    company_id: input.company_id,
  }
}

/**
 * Get current user session
 */
export async function getSession(): Promise<UserSession | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (!profile) {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    full_name: profile.full_name,
    role: profile.role,
    company_id: profile.company_id,
  }
}

/**
 * Destroy user session (logout)
 */
export async function destroySession(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
