import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { QuickActions } from "@/components/quick-actions"
import { Package, Building2, Tag, Truck, TrendingUp, TrendingDown } from "lucide-react"
import { getPrioritizedContent } from "@/lib/education-content"
import { DailyGreeting } from "@/components/daily-greeting"

export default async function OperatorDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*, companies(name)").eq("id", user.id).single()

  if (!profile || !["operator", "manager", "admin", "system_admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [todayCtes, todayShipments, activeLots, recentCtes, pendingShipments, myRecentActivities, allShipments] =
    await Promise.all([
      supabase
        .from("critical_tracking_events")
        .select("*", { count: "exact", head: true })
        .gte("event_date", today.toISOString()),
      supabase.from("shipments").select("*", { count: "exact", head: true }).gte("shipment_date", today.toISOString()),
      supabase.from("traceability_lot_codes").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("critical_tracking_events")
        .select("*, traceability_lot_codes(tlc, products(product_name)), facilities(name)")
        .order("event_date", { ascending: false })
        .limit(10),
      supabase
        .from("shipments")
        .select("*, traceability_lot_codes(tlc, products(product_name))")
        .eq("status", "pending")
        .order("shipment_date", { ascending: false })
        .limit(5),
      supabase.from("critical_tracking_events").select("*", { count: "exact", head: true }).eq("created_at", user.id),
      supabase.from("shipments").select("*", { count: "exact", head: true }),
    ])

  const todayCteCount = todayCtes.count || 0
  const todayShipmentsCount = todayShipments.count || 0
  const activeLotsCount = activeLots.count || 0
  const myActivitiesCount = myRecentActivities.count || 0
  const shipmentsCount = allShipments.count || 0

  const kpiData = [
    {
      title: "CTE hôm nay",
      value: todayCteCount,
      change: "+15%",
      changeType: "increase" as const,
      icon: Package,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      textColor: "text-blue-700",
    },
    {
      title: "Vận chuyển",
      value: todayShipmentsCount,
      change: "+8%",
      changeType: "increase" as const,
      icon: Truck,
      gradient: "from-cyan-500 to-cyan-600",
      bgGradient: "from-cyan-50 to-cyan-100",
      textColor: "text-cyan-700",
    },
    {
      title: "Lô đang xử lý",
      value: activeLotsCount,
      change: "+5%",
      changeType: "increase" as const,
      icon: Tag,
      gradient: "from-teal-500 to-teal-600",
      bgGradient: "from-teal-50 to-teal-100",
      textColor: "text-teal-700",
    },
    {
      title: "Hoạt động của tôi",
      value: myActivitiesCount,
      change: "+22%",
      changeType: "increase" as const,
      icon: Building2,
      gradient: "from-indigo-500 to-indigo-600",
      bgGradient: "from-indigo-50 to-indigo-100",
      textColor: "text-indigo-700",
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
        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl">Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCtes.data && recentCtes.data.length > 0 ? (
              <div className="space-y-4">
                {recentCtes.data.slice(0, 5).map((cte: any) => (
                  <div key={cte.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize rounded-lg">
                          {cte.event_type === "harvest"
                            ? "Thu hoạch"
                            : cte.event_type === "cooling"
                              ? "Làm lạnh"
                              : cte.event_type === "packing"
                                ? "Đóng gói"
                                : cte.event_type === "receiving"
                                  ? "Tiếp nhận"
                                  : cte.event_type === "transformation"
                                    ? "Chế biến"
                                    : "Vận chuyển"}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(cte.event_date).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {cte.traceability_lot_codes?.products?.product_name} - {cte.traceability_lot_codes?.tlc}
                      </p>
                      <p className="text-xs text-slate-500">{cte.facilities?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 mb-3">Chưa có hoạt động nào</p>
                <Button asChild size="sm" className="rounded-xl">
                  <Link href="/dashboard/cte/create">Tạo CTE đầu tiên</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl">Vận chuyển chờ xử lý</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingShipments.data && pendingShipments.data.length > 0 ? (
              <div className="space-y-4">
                {pendingShipments.data.map((shipment: any) => (
                  <div
                    key={shipment.id}
                    className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{shipment.shipment_number}</p>
                        <Badge variant="outline" className="rounded-lg">
                          Chờ xử lý
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">
                        {shipment.traceability_lot_codes?.products?.product_name} -{" "}
                        {shipment.traceability_lot_codes?.tlc}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(shipment.shipment_date).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-xl bg-transparent">
                      <Link href={`/dashboard/shipments/${shipment.id}`}>Xem</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">Không có vận chuyển chờ xử lý</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
        <CardHeader>
          <CardTitle className="text-xl">Hướng dẫn nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border rounded-2xl p-4 hover:border-blue-200 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Tạo CTE</h3>
              <p className="text-xs text-slate-500 mb-3">Ghi nhận sự kiện theo dõi quan trọng cho lô hàng</p>
              <Button asChild size="sm" variant="outline" className="w-full bg-transparent rounded-xl">
                <Link href="/dashboard/cte/create">Bắt đầu</Link>
              </Button>
            </div>

            <div className="border rounded-2xl p-4 hover:border-teal-200 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center mb-3">
                <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Tạo lô hàng</h3>
              <p className="text-xs text-slate-500 mb-3">Tạo mã TLC mới cho sản phẩm</p>
              <Button asChild size="sm" variant="outline" className="w-full bg-transparent rounded-xl">
                <Link href="/dashboard/lots/create">Bắt đầu</Link>
              </Button>
            </div>

            <div className="border rounded-2xl p-4 hover:border-cyan-200 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-3">
                <svg className="h-5 w-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Tạo vận chuyển</h3>
              <p className="text-xs text-slate-500 mb-3">Ghi nhận thông tin vận chuyển lô hàng</p>
              <Button asChild size="sm" variant="outline" className="w-full bg-transparent rounded-xl">
                <Link href="/dashboard/shipments/create">Bắt đầu</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
