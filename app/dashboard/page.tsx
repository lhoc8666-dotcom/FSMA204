import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/dashboard-client"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error("[v0] Auth error:", authError.message)
  }

  if (!user) {
    return <DefaultDashboard />
  }

  // Check user role and redirect if needed
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, companies(name, registration_number, organization_type)")
    .eq("id", user.id)
    .single()

  if (profile?.role === "manager") {
    redirect("/dashboard/manager")
  }
  if (profile?.role === "operator") {
    redirect("/dashboard/operator")
  }
  if (profile?.role === "viewer") {
    redirect("/dashboard/viewer")
  }

  const { data: complianceData } = await supabase.rpc("calculate_realtime_compliance_score", {
    company_id_param: profile?.company_id,
  })

  // Fetch all dashboard data server-side
  const [facilities, products, lots, shipments, registrations, kdeStatsResult, activities] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("traceability_lot_codes").select("*", { count: "exact", head: true }),
    supabase.from("shipments").select("*", { count: "exact", head: true }),

    supabase
      .from("fda_registrations")
      .select(`
        *,
        facilities(name, location_code),
        us_agents:us_agent_id(agent_name, email)
      `)
      .order("renewal_date", { ascending: true })
      .limit(5),

    supabase.rpc("calculate_kde_compliance"),

    supabase
      .from("critical_tracking_events")
      .select(`
        *,
        traceability_lot_codes(tlc, products(product_name)),
        facilities(name),
        data_quality_alerts(status, alert_type)
      `)
      .order("event_date", { ascending: false })
      .limit(10),
  ])

  const dashboardData = {
    facilitiesCount: facilities.count || 0,
    productsCount: products.count || 0,
    lotsCount: lots.count || 0,
    shipmentsCount: shipments.count || 0,
    complianceScore: complianceData?.[0]?.compliance_percentage || 0,
    deductionReasons: complianceData?.[0]?.deduction_reasons || [],
    fdaRegistrations: (registrations.data || []).map((reg: any) => ({
      id: reg.id,
      facility_name: reg.facilities?.name || "Unknown Facility",
      registration_date: reg.registration_date,
      renewal_date: reg.renewal_date,
      expiry_date: reg.expiry_date,
      fda_registration_number: reg.fda_registration_number || reg.fei_number,
      agent_name: reg.us_agents?.agent_name || "Unknown Agent",
      agent_registration_date: reg.agent_registration_date,
      agent_expiry_date: reg.agent_expiry_date,
      agent_registration_years: reg.agent_registration_years,
    })),
    totalLots: kdeStatsResult.data?.[0]?.total || lots.count || 0,
    lotsWithKDE: kdeStatsResult.data?.[0]?.with_kde || 0,
    recentActivities: activities.data || [],
    user: {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.email,
      company_id: profile?.company_id,
      organization_type: profile?.companies?.organization_type,
      companies: profile?.companies,
    },
  }

  return <DashboardClient initialData={dashboardData} />
}

function DefaultDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-foreground">Chào mừng đến với FSMA 204!</h1>
          <p className="text-muted-foreground text-lg mt-2">Vui lòng đăng nhập để xem thông tin dashboard của bạn</p>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 p-16 text-center">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
          <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-3">Bắt đầu theo dõi ngay</h3>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Đăng nhập để truy cập hệ thống theo dõi sản phẩm và quản lý dữ liệu FSMA 204
        </p>
        <a
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-2xl px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold transition-all"
        >
          Đăng nhập ngay
        </a>
      </div>
    </div>
  )
}
