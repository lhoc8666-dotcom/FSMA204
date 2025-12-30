import { requireAuth } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"
import { Decimal } from "@/lib/decimal"
import { z } from "zod"

const validateShipmentSchema = z.object({
  tlcId: z.string(),
  quantity: z.string().transform((x) => new Decimal(x)),
})

/**
 * POST /api/traceability/shipments/validate
 * Validates inventory before shipping - prevents over-shipping
 * Business Rule: Cannot ship more than available quantity for a TLC
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const { tlcId, quantity } = validateShipmentSchema.parse(body)

    // Get the TLC with facility info
    const tlc = await prisma.traceabilityLot.findUnique({
      where: { id: tlcId },
      include: {
        facility: {
          include: { company: true },
        },
        product: true,
      },
    })

    if (!tlc) {
      return NextResponse.json({ success: false, message: "Traceability Lot not found" }, { status: 404 })
    }

    // Verify user belongs to the company
    if (tlc.facility.company.id !== session.user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 })
    }

    // Check if sufficient quantity is available
    if (quantity.greaterThan(tlc.availableQuantity)) {
      return NextResponse.json(
        {
          success: false,
          message: `Insufficient inventory. Available: ${tlc.availableQuantity} ${tlc.unit}, Requested: ${quantity} ${tlc.unit}`,
          available: tlc.availableQuantity.toString(),
          requested: quantity.toString(),
          deficit: quantity.minus(tlc.availableQuantity).toString(),
        },
        { status: 400 },
      )
    }

    // Check if TLC is still active
    if (tlc.status !== "active") {
      return NextResponse.json({ success: false, message: `Cannot ship from ${tlc.status} TLC` }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        message: "Shipment validation passed",
        tlc: {
          id: tlc.id,
          tlc: tlc.tlc,
          productName: tlc.product.productName,
          availableQuantity: tlc.availableQuantity.toString(),
          unit: tlc.unit,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: "Validation error", errors: error.errors }, { status: 400 })
    }

    console.error("[API Error]", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
