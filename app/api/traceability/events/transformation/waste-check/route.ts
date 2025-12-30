import { requireAuth } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"
import { Decimal } from "@/lib/decimal"
import { z } from "zod"

const wasteCheckSchema = z.object({
  tlcId: z.string(),
  wasteExpected: z.string().transform((x) => new Decimal(x)),
  wasteActual: z.string().transform((x) => new Decimal(x)),
})

/**
 * POST /api/traceability/events/transformation/waste-check
 * Validates waste during transformation events
 * Business Rule: If waste > 30% above expected, require waste_reason
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const { tlcId, wasteExpected, wasteActual } = wasteCheckSchema.parse(body)

    // Get the TLC
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

    // Calculate waste percentage difference
    if (wasteExpected.equals(0)) {
      return NextResponse.json({ success: false, message: "Expected waste cannot be zero" }, { status: 400 })
    }

    const wasteDifference = wasteActual.minus(wasteExpected).dividedBy(wasteExpected).times(100)
    const percentageDifference = Math.abs(wasteDifference.toNumber())

    // Check if waste exceeds 30% threshold
    const exceedsThreshold = percentageDifference > 30
    const requiresReason = exceedsThreshold

    const response = {
      success: true,
      wasteAnalysis: {
        expectedWaste: wasteExpected.toString(),
        actualWaste: wasteActual.toString(),
        difference: wasteDifference.toString(),
        percentageDifference: percentageDifference.toFixed(2),
        exceedsThreshold,
        unit: tlc.unit,
      },
      requiresWasteReason: requiresReason,
      message: requiresReason
        ? `Waste difference (${percentageDifference.toFixed(2)}%) exceeds 30% threshold. Please provide waste_reason.`
        : "Waste is within acceptable range",
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: "Validation error", errors: error.errors }, { status: 400 })
    }

    console.error("[API Error]", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
