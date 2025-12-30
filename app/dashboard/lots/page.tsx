import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { LotsSearchFilter } from "@/components/lots-search-filter"

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; product?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams
  const { search, status, product } = params

  let query = supabase
    .from("traceability_lot_codes")
    .select("*, products(product_name, product_code), facilities(name)")

  if (search) {
    query = query.or(`tlc.ilike.%${search}%,batch_number.ilike.%${search}%`)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (product) {
    query = query.eq("product_id", product)
  }

  const { data: lots } = await query.order("created_at", { ascending: false })

  // Get unique products for filter
  const { data: products } = await supabase.from("products").select("id, product_name").order("product_name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Quản lý mã TLC</h1>
          <p className="text-slate-500 mt-1">Traceability Lot Codes - Theo dõi từng lô hàng</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/lots/create">Tạo mã TLC</Link>
        </Button>
      </div>

      <LotsSearchFilter products={products || []} />

      {!lots || lots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <svg className="h-16 w-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {search || status || product ? "Không tìm thấy kết quả" : "Chưa có mã TLC nào"}
            </h3>
            <p className="text-slate-500 mb-6">
              {search || status || product
                ? "Thử thay đổi bộ lọc của bạn"
                : "Tạo mã truy xuất đầu tiên cho lô hàng của bạn"}
            </p>
            <Button asChild>
              <Link href="/dashboard/lots/create">Tạo mã TLC mới</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Danh sách mã TLC</CardTitle>
              <Badge variant="secondary">{lots.length} kết quả</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {lots.map((lot) => (
                <div key={lot.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-mono font-semibold text-slate-900">{lot.tlc}</p>
                        <Badge
                          variant={
                            lot.status === "active"
                              ? "default"
                              : lot.status === "recalled"
                                ? "destructive"
                                : lot.status === "expired"
                                  ? "outline"
                                  : "secondary"
                          }
                        >
                          {lot.status === "active"
                            ? "Hoạt động"
                            : lot.status === "recalled"
                              ? "Thu hồi"
                              : lot.status === "expired"
                                ? "Hết hạn"
                                : "Đã dùng hết"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Sản phẩm</p>
                          <p className="font-medium truncate">{lot.products?.product_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Cơ sở</p>
                          <p className="font-medium truncate">{lot.facilities?.name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Ngày sản xuất</p>
                          <p className="font-medium">{new Date(lot.production_date).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Tồn kho khả dụng</p>
                          <p className="font-medium">
                            {lot.available_quantity !== null && lot.available_quantity !== undefined
                              ? lot.available_quantity
                              : lot.quantity}{" "}
                            {lot.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="shrink-0 bg-transparent">
                      <Link href={`/dashboard/lots/${lot.id}`}>Chi tiết</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
