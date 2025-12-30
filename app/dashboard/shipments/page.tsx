import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ShipmentsSearchFilter } from "@/components/shipments-search-filter"

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; shipment_date_from?: string; shipment_date_to?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const { search, status, shipment_date_from, shipment_date_to } = params

  let query = supabase
    .from("shipments")
    .select("*, traceability_lot_codes(tlc, products(product_name)), facilities!shipments_from_facility_id_fkey(name)")

  if (search) {
    query = query.or(`shipment_number.ilike.%${search}%,destination_address.ilike.%${search}%`)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (shipment_date_from) {
    query = query.gte("shipment_date", shipment_date_from)
  }

  if (shipment_date_to) {
    query = query.lte("shipment_date", shipment_date_to)
  }

  const { data: shipments } = await query.order("shipment_date", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Quản lý vận chuyển</h1>
          <p className="text-slate-500 mt-1">Theo dõi các lô hàng đang vận chuyển</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/shipments/create">Tạo vận chuyển</Link>
        </Button>
      </div>

      <ShipmentsSearchFilter />

      {!shipments || shipments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <svg className="h-16 w-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
              />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {search || status || shipment_date_from || shipment_date_to
                ? "Không tìm thấy kết quả"
                : "Chưa có vận chuyển nào"}
            </h3>
            <p className="text-slate-500 mb-6">
              {search || status || shipment_date_from || shipment_date_to
                ? "Thử thay đổi bộ lọc của bạn"
                : "Tạo lô hàng vận chuyển đầu tiên"}
            </p>
            <Button asChild>
              <Link href="/dashboard/shipments/create">Tạo vận chuyển mới</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {shipments.map((shipment) => (
            <Card key={shipment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-slate-900">{shipment.shipment_number}</h3>
                      <Badge
                        variant={
                          shipment.status === "delivered"
                            ? "default"
                            : shipment.status === "in_transit"
                              ? "secondary"
                              : shipment.status === "cancelled"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {shipment.status === "delivered"
                          ? "Đã giao"
                          : shipment.status === "in_transit"
                            ? "Đang vận chuyển"
                            : shipment.status === "cancelled"
                              ? "Đã hủy"
                              : "Chờ xử lý"}
                      </Badge>
                      {shipment.temperature_controlled && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Kiểm soát nhiệt độ
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-slate-500">Mã TLC</p>
                        <p className="font-mono font-medium">{shipment.traceability_lot_codes?.tlc}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Sản phẩm</p>
                        <p className="font-medium truncate">
                          {shipment.traceability_lot_codes?.products?.product_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Từ cơ sở</p>
                        <p className="font-medium truncate">{shipment.facilities?.name}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Ngày gửi</p>
                        <p className="font-medium">{new Date(shipment.shipment_date).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-slate-500">Điểm đến</p>
                      <p className="text-slate-700">{shipment.destination_address}</p>
                    </div>
                  </div>

                  <Button asChild size="sm" variant="outline" className="shrink-0 bg-transparent">
                    <Link href={`/dashboard/shipments/${shipment.id}`}>Chi tiết</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
