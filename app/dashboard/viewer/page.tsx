import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { Package, Building2, Tag, Truck, FileText } from "lucide-react"
import { getPrioritizedContent } from "@/lib/education-content"
import { DailyGreeting } from "@/components/daily-greeting"

export default async function ViewerDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*, companies(name)").eq("id", user.id).single()

  if (!profile) {
    redirect("/dashboard")
  }

  const [facilities, products, lots, ctes, shipments, recentCtes, recentLots] = await Promise.all([
    supabase.from("facilities").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("traceability_lot_codes").select("*", { count: "exact", head: true }),
    supabase.from("critical_tracking_events").select("*", { count: "exact", head: true }),
    supabase.from("shipments").select("*", { count: "exact", head: true }),
    supabase
      .from("critical_tracking_events")
      .select("*, traceability_lot_codes(tlc, products(product_name)), facilities(name)")
      .order("event_date", { ascending: false })
      .limit(5),
    supabase
      .from("traceability_lot_codes")
      .select("*, products(product_name), facilities(name)")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const facilitiesCount = facilities.count || 0
  const productsCount = products.count || 0
  const lotsCount = lots.count || 0
  const cteCount = ctes.count || 0
  const shipmentsCount = shipments.count || 0

  const kpiData = [
    {
      title: "Cơ sở",
      value: facilitiesCount,
      icon: Building2,
      gradient: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-emerald-100",
      textColor: "text-emerald-700",
    },
    {
      title: "Sản phẩm",
      value: productsCount,
      icon: Package,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      textColor: "text-blue-700",
    },
    {
      title: "Mã TLC",
      value: lotsCount,
      icon: Tag,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      textColor: "text-purple-700",
    },
    {
      title: "Sự kiện CTE",
      value: cteCount,
      icon: FileText,
      gradient: "from-teal-500 to-teal-600",
      bgGradient: "from-teal-50 to-teal-100",
      textColor: "text-teal-700",
    },
    {
      title: "Vận chuyển",
      value: shipmentsCount,
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card
              key={kpi.title}
              className={`rounded-3xl shadow-lg shadow-slate-900/5 border-0 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br ${kpi.bgGradient} dark:from-slate-800 dark:to-slate-900`}
            >
              <CardContent className="p-6 h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${kpi.gradient} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
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
        <h2 className="text-2xl font-bold text-foreground mb-4">Tìm kiếm nhanh</h2>
        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="bg-white rounded-xl">
                <Link href="/dashboard/lots">
                  <Tag className="h-4 w-4 mr-2" />
                  Tra cứu TLC
                </Link>
              </Button>
              <Button asChild variant="outline" className="bg-white rounded-xl">
                <Link href="/dashboard/cte">
                  <FileText className="h-4 w-4 mr-2" />
                  Xem CTEs
                </Link>
              </Button>
              <Button asChild variant="outline" className="bg-white rounded-xl">
                <Link href="/dashboard/shipments">
                  <Truck className="h-4 w-4 mr-2" />
                  Theo dõi vận chuyển
                </Link>
              </Button>
              <Button asChild variant="outline" className="bg-white rounded-xl">
                <Link href="/dashboard/reports">
                  <FileText className="h-4 w-4 mr-2" />
                  Xem báo cáo
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl">Sự kiện gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCtes.data && recentCtes.data.length > 0 ? (
              <div className="space-y-4">
                {recentCtes.data.map((cte: any) => (
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
                <p className="text-sm text-slate-500">Chưa có sự kiện nào</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
          <CardHeader>
            <CardTitle className="text-xl">Lô hàng mới nhất</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLots.data && recentLots.data.length > 0 ? (
              <div className="space-y-4">
                {recentLots.data.map((lot: any) => (
                  <div key={lot.id} className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{lot.tlc}</p>
                        <Badge variant={lot.status === "active" ? "default" : "secondary"} className="rounded-lg">
                          {lot.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{lot.products?.product_name}</p>
                      <p className="text-xs text-slate-500">
                        {lot.facilities?.name} • {new Date(lot.production_date).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="rounded-xl">
                      <Link href={`/dashboard/lots/${lot.id}`}>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">Chưa có lô hàng nào</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-lg shadow-slate-900/5">
        <CardHeader>
          <CardTitle className="text-xl">Công cụ tra cứu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/dashboard/lots"
              className="border rounded-2xl p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-200">
                <Tag className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Tra cứu TLC</h3>
              <p className="text-xs text-slate-500">Tìm kiếm lô hàng theo mã truy xuất</p>
            </Link>

            <Link
              href="/dashboard/cte"
              className="border rounded-2xl p-4 hover:border-teal-200 hover:bg-teal-50 transition-colors group"
            >
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center mb-3 group-hover:bg-teal-200">
                <FileText className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Xem CTEs</h3>
              <p className="text-xs text-slate-500">Danh sách sự kiện theo dõi</p>
            </Link>

            <Link
              href="/dashboard/reports"
              className="border rounded-2xl p-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group"
            >
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-3 group-hover:bg-indigo-200">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-medium text-slate-900 mb-1">Báo cáo</h3>
              <p className="text-xs text-slate-500">Xem báo cáo và phân tích</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
