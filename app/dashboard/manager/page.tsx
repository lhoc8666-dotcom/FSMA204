import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { QuickActions } from "@/components/quick-actions"
import { Package, Building2, Tag, Truck, TrendingUp, TrendingDown } from "lucide-react"
import { FDATimelineChart } from "@/components/fda-timeline-chart"
import { FSMAComplianceChart } from "@/components/fsma-compliance-chart"
import { getPrioritizedContent } from "@/lib/education-content"
import { DailyGreeting } from "@/components/daily-greeting"

export default async function ManagerDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*, companies(name)").eq("id", user.id).single()

  if (!profile || !["manager", "admin", "system_admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const [
    facilities,
    products,
    activeLots,
    ctes,
    ftlProducts,
    recentFacilities,
    recentProducts,
    facilitiesWithCtes,
    productStats,
    fdaRegistrations,
    kdeStatsResult,
    recentActivities,
    shipments,
  ] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("traceability_lot_codes").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("critical_tracking_events").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_ftl", true),
    supabase
      .from("facilities")
      .select("*, _count:critical_tracking_events(count)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("*, _count:traceability_lot_codes(count)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("facilities").select(`
        id,
        name,
        facility_type,
        critical_tracking_events(count)
      `),
    supabase.from("products").select(`
        id,
        product_name,
        is_ftl,
        traceability_lot_codes(count)
      `),
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
        facilities(name)
      `)
      .order("event_date", { ascending: false })
      .limit(10),
    supabase.from("shipments").select("*", { count: "exact", head: true }),
  ])

  const facilitiesCount = facilities.count || 0
  const productsCount = products.count || 0
  const activeLotsCount = activeLots.count || 0
  const cteCount = ctes.count || 0
  const ftlCount = ftlProducts.count || 0
  const shipmentsCount = shipments.count || 0

  const performanceData = facilitiesWithCtes.data?.map((facility: any) => ({
    name: facility.name,
    type: facility.facility_type,
    cteCount: facility.critical_tracking_events?.[0]?.count || 0,
  }))

  const topFacilities = performanceData?.sort((a: any, b: any) => b.cteCount - a.cteCount).slice(0, 5)

  let totalLots = activeLotsCount
  let lotsWithKDE = 0
  if (kdeStatsResult.data && !kdeStatsResult.error) {
    const stats = kdeStatsResult.data[0]
    totalLots = stats?.total || activeLotsCount
    lotsWithKDE = stats?.with_kde || 0
  } else {
    console.log("[v0] KDE stats error or no data:", kdeStatsResult.error)
  }

  const fdaRegistrationsData = (fdaRegistrations.data || []).map((reg: any) => ({
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
  }))

  const kpiData = [
    {
      title: "Cơ sở",
      value: facilitiesCount,
      change: "+5%",
      changeType: "increase" as const,
      icon: Building2,
      gradient: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-emerald-100",
      textColor: "text-emerald-700",
    },
    {
      title: "Sản phẩm",
      value: productsCount,
      change: "+12%",
      changeType: "increase" as const,
      icon: Package,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      textColor: "text-blue-700",
    },
    {
      title: "Mã TLC",
      value: activeLotsCount,
      change: "+8%",
      changeType: "increase" as const,
      icon: Tag,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      textColor: "text-purple-700",
    },
    {
      title: "Vận chuyển",
      value: shipmentsCount,
      change: "-2%",
      changeType: "decrease" as const,
      icon: Truck,
      gradient: "from-amber-500 to-amber-600",
      bgGradient: "from-amber-50 to-amber-100",
      textColor: "text-amber-700",
    },
  ]

  const educationContent = getPrioritizedContent()

  return (
    <div className="space-y-8">
      <DailyGreeting userName={profile?.full_name} autoRotate={true} rotateInterval={30000} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card
              key={kpi.title}
              className={`rounded-3xl shadow-lg shadow-slate-900/5 border-0 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br ${kpi.bgGradient} dark:from-slate-800 dark:to-slate-900`}
            >
              <CardContent className="p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`shrink-0 p-3 rounded-2xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${kpi.changeType === "increase" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800" : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:border-red-800"} font-semibold border shrink-0`}
                  >
                    {kpi.changeType === "increase" ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {kpi.change}
                  </Badge>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${kpi.textColor} dark:text-slate-400 mb-1`}>{kpi.title}</p>
                  <p className="text-4xl font-bold text-slate-900 dark:text-slate-100">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Thao tác nhanh</h2>
        <QuickActions />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <FDATimelineChart registrations={fdaRegistrationsData} />
        <FSMAComplianceChart totalLots={totalLots} lotsWithKDE={lotsWithKDE} />
      </div>

      <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Bảng hoạt động sản xuất</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">10 bản ghi mới nhất từ hệ thống sản xuất</p>
          </div>
          <Button asChild size="sm" variant="outline" className="bg-transparent rounded-xl">
            <Link href="/dashboard/cte">Xem tất cả</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentActivities.data && recentActivities.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Sự kiện (CTE)
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Sản phẩm / TLC
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Cơ sở
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Ngày
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.data.map((activity) => {
                    const eventTypeMap: Record<string, { label: string; color: string }> = {
                      harvest: { label: "Harvesting", color: "bg-emerald-100 text-emerald-700" },
                      cooling: { label: "Cooling", color: "bg-blue-100 text-blue-700" },
                      packing: { label: "Initial Packing", color: "bg-purple-100 text-purple-700" },
                      receiving: { label: "Receiving", color: "bg-amber-100 text-amber-700" },
                      transformation: { label: "Transformation", color: "bg-pink-100 text-pink-700" },
                      shipping: { label: "Shipping", color: "bg-cyan-100 text-cyan-700" },
                    }

                    const eventInfo = eventTypeMap[activity.event_type] || {
                      label: activity.event_type,
                      color: "bg-slate-100 text-slate-700",
                    }

                    return (
                      <tr
                        key={activity.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <Badge variant="secondary" className={`${eventInfo.color} rounded-lg`}>
                            {eventInfo.label}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {activity.traceability_lot_codes?.products?.product_name || "N/A"}
                          </p>
                          <p className="text-xs text-slate-500">{activity.traceability_lot_codes?.tlc}</p>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-700 dark:text-slate-300">
                          {activity.facilities?.name || "N/A"}
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-700 dark:text-slate-300">
                          {new Date(activity.event_date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="py-4 px-4">
                          {activity.key_data_elements && activity.key_data_elements.length > 0 ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 rounded-lg">
                              Đạt
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="rounded-lg">
                              Thiếu KDE
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 mb-1">Bắt đầu theo dõi ngay!</p>
                <p className="text-sm text-slate-500 mb-4">Tạo sự kiện CTE đầu tiên theo chuẩn FSMA 204</p>
              </div>
              <Button asChild className="rounded-xl">
                <Link href="/dashboard/cte/create">Tạo sự kiện đầu tiên</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {profile?.companies && (
        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl">Thông tin công ty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
                <p className="text-sm font-medium text-muted-foreground mb-2">Tên công ty</p>
                <p className="text-lg font-semibold text-foreground">{profile.companies.name}</p>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                <p className="text-sm font-medium text-muted-foreground mb-2">Mã số thuế</p>
                <p className="text-lg font-semibold text-foreground">
                  {profile.companies.registration_number || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
