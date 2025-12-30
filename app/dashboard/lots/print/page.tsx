"use client"

import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Printer, Download, QrCode, Barcode, Search, Lock } from "lucide-react"
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WatermarkOverlay, getWatermarkConfig } from "@/lib/watermark"

interface Lot {
  id: string
  tlc: string
  batch_number: string
  production_date: string
  expiry_date: string
  quantity: number
  unit: string
  products: { product_name: string; product_code: string } | null
  facilities: { name: string } | null
}

function PrintLotsContent() {
  const [lots, setLots] = useState<Lot[]>([])
  const [selectedLots, setSelectedLots] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr")
  const [loading, setLoading] = useState(true)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [packageName, setPackageName] = useState<string>("Loading...")

  useEffect(() => {
    fetchLots()
    fetchSubscription()
  }, [searchQuery])

  const fetchLots = async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("traceability_lot_codes")
      .select("*, products(product_name, product_code), facilities(name)")
      .eq("status", "active")

    if (searchQuery) {
      query = query.or(`tlc.ilike.%${searchQuery}%,batch_number.ilike.%${searchQuery}%`)
    }

    const { data } = await query.order("created_at", { ascending: false }).limit(50)
    setLots((data as Lot[]) || [])
    setLoading(false)
  }

  const fetchSubscription = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()

    if (!profile?.company_id) return

    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select("service_packages(name)")
      .eq("company_id", profile.company_id)
      .in("status", ["active", "trial"])
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscription?.service_packages) {
      setPackageName((subscription.service_packages as any).name)
    }
  }

  const generateCode = async (tlc: string, type: "qr" | "barcode") => {
    try {
      if (type === "qr") {
        return await QRCode.toDataURL(tlc, { width: 200, margin: 1 })
      } else {
        const canvas = document.createElement("canvas")
        JsBarcode(canvas, tlc, {
          format: "CODE128",
          displayValue: true,
          height: 50,
          width: 2,
          margin: 5,
        })
        return canvas.toDataURL()
      }
    } catch (error) {
      console.error("[v0] Error generating code:", error)
      return ""
    }
  }

  const handleSelectAll = () => {
    if (selectedLots.length === lots.length) {
      setSelectedLots([])
    } else {
      setSelectedLots(lots.map((lot) => lot.id))
    }
  }

  const handleToggleLot = (lotId: string) => {
    setSelectedLots((prev) => (prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId]))
  }

  const handlePreview = async () => {
    const selectedLotsData = lots.filter((lot) => selectedLots.includes(lot.id))
    const newPreviews: Record<string, string> = {}

    for (const lot of selectedLotsData) {
      const code = await generateCode(lot.tlc, codeType)
      newPreviews[lot.id] = code
    }

    setPreviews(newPreviews)
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const selectedLotsData = lots.filter((lot) => selectedLots.includes(lot.id))
    const shouldWatermark = packageName.toLowerCase().includes("free")
    const watermarkConfig = getWatermarkConfig()

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>In nhãn mã TLC</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              body { margin: 0; }
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              position: relative;
            }
            ${
              shouldWatermark
                ? `
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(${watermarkConfig.rotation}deg);
              font-size: ${watermarkConfig.fontSize}px;
              color: ${watermarkConfig.color};
              opacity: ${watermarkConfig.opacity};
              font-weight: 600;
              pointer-events: none;
              user-select: none;
              white-space: nowrap;
              z-index: 9999;
            }
            `
                : ""
            }
            .label {
              page-break-inside: avoid;
              border: 2px solid #000;
              padding: 15px;
              margin-bottom: 20px;
              width: 400px;
              overflow: hidden;
            }
            .label h2 {
              margin: 0 0 10px 0;
              font-size: 18px;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }
            .label img {
              display: block;
              margin: 15px auto;
              max-width: 100%;
              height: auto;
            }
            .label-info {
              font-size: 12px;
              line-height: 1.6;
            }
            .label-info strong {
              display: inline-block;
              width: 120px;
            }
          </style>
        </head>
        <body>
          ${shouldWatermark ? `<div class="watermark">${watermarkConfig.text}</div>` : ""}
          ${selectedLotsData
            .map(
              (lot) => `
            <div class="label">
              <h2>${lot.products?.product_name || "N/A"}</h2>
              <img src="${previews[lot.id] || ""}" alt="Code" />
              <div class="label-info">
                <div><strong>Mã TLC:</strong> ${lot.tlc}</div>
                <div><strong>Mã lô:</strong> ${lot.batch_number || "N/A"}</div>
                <div><strong>Cơ sở:</strong> ${lot.facilities?.name || "N/A"}</div>
                <div><strong>NSX:</strong> ${new Date(lot.production_date).toLocaleDateString("vi-VN")}</div>
                <div><strong>HSD:</strong> ${lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString("vi-VN") : "N/A"}</div>
                <div><strong>Số lượng:</strong> ${lot.quantity} ${lot.unit}</div>
              </div>
            </div>
          `,
            )
            .join("")}
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const handleExportPDF = async () => {
    handlePrint()
  }

  return (
    <div className="space-y-6">
      <WatermarkOverlay packageName={packageName} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">In nhãn mã TLC</h1>
          <p className="text-muted-foreground mt-1">In QR code hoặc Barcode cho lô hàng</p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline">
          Quay lại
        </Button>
      </div>

      {packageName.toLowerCase().includes("free") && (
        <Alert className="border-orange-200 bg-orange-50">
          <Lock className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-900">
            <strong>Gói miễn phí:</strong> Nhãn in sẽ có watermark. Nâng cấp lên gói Starter để xóa watermark và có thêm
            nhiều tính năng.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Chọn mã TLC</span>
              <Badge variant="secondary">{selectedLots.length} đã chọn</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm mã TLC hoặc batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-2">
              <Label>Loại mã</Label>
              <RadioGroup value={codeType} onValueChange={(v) => setCodeType(v as "qr" | "barcode")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="qr" id="qr" />
                  <Label htmlFor="qr" className="flex items-center gap-2 cursor-pointer">
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="barcode" id="barcode" />
                  <Label htmlFor="barcode" className="flex items-center gap-2 cursor-pointer">
                    <Barcode className="h-4 w-4" />
                    Barcode
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t">
              <Checkbox
                id="select-all"
                checked={selectedLots.length === lots.length && lots.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer">
                Chọn tất cả ({lots.length})
              </Label>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Đang tải...</p>
              ) : lots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Không có lô hàng nào</p>
              ) : (
                lots.map((lot) => (
                  <div key={lot.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                    <Checkbox
                      checked={selectedLots.includes(lot.id)}
                      onCheckedChange={() => handleToggleLot(lot.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-sm">{lot.tlc}</p>
                      <p className="text-sm text-muted-foreground truncate">{lot.products?.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        NSX: {new Date(lot.production_date).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handlePreview} disabled={selectedLots.length === 0} className="flex-1">
                Xem trước
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xem trước nhãn in</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(previews).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Printer className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Chọn mã TLC và nhấn "Xem trước"</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[500px] overflow-y-auto space-y-4">
                  {lots
                    .filter((lot) => selectedLots.includes(lot.id))
                    .map((lot) => (
                      <div key={lot.id} className="border-2 border-slate-900 p-4 rounded overflow-hidden">
                        <h3 className="font-semibold text-lg border-b pb-2 mb-3">
                          {lot.products?.product_name || "N/A"}
                        </h3>
                        {previews[lot.id] && (
                          <img
                            src={previews[lot.id] || "/placeholder.svg"}
                            alt={lot.tlc}
                            className="mx-auto my-3 max-w-full h-auto"
                          />
                        )}
                        <div className="text-sm space-y-1">
                          <div>
                            <strong className="inline-block w-28">Mã TLC:</strong> {lot.tlc}
                          </div>
                          <div>
                            <strong className="inline-block w-28">Mã lô:</strong> {lot.batch_number || "N/A"}
                          </div>
                          <div>
                            <strong className="inline-block w-28">Cơ sở:</strong> {lot.facilities?.name || "N/A"}
                          </div>
                          <div>
                            <strong className="inline-block w-28">NSX:</strong>{" "}
                            {new Date(lot.production_date).toLocaleDateString("vi-VN")}
                          </div>
                          <div>
                            <strong className="inline-block w-28">HSD:</strong>{" "}
                            {lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString("vi-VN") : "N/A"}
                          </div>
                          <div>
                            <strong className="inline-block w-28">Số lượng:</strong> {lot.quantity} {lot.unit}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handlePrint} className="flex-1 gap-2">
                    <Printer className="h-4 w-4" />
                    In ngay
                  </Button>
                  <Button onClick={handleExportPDF} variant="outline" className="flex-1 gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    Xuất PDF
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PrintLotsPage() {
  return (
    <Suspense fallback={null}>
      <PrintLotsContent />
    </Suspense>
  )
}
