import { createClient } from "@/lib/supabase/server"

interface SubscriptionQuotas {
  maxUsers: number
  maxFacilities: number
  maxProducts: number
  maxStorageGb: number
  currentUsers: number
  currentFacilities: number
  currentProducts: number
  currentStorageGb: number
  subscriptionStatus: string
  packageName: string
  features: {
    fda: boolean
    agent: boolean
    cte: boolean
    reporting: boolean
    api: boolean
    branding: boolean
  }
}

interface QuotaCheck {
  allowed: boolean
  currentUsage: number
  maxAllowed: number
  remaining: number
  subscriptionStatus: string
}

/**
 * Get company's active subscription with quotas
 * Added graceful fallback: if no subscription found, default to FREE plan instead of returning null
 */
export async function getCompanySubscription(companyId: string): Promise<SubscriptionQuotas | null> {
  const supabase = await createClient()

  const { data: subscription, error } = await supabase
    .from("company_subscriptions")
    .select(
      `
      *,
      service_packages!inner (
        name,
        package_code,
        features,
        limits
      )
    `,
    )
    .eq("company_id", companyId)
    .in("status", ["active", "trial"])
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[v0] Error fetching subscription:", error)
    return null
  }

  if (!subscription || !subscription.service_packages) {
    console.log("[v0] No subscription found for company:", companyId, "- attempting to auto-create FREE subscription")

    const { data: freePackage } = await supabase
      .from("service_packages")
      .select("id, name, limits, features")
      .eq("package_code", "FREE")
      .eq("is_active", true)
      .single()

    if (freePackage) {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear() + 100)

      await supabase.from("company_subscriptions").insert({
        company_id: companyId,
        package_id: freePackage.id,
        status: "active",
        billing_cycle: "monthly",
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        price_paid: 0,
        auto_renew: false,
      })

      console.log("[v0] Auto-created FREE subscription for company:", companyId)

      const limits = freePackage.limits || {}
      const features = freePackage.features || {}

      return {
        maxUsers: limits.max_users || 5,
        maxFacilities: limits.max_facilities || 1,
        maxProducts: limits.max_products || 10,
        maxStorageGb: limits.max_storage_gb || 1,
        currentUsers: 0,
        currentFacilities: 0,
        currentProducts: 0,
        currentStorageGb: 0,
        subscriptionStatus: "active",
        packageName: freePackage.name,
        features: {
          fda: features.fda_registration === true,
          agent: features.us_agent === true,
          cte: features.cte_tracking === true,
          reporting: features.advanced_reporting === true,
          api: features.api_access === true,
          branding: features.custom_branding === true,
        },
      }
    }

    console.error("[v0] CRITICAL: No FREE package found in database for company:", companyId)
    return null
  }

  const pkg = subscription.service_packages as any
  const limits = pkg.limits || {}
  const features = pkg.features || {}

  return {
    maxUsers: limits.max_users || 1,
    maxFacilities: limits.max_facilities || 1,
    maxProducts: limits.max_products || 3,
    maxStorageGb: limits.max_storage_gb || 0,
    currentUsers: subscription.current_users_count || 0,
    currentFacilities: subscription.current_facilities_count || 0,
    currentProducts: subscription.current_products_count || 0,
    currentStorageGb: subscription.current_storage_gb || 0,
    subscriptionStatus: subscription.status,
    packageName: pkg.name,
    features: {
      fda: features.fda_registration === true,
      agent: features.us_agent === true,
      cte: features.cte_tracking === true,
      reporting: features.advanced_reporting === true,
      api: features.api_access === true,
      branding: features.custom_branding === true,
    },
  }
}

/**
 * Check if company can add more users
 */
export async function checkUserQuota(companyId: string): Promise<QuotaCheck> {
  const subscription = await getCompanySubscription(companyId)

  if (!subscription) {
    return {
      allowed: false,
      currentUsage: 0,
      maxAllowed: 0,
      remaining: 0,
      subscriptionStatus: "none",
    }
  }

  const unlimited = subscription.maxUsers === -1
  const allowed =
    (subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trial") &&
    (unlimited || subscription.currentUsers < subscription.maxUsers)

  return {
    allowed,
    currentUsage: subscription.currentUsers,
    maxAllowed: subscription.maxUsers,
    remaining: unlimited ? -1 : subscription.maxUsers - subscription.currentUsers,
    subscriptionStatus: subscription.subscriptionStatus,
  }
}

/**
 * Check if company can add more facilities
 */
export async function checkFacilityQuota(companyId: string): Promise<QuotaCheck> {
  const subscription = await getCompanySubscription(companyId)

  if (!subscription) {
    return {
      allowed: false,
      currentUsage: 0,
      maxAllowed: 0,
      remaining: 0,
      subscriptionStatus: "none",
    }
  }

  const unlimited = subscription.maxFacilities === -1
  const allowed =
    (subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trial") &&
    (unlimited || subscription.currentFacilities < subscription.maxFacilities)

  return {
    allowed,
    currentUsage: subscription.currentFacilities,
    maxAllowed: subscription.maxFacilities,
    remaining: unlimited ? -1 : subscription.maxFacilities - subscription.currentFacilities,
    subscriptionStatus: subscription.subscriptionStatus,
  }
}

/**
 * Check if company can add more products
 */
export async function checkProductQuota(companyId: string): Promise<QuotaCheck> {
  const subscription = await getCompanySubscription(companyId)

  if (!subscription) {
    return {
      allowed: false,
      currentUsage: 0,
      maxAllowed: 0,
      remaining: 0,
      subscriptionStatus: "none",
    }
  }

  const unlimited = subscription.maxProducts === -1
  const allowed =
    (subscription.subscriptionStatus === "active" || subscription.subscriptionStatus === "trial") &&
    (unlimited || subscription.currentProducts < subscription.maxProducts)

  return {
    allowed,
    currentUsage: subscription.currentProducts,
    maxAllowed: subscription.maxProducts,
    remaining: unlimited ? -1 : subscription.maxProducts - subscription.currentProducts,
    subscriptionStatus: subscription.subscriptionStatus,
  }
}

/**
 * Recalculate and sync usage counts from actual database records
 */
export async function recalculateUsage(companyId: string): Promise<void> {
  const supabase = await createClient()

  const [usersResult, facilitiesResult, productsResult] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("facilities").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ])

  const actualUsers = usersResult.count || 0
  const actualFacilities = facilitiesResult.count || 0
  const actualProducts = productsResult.count || 0

  const { error } = await supabase
    .from("company_subscriptions")
    .update({
      current_users_count: actualUsers,
      current_facilities_count: actualFacilities,
      current_products_count: actualProducts,
    })
    .eq("company_id", companyId)
    .in("status", ["active", "trial"])

  if (error) {
    console.error("[v0] Error recalculating usage:", error)
    throw error
  }

  console.log("[v0] Recalculated usage for company:", companyId, {
    users: actualUsers,
    facilities: actualFacilities,
    products: actualProducts,
  })
}
