import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function NotificationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)

  const [expiringLots, expiringFda, expiringAgents, pendingShipments, subscription] = await Promise.all([
    supabase
      .from("traceability_lot_codes")
      .select("*, products(product_name), facilities(name)")
      .lte("expiration_date", thirtyDaysFromNow.toISOString())
      .gte("expiration_date", today.toISOString())
      .eq("status", "active")
      .order("expiration_date", { ascending: true })
      .limit(10),
    supabase
      .from("fda_registrations")
      .select("*, facilities(name)")
      .lte("expiry_date", thirtyDaysFromNow.toISOString())
      .gte("expiry_date", today.toISOString())
      .order("expiry_date", { ascending: true })
      .limit(5),
    supabase
      .from("us_agents")
      .select("*")
      .lte("service_end_date", thirtyDaysFromNow.toISOString())
      .gte("service_end_date", today.toISOString())
      .order("service_end_date", { ascending: true })
      .limit(5),
    supabase
      .from("shipments")
      .select("*, traceability_lot_codes(tlc, products(product_name))")
      .eq("status", "pending")
      .order("shipment_date", { ascending: false })
      .limit(10),
    profile?.company_id
      ? supabase
          .from("company_subscriptions")
          .select("*")
          .eq("company_id", profile.company_id)
          .eq("subscription_status", "active")
          .single()
      : null,
  ])

  const notifications = [
    ...(expiringLots.data?.map((lot) => ({
      id: `lot-${lot.id}`,
      type: "expiring_lot" as const,
      title: "Lô hàng sắp hết hạn",
      description: `${lot.products?.product_name} (${lot.tlc}) sẽ hết hạn vào ${new Date(lot.expiration_date!).toLocaleDateString("vi-VN")}`,
      date: lot.expiration_date!,
      priority: "high" as const,
      link: `/dashboard/lots/${lot.id}`,
    })) || []),
    ...(expiringFda.data?.map((fda) => ({
      id: `fda-${fda.id}`,
      type: "expiring_fda" as const,
      title: "Đăng ký FDA sắp hết hạn",
      description: `Đăng ký FDA cho ${fda.facilities?.name} sẽ hết hạn vào ${new Date(fda.expiry_date!).toLocaleDateString("vi-VN")}`,
      date: fda.expiry_date!,
      priority: "high" as const,
      link: `/dashboard/fda-registrations`,
    })) || []),
    ...(expiringAgents.data?.map((agent) => ({
      id: `agent-${agent.id}`,
      type: "expiring_agent" as const,
      title: "Hợp đồng US Agent sắp hết hạn",
      description: `Hợp đồng với ${agent.agent_name} sẽ hết hạn vào ${new Date(agent.service_end_date!).toLocaleDateString("vi-VN")}`,
      date: agent.service_end_date!,
      priority: "medium" as const,
      link: `/dashboard/us-agents`,
    })) || []),
    ...(pendingShipments.data?.map((shipment) => ({
      id: `shipment-${shipment.id}`,
      type: "pending_shipment" as const,
      title: "Vận chuyển chờ xử lý",
      description: `${shipment.traceability_lot_codes?.products?.product_name} (${shipment.traceability_lot_codes?.tlc}) đang chờ vận chuyển`,
      date: shipment.shipment_date,
      priority: "medium" as const,
      link: `/dashboard/shipments/${shipment.id}`,
    })) || []),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const highPriorityCount = notifications.filter((n) => n.priority === "high").length
  const mediumPriorityCount = notifications.filter((n) => n.priority === "medium").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Thông báo & Cảnh báo</h1>
        <p className="text-slate-500 mt-1">Theo dõi các cảnh báo quan trọng cho hoạt động của bạn</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cảnh báo khẩn cấp</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{highPriorityCount}</div>
            <p className="text-xs text-slate-500 mt-1">Cần xử lý ngay</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cảnh báo quan trọng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{mediumPriorityCount}</div>
            <p className="text-xs text-slate-500 mt-1">Cần chú ý</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tổng thông báo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{notifications.length}</div>
            <p className="text-xs text-slate-500 mt-1">Trong 30 ngày tới</p>
          </CardContent>
        </Card>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Tất cả đã được cập nhật</h3>
            <p className="text-slate-500">Không có cảnh báo nào cần xử lý</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Danh sách thông báo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  <div
                    className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                      notification.priority === "high"
                        ? "bg-red-100"
                        : notification.priority === "medium"
                          ? "bg-amber-100"
                          : "bg-blue-100"
                    }`}
                  >
                    {notification.type === "expiring_lot" ? (
                      <svg
                        className={`h-5 w-5 ${notification.priority === "high" ? "text-red-600" : "text-amber-600"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    ) : notification.type === "expiring_fda" || notification.type === "expiring_agent" ? (
                      <svg
                        className={`h-5 w-5 ${notification.priority === "high" ? "text-red-600" : "text-amber-600"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{notification.title}</p>
                        <Badge
                          variant={
                            notification.priority === "high"
                              ? "destructive"
                              : notification.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {notification.priority === "high"
                            ? "Khẩn cấp"
                            : notification.priority === "medium"
                              ? "Quan trọng"
                              : "Thông thường"}
                        </Badge>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        {new Date(notification.date).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{notification.description}</p>
                    <Button asChild size="sm" variant="outline" className="bg-transparent">
                      <Link href={notification.link}>Xem chi tiết</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cài đặt thông báo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Email thông báo</p>
                <p className="text-xs text-slate-500">Nhận email khi có cảnh báo quan trọng</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Lô hàng sắp hết hạn</p>
                <p className="text-xs text-slate-500">Cảnh báo trước 30 ngày</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Đăng ký FDA</p>
                <p className="text-xs text-slate-500">Cảnh báo trước 60 ngày</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Vận chuyển chậm</p>
                <p className="text-xs text-slate-500">Cảnh báo khi quá thời gian dự kiến</p>
              </div>
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hướng dẫn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 font-semibold text-xs">!</span>
              </div>
              <div>
                <p className="text-sm font-medium">Cảnh báo khẩn cấp</p>
                <p className="text-xs text-slate-500">Cần xử lý trong vòng 7 ngày</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-amber-600 font-semibold text-xs">i</span>
              </div>
              <div>
                <p className="text-sm font-medium">Cảnh báo quan trọng</p>
                <p className="text-xs text-slate-500">Cần xử lý trong vòng 30 ngày</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-xs">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium">Thông tin</p>
                <p className="text-xs text-slate-500">Thông báo chung, không khẩn</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
