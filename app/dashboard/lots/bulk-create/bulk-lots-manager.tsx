"use client"

import { BulkUpload } from "@/components/bulk-upload"
import { createClient } from "@/lib/supabase/client"
import { validateRequired, validateDate, validateNumber } from "@/lib/utils/csv-parser"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

interface LotCSV {
  tlc: string
  product_id: string
  facility_id: string
  production_date: string
  expiry_date?: string
  quantity: number
  unit: string
  batch_number?: string
  status: string
}

const TEMPLATE_COLUMNS = [
  "tlc",
  "product_code",
  "facility_location_code",
  "production_date",
  "expiry_date",
  "quantity",
  "unit",
  "batch_number",
  "status",
]

export function BulkLotsManager() {
  const supabase = createClient()

  const validateLots = async (data: any[]) => {
    const valid: any[] = []
    const errors: Array<{ row: number; field: string; message: string }> = []

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()

    if (!profile?.company_id) throw new Error("No company found")

    const { data: products } = await supabase
      .from("products")
      .select("id, product_code")
      .eq("company_id", profile.company_id)

    const { data: facilities } = await supabase
      .from("facilities")
      .select("id, location_code")
      .eq("company_id", profile.company_id)

    const productMap = new Map(products?.map((p) => [p.product_code, p.id]))
    const facilityMap = new Map(facilities?.map((f) => [f.location_code, f.id]))

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      const tlcError = validateRequired(row.tlc, "tlc")
      const productError = validateRequired(row.product_code, "product_code")
      const facilityError = validateRequired(row.facility_location_code, "facility_location_code")
      const prodDateError =
        validateRequired(row.production_date, "production_date") || validateDate(row.production_date)
      const quantityError = validateRequired(row.quantity, "quantity") || validateNumber(row.quantity, "quantity")
      const unitError = validateRequired(row.unit, "unit")

      if (tlcError) errors.push({ row: rowNum, field: "tlc", message: tlcError })
      if (productError) errors.push({ row: rowNum, field: "product_code", message: productError })
      if (facilityError) errors.push({ row: rowNum, field: "facility_location_code", message: facilityError })
      if (prodDateError) errors.push({ row: rowNum, field: "production_date", message: prodDateError })
      if (quantityError) errors.push({ row: rowNum, field: "quantity", message: quantityError })
      if (unitError) errors.push({ row: rowNum, field: "unit", message: unitError })

      if (row.expiry_date) {
        const expiryError = validateDate(row.expiry_date)
        if (expiryError) errors.push({ row: rowNum, field: "expiry_date", message: expiryError })
      }

      const productId = productMap.get(row.product_code)
      const facilityId = facilityMap.get(row.facility_location_code)

      if (!productId) {
        errors.push({ row: rowNum, field: "product_code", message: `Product code '${row.product_code}' not found` })
      }
      if (!facilityId) {
        errors.push({
          row: rowNum,
          field: "facility_location_code",
          message: `Facility location '${row.facility_location_code}' not found`,
        })
      }

      if (
        !tlcError &&
        !productError &&
        !facilityError &&
        !prodDateError &&
        !quantityError &&
        !unitError &&
        productId &&
        facilityId
      ) {
        valid.push({
          tlc: row.tlc,
          product_id: productId,
          facility_id: facilityId,
          production_date: row.production_date,
          expiry_date: row.expiry_date || null,
          quantity: Number(row.quantity),
          unit: row.unit,
          batch_number: row.batch_number || null,
          status: row.status || "Active",
        })
      }
    }

    return { valid, errors }
  }

  const uploadLots = async (lots: any[]) => {
    const { error } = await supabase.from("traceability_lot_codes").insert(lots)

    if (error) throw error
  }

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Important Notes:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              Use <code>product_code</code> (not product name) to identify products
            </li>
            <li>
              Use <code>facility_location_code</code> (not facility name) to identify facilities
            </li>
            <li>Date format must be YYYY-MM-DD (e.g., 2025-01-15)</li>
            <li>Status options: Active, Shipped, Consumed, Expired</li>
          </ul>
        </AlertDescription>
      </Alert>

      <BulkUpload
        title="Bulk Create Traceability Lots"
        description="Upload multiple lots with their TLC codes using a CSV file"
        templateColumns={TEMPLATE_COLUMNS}
        onValidate={validateLots}
        onUpload={uploadLots}
      />
    </div>
  )
}
