import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { tlc: string } }) {
  try {
    const supabase = await createClient()
    const { tlc } = params

    // Get the initial TLC
    const { data: lot, error: lotError } = await supabase
      .from("traceability_lot_codes")
      .select("*, products(product_name, product_code)")
      .eq("tlc", tlc)
      .single()

    if (lotError || !lot) {
      return NextResponse.json({ error: "TLC not found" }, { status: 404 })
    }

    // Get all CTEs for this TLC in chronological order
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
      .order("event_date", { ascending: true })

    if (ctesError) {
      return NextResponse.json({ error: "Failed to fetch CTEs" }, { status: 500 })
    }

    // Build the forward trace chain
    const traceChain = []

    for (const cte of ctes || []) {
      // Get transformation inputs if this is a transformation event
      let inputs = null
      if (cte.event_type === "transformation") {
        const { data: transformInputs } = await supabase
          .from("transformation_inputs")
          .select(
            `
            *,
            input_lot:input_tlc_id(tlc, products(product_name))
          `,
          )
          .eq("transformation_cte_id", cte.id)

        inputs = transformInputs
      }

      // Get shipping details if this is a shipping event
      let shipping = null
      if (cte.event_type === "shipping") {
        const { data: shipment } = await supabase
          .from("shipments")
          .select(
            `
            *,
            reference_documents(*)
          `,
          )
          .eq("cte_id", cte.id)
          .single()

        shipping = shipment
      }

      traceChain.push({
        ...cte,
        transformation_inputs: inputs,
        shipping_details: shipping,
      })
    }

    // Find downstream lots (if this lot was used in transformation)
    const { data: downstreamTransformations } = await supabase
      .from("transformation_inputs")
      .select(
        `
        transformation_cte_id,
        critical_tracking_events!inner(
          tlc_id,
          traceability_lot_codes(tlc, products(product_name))
        )
      `,
      )
      .eq("input_tlc_id", lot.id)

    return NextResponse.json({
      lot: {
        ...lot,
        trace_chain: traceChain,
        downstream_lots: downstreamTransformations?.map((t: any) => ({
          tlc: t.critical_tracking_events?.traceability_lot_codes?.tlc,
          product_name: t.critical_tracking_events?.traceability_lot_codes?.products?.product_name,
        })),
      },
    })
  } catch (error) {
    console.error("[v0] Forward trace error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
