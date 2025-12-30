import { requireAuth } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { type NextRequest, NextResponse } from "next/server"
import { Decimal } from "@/lib/decimal"
import { z } from "zod"

const createCTESchema = z.object({
  tlcId: z.string(),
  facilityId: z.string(),
  eventType: z.enum(["receiving", "cooling", "packing", "shipping", "transformation"]),
  eventDate: z.string().datetime(),
  quantityProcessed: z.string().transform((x) => new Decimal(x)),
  unit: z.string(),
  location: z.string().optional(),
  operatorName: z.string().optional(),
  temperature: z
    .string()
    .transform((x) => new Decimal(x))
    .optional(),
  notes: z.string().optional(),
  wasteExpected: z
    .string()
    .transform((x) => new Decimal(x))
    .optional(),
  wasteActual: z
    .string()
    .transform((x) => new Decimal(x))
    .optional(),
  wasteReason: z.string().optional(),
})

/**
 * POST /api/traceability/events/create
 * Creates a Critical Tracking Event (CTE)
 * Includes validation and inventory management
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const validatedData = createCTESchema.parse(body)

    // Get facility to verify ownership
    const facility = await prisma.facility.findUnique({
      where: { id: validatedData.facilityId },
      include: { company: true },
    })

    if (!facility) {
      return NextResponse.json({ success: false, message: "Facility not found" }, { status: 404 })
    }

    // Verify user belongs to the company
    if (facility.company.id !== session.user.companyId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 })
    }

    // Validate waste if transformation event
    if (validatedData.eventType === "transformation" && validatedData.wasteExpected && validatedData.wasteActual) {
      const wasteDifference = validatedData.wasteActual
        .minus(validatedData.wasteExpected)
        .dividedBy(validatedData.wasteExpected)
        .times(100)
      const percentageDifference = Math.abs(wasteDifference.toNumber())

      if (percentageDifference > 30 && !validatedData.wasteReason) {
        return NextResponse.json(
          {
            success: false,
            message: `Waste exceeds 30% threshold (${percentageDifference.toFixed(2)}%). waste_reason is required.`,
          },
          { status: 400 },
        )
      }
    }

    // Create the CTE
    const cte = await prisma.criticalTrackingEvent.create({
      data: {
        tlcId: validatedData.tlcId,
        facilityId: validatedData.facilityId,
        eventType: validatedData.eventType,
        eventDate: new Date(validatedData.eventDate),
        quantityProcessed: validatedData.quantityProcessed,
        unit: validatedData.unit,
        location: validatedData.location,
        operatorName: validatedData.operatorName,
        temperature: validatedData.temperature,
        notes: validatedData.notes,
        wasteExpected: validatedData.wasteExpected,
        wasteActual: validatedData.wasteActual,
        wasteReason: validatedData.wasteReason,
        status: "submitted",
        submittedAt: new Date(),
        submittedBy: session.user.id,
      },
      include: {
        keyDataElements: true,
        traceabilityLot: {
          include: { product: true },
        },
      },
    })

    // Update TLC inventory based on event type
    if (validatedData.eventType === "receiving") {
      await prisma.traceabilityLot.update({
        where: { id: validatedData.tlcId },
        data: {
          availableQuantity: {
            increment: validatedData.quantityProcessed,
          },
        },
      })
    } else if (["cooling", "packing", "shipping"].includes(validatedData.eventType)) {
      await prisma.traceabilityLot.update({
        where: { id: validatedData.tlcId },
        data: {
          availableQuantity: {
            decrement: validatedData.quantityProcessed,
          },
        },
      })

      if (validatedData.eventType === "shipping") {
        await prisma.traceabilityLot.update({
          where: { id: validatedData.tlcId },
          data: {
            shippedQuantity: {
              increment: validatedData.quantityProcessed,
            },
          },
        })
      }
    }

    // Log inventory change
    await prisma.inventoryBalanceLog.create({
      data: {
        companyId: facility.company.id,
        tlcId: validatedData.tlcId,
        eventType: validatedData.eventType,
        quantityChange:
          validatedData.eventType === "receiving"
            ? validatedData.quantityProcessed
            : validatedData.quantityProcessed.negated(),
        balanceBefore: new Decimal(0), // Should fetch actual balance
        balanceAfter: new Decimal(0), // Should fetch actual balance
        referenceId: cte.id,
        referenceType: "critical_tracking_event",
        notes: `CTE: ${validatedData.eventType}`,
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: "Critical Tracking Event created successfully",
        cte: {
          id: cte.id,
          eventType: cte.eventType,
          status: cte.status,
          tlcCode: cte.traceabilityLot.tlc,
          product: cte.traceabilityLot.product.productName,
          quantityProcessed: cte.quantityProcessed.toString(),
          submittedAt: cte.submittedAt,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, message: "Validation error", errors: error.errors }, { status: 400 })
    }

    console.error("[API Error]", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
