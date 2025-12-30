import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { tlc: string } }) {
  try {
    const supabase = await createClient()
    const { tlc } = await params

    const { data: lot, error: lotError } = await supabase
      .from("traceability_lot_codes")
      .select("*, products(product_name, product_code)")
      .eq("tlc", tlc)
      .single()

    if (lotError || !lot) {
      return NextResponse.json({ error: "TLC not found" }, { status: 404 })
    }

    // Get all CTEs for this TLC in reverse chronological order
    const { data: ctes, error: ctesError } = await supabase
      .from("critical_tracking_events")
      .select(
        `
        *,
        facilities(name, location_code, address),
        key_data_elements(*)
      `,
      )
      .eq("tlc_id", lot.id)
      .order("event_date", { ascending: false })

    if (ctesError) {
      return NextResponse.json({ error: "Failed to fetch CTEs" }, { status: 500 })
    }

    // Build the backward trace chain
    const traceChain = []

    // Find receiving event to get source information
    const receivingEvent = ctes?.find((c) => c.event_type === "receiving")
    let sourceInfo = null

    if (receivingEvent) {
      // Get reference documents for the receiving event
      const { data: refDocs } = await supabase.from("reference_documents").select("*").eq("cte_id", receivingEvent.id)

      sourceInfo = {
        receiving_event: receivingEvent,
        reference_documents: refDocs,
      }
    }

    // Find source lots (if this lot was created from transformation)
    const { data: sourceLots } = await supabase
      .from("transformation_inputs")
      .select(
        `
        *,
        transformation_cte:transformation_cte_id(
          *,
          facilities(name, location_code)
        ),
        input_lot:input_tlc_id(
          tlc,
          products(product_name),
          critical_tracking_events(
            *,
            facilities(name, location_code)
          )
        )
      `,
      )
      .eq("transformation_cte.tlc_id", lot.id)

    for (const cte of ctes || []) {
      // Get reference documents for this CTE
      const { data: refDocs } = await supabase.from("reference_documents").select("*").eq("cte_id", cte.id)

      traceChain.push({
        ...cte,
        reference_documents: refDocs,
      })
    }

    return NextResponse.json({
      lot: {
        ...lot,
        trace_chain: traceChain,
        source_info: sourceInfo,
        source_lots: sourceLots?.map((s: any) => ({
          input_tlc: s.input_lot?.tlc,
          product_name: s.input_lot?.products?.product_name,
          quantity_used: s.quantity_used,
          facility: s.transformation_cte?.facilities?.name,
          transformation_date: s.transformation_cte?.event_date,
        })),
      },
    })
  } catch (error) {
    console.error("[v0] Backward trace error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
