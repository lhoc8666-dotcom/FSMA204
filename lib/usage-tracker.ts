import { createClient } from "@/lib/supabase/server"

/**
 * Increment user count for a company
 */
export async function incrementUserCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("increment_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_users_count",
  })
}

/**
 * Decrement user count for a company
 */
export async function decrementUserCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("decrement_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_users_count",
  })
}

/**
 * Increment facility count for a company
 */
export async function incrementFacilityCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("increment_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_facilities_count",
  })
}

/**
 * Decrement facility count for a company
 */
export async function decrementFacilityCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("decrement_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_facilities_count",
  })
}

/**
 * Increment product count for a company
 */
export async function incrementProductCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("increment_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_products_count",
  })
}

/**
 * Decrement product count for a company
 */
export async function decrementProductCount(companyId: string): Promise<void> {
  const supabase = await createClient()

  await supabase.rpc("decrement_subscription_usage", {
    p_company_id: companyId,
    p_field: "current_products_count",
  })
}

/**
 * Update storage usage for a company
 */
export async function updateStorageUsage(companyId: string, storageGb: number): Promise<void> {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("id")
    .eq("company_id", companyId)
    .eq("subscription_status", "active")
    .single()

  if (subscription) {
    await supabase.from("company_subscriptions").update({ current_storage_gb: storageGb }).eq("id", subscription.id)
  }
}

/**
 * Recalculate all usage counts for a company
 */
export async function recalculateUsage(companyId: string): Promise<void> {
  const supabase = await createClient()

  // Count users
  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  // Count facilities
  const { count: facilityCount } = await supabase
    .from("facilities")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  // Count products
  const { count: productCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  // Update subscription
  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("id")
    .eq("company_id", companyId)
    .eq("subscription_status", "active")
    .single()

  if (subscription) {
    await supabase
      .from("company_subscriptions")
      .update({
        current_users_count: userCount || 0,
        current_facilities_count: facilityCount || 0,
        current_products_count: productCount || 0,
      })
      .eq("id", subscription.id)
  }
}
