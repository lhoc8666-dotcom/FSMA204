import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, AlertTriangle, CheckCircle } from "lucide-react"
import { hasFeatureAccess } from "@/lib/plan-config"

export default async function InventoryManagementPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/dashboard")

  const hasAccess = await hasFeatureAccess(profile.company_id, "advanced_inventory")
  if (!hasAccess) {
    redirect("/admin/pricing?feature=advanced_inventory")
  }

  // Query inventory from materialized view (if exists) or fallback to real-time
  const { data: inventoryData, error } = await supabase
    .from("mv_tlc_inventory_stock")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("current_stock", { ascending: true })

  let inventory = inventoryData
  if (error && error.code === "PGRST205") {
    const { data: tlcs } = await supabase
      .from("traceability_lot_codes")
      .select("*, products(name), facilities(name)")
      .eq("company_id", profile.company_id)
      .order("available_quantity", { ascending: true })

    inventory = tlcs?.map((tlc) => ({
      tlc: tlc.tlc,
      product_name: tlc.products?.name,
      facility_name: tlc.facilities?.name,
      current_stock: tlc.available_quantity,
      unit: tlc.unit,
      status: tlc.available_quantity <= 0 ? "depleted" : tlc.available_quantity < 100 ? "low" : "good",
    }))
  }

  // Calculate metrics
  const depleted = inventory?.filter((item) => item.status === "depleted").length || 0
  const lowStock = inventory?.filter((item) => item.status === "low").length || 0
  const goodStock = inventory?.filter((item) => item.status === "good").length || 0

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-slate-600">Real-time stock levels across all facilities - FSMA 204 Compliant</p>
      </div>

      {/* Stock Overview */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Depleted Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{depleted}</div>
            <p className="text-xs text-red-700 mt-1">Zero inventory</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4 text-yellow-600" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{lowStock}</div>
            <p className="text-xs text-yellow-700 mt-1">Below minimum threshold</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Good Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{goodStock}</div>
            <p className="text-xs text-emerald-700 mt-1">Adequate inventory</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Details */}
      <Card>
        <CardHeader>
          <CardTitle>Current Inventory Levels</CardTitle>
          <CardDescription>Sorted by stock level (lowest first)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">TLC</th>
                  <th className="text-left p-3 text-sm font-medium">Product</th>
                  <th className="text-left p-3 text-sm font-medium">Facility</th>
                  <th className="text-right p-3 text-sm font-medium">Current Stock</th>
                  <th className="text-left p-3 text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory?.map((item, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50">
                    <td className="p-3 text-sm font-mono">{item.tlc}</td>
                    <td className="p-3 text-sm font-medium">{item.product_name}</td>
                    <td className="p-3 text-sm text-slate-600">{item.facility_name}</td>
                    <td className="p-3 text-sm text-right font-bold">
                      {item.current_stock?.toFixed(2)} {item.unit}
                    </td>
                    <td className="p-3">
                      {item.status === "depleted" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Depleted
                        </Badge>
                      )}
                      {item.status === "low" && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1">
                          <Package className="w-3 h-3" />
                          Low
                        </Badge>
                      )}
                      {item.status === "good" && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Good
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!inventory || inventory.length === 0) && (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No inventory data available</p>
              <p className="text-sm mt-1">Create traceability lots to start tracking inventory</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
