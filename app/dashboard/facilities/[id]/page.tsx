import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { FacilityEditRequest } from "@/components/facility-edit-request"
import { Plus } from "lucide-react"

export default async function FacilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/sign-in")

  const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single()

  const { data: facility, error } = await supabase
    .from("facilities")
    .select(`
      *,
      companies!inner(name)
    `)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[v0] Database error fetching facility:", error)
    notFound()
  }

  if (!facility) {
    notFound()
  }

  if (profile?.role !== "system_admin" && facility.company_id !== profile?.company_id) {
    redirect("/dashboard/facilities")
  }

  const isSystemAdmin = profile?.role === "system_admin"

  const { data: activeLots } = await supabase
    .from("traceability_lot_codes")
    .select("id, tlc, products(product_name)")
    .eq("facility_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentCTEs } = await supabase
    .from("critical_tracking_events")
    .select("*, traceability_lot_codes(tlc)")
    .eq("facility_id", id)
    .order("event_date", { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{facility.name}</h1>
          <p className="text-slate-500 mt-1">Chi tiết cơ sở sản xuất</p>
        </div>
        <Badge
          variant={
            facility.certification_status === "certified"
              ? "default"
              : facility.certification_status === "pending"
                ? "secondary"
                : "outline"
          }
          className="text-sm px-3 py-1"
        >
          {facility.certification_status === "certified"
            ? "Đã chứng nhận"
            : facility.certification_status === "pending"
              ? "Đang xử lý"
              : "Hết hạn"}
        </Badge>
      </div>

      {!isSystemAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          <p className="font-semibold">Thông tin khóa</p>
          <p className="text-sm">
            Các thông tin FDA và US Agent được khóa bởi System Admin. Bạn chỉ có thể yêu cầu cập nhật thông tin cơ bản
            của cơ sở.
          </p>
        </div>
      )}

      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader>
          <CardTitle className="text-emerald-900 flex items-center justify-between">
            Sự kiện CTE (Critical Tracking Events)
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Link href={`/dashboard/cte/create?facility=${id}`}>
                <Plus className="h-4 w-4 mr-2" />
                Tạo CTE mới
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Ghi nhận các sự kiện theo dõi quan trọng (CTE) tại cơ sở này theo quy định FSMA 204. Mỗi sự kiện phải liên
            kết với một mã TLC cụ thể.
          </p>

          {activeLots && activeLots.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Mã TLC đang hoạt động ({activeLots.length}):</p>
              <div className="flex flex-wrap gap-2">
                {activeLots.map((lot) => (
                  <Badge key={lot.id} variant="outline" className="bg-white">
                    {lot.tlc} - {lot.products?.product_name}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
              Chưa có mã TLC nào đang hoạt động. Vui lòng{" "}
              <Link href="/dashboard/traceability" className="underline font-medium">
                tạo mã TLC
              </Link>{" "}
              trước khi tạo CTE.
            </div>
          )}

          {recentCTEs && recentCTEs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">Sự kiện CTE gần đây:</p>
              <div className="space-y-2">
                {recentCTEs.map((cte) => (
                  <div key={cte.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                    <div>
                      <span className="font-medium capitalize">{cte.event_type}</span>
                      <span className="text-slate-500 ml-2">- {cte.traceability_lot_codes?.tlc}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(cte.event_date).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="w-full bg-white">
                <Link href={`/dashboard/cte?facility=${id}`}>Xem tất cả sự kiện CTE</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Mã cơ sở</p>
              <p className="text-base font-medium mt-1">{facility.location_code}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Loại cơ sở</p>
              <p className="text-base font-medium mt-1 capitalize">{facility.facility_type}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Công ty</p>
              <p className="text-base font-medium mt-1">{facility.companies?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Địa chỉ</p>
              <p className="text-base mt-1">{facility.address}</p>
            </div>
            {facility.gps_coordinates && (
              <div>
                <p className="text-sm text-slate-500">Tọa độ GPS</p>
                <p className="text-base font-mono mt-1">{facility.gps_coordinates}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-500">Ngày tạo</p>
              <p className="text-base font-medium mt-1">{new Date(facility.created_at).toLocaleDateString("vi-VN")}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Đăng ký FDA
              {!isSystemAdmin && (
                <Badge variant="secondary" className="text-xs">
                  🔒 Khóa
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {facility.fda_facility_number ? (
              <>
                <div>
                  <p className="text-sm text-slate-500">Số cơ sở FDA</p>
                  <p className="text-base font-medium mt-1">{facility.fda_facility_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Số DUNS</p>
                  <p className="text-base font-medium mt-1">{facility.duns_number || "Chưa có"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Ngày đăng ký FDA</p>
                  <p className="text-base font-medium mt-1">
                    {facility.fda_registration_date
                      ? new Date(facility.fda_registration_date).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Ngày hết hạn FDA</p>
                  <p className="text-base font-medium mt-1">
                    {facility.fda_expiry_date
                      ? new Date(facility.fda_expiry_date).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Trạng thái</p>
                  <Badge variant={facility.fda_registration_status === "active" ? "default" : "secondary"}>
                    {facility.fda_registration_status === "active"
                      ? "Hoạt động"
                      : facility.fda_registration_status === "expired"
                        ? "Hết hạn"
                        : "Đang chờ"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Chưa đăng ký FDA</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              US Agent
              {!isSystemAdmin && (
                <Badge variant="secondary" className="text-xs">
                  🔒 Khóa
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {facility.agent_registration_date || facility.agent_registration_years || facility.agent_expiry_date ? (
              <>
                <div>
                  <p className="text-sm text-slate-500">Ngày đăng ký Agent</p>
                  <p className="text-base font-medium mt-1">
                    {facility.agent_registration_date
                      ? new Date(facility.agent_registration_date).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Số năm đăng ký</p>
                  <p className="text-base font-medium mt-1">{facility.agent_registration_years || "Chưa có"} năm</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Ngày hết hạn Agent</p>
                  <p className="text-base font-medium mt-1">
                    {facility.agent_expiry_date
                      ? new Date(facility.agent_expiry_date).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Trạng thái</p>
                  <Badge
                    variant={
                      facility.agent_expiry_date && new Date(facility.agent_expiry_date) > new Date()
                        ? "default"
                        : "secondary"
                    }
                  >
                    {facility.agent_expiry_date && new Date(facility.agent_expiry_date) > new Date()
                      ? "Hoạt động"
                      : "Hết hạn"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Chưa có thông tin US Agent</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin liên hệ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Email đăng ký</p>
              <p className="text-base font-medium mt-1">{facility.registration_email || "Chưa có"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-base font-medium mt-1">{facility.email || "Chưa có"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Số điện thoại</p>
              <p className="text-base font-medium mt-1">{facility.phone || "Chưa có"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/facilities">Quay lại danh sách</Link>
        </Button>

        {isSystemAdmin ? (
          <Button asChild>
            <Link href="/admin/fda-registrations">Quản lý FDA (System Admin)</Link>
          </Button>
        ) : (
          <FacilityEditRequest facility={facility} />
        )}
      </div>
    </div>
  )
}
