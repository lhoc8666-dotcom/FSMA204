"use client"

import { Dialog } from "@/components/ui/dialog"

import {
  DialogFooter,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

interface USAgent {
  id: string
  agent_name: string
  agent_company_name: string | null
  agent_type: string
  email: string
  phone: string
  street_address: string
  city: string
  state: string
  zip_code: string
  contract_status: string
  notes: string | null
  company_id: string
}

export default function AdminUSAgentsPage() {
  const { toast } = useToast()
  const { locale, t } = useLanguage()
  const [agents, setAgents] = useState<USAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [agentName, setAgentName] = useState("")
  const [agentCompanyName, setAgentCompanyName] = useState("")
  const [agentType, setAgentType] = useState("individual")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [streetAddress, setStreetAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [contractStatus, setContractStatus] = useState("active")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    loadData()
    checkUserRole()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    const supabase = createClient()

    const agentsResult = await supabase.from("us_agents").select("*").order("created_at", { ascending: false })

    if (agentsResult.data) setAgents(agentsResult.data)
    setIsLoading(false)
  }

  const checkUserRole = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).single()
      setUserRole(profile?.role || null)
      setCompanyId(profile?.company_id || null)
    }
  }

  const resetForm = () => {
    setAgentName("")
    setAgentCompanyName("")
    setAgentType("individual")
    setEmail("")
    setPhone("")
    setStreetAddress("")
    setCity("")
    setState("")
    setZipCode("")
    setContractStatus("active")
    setNotes("")
    setEditingId(null)
  }

  const handleOpenDialog = (agent?: USAgent) => {
    if (agent) {
      setEditingId(agent.id)
      setAgentName(agent.agent_name)
      setAgentCompanyName(agent.agent_company_name || "")
      setAgentType(agent.agent_type)
      setEmail(agent.email)
      setPhone(agent.phone)
      setStreetAddress(agent.street_address)
      setCity(agent.city)
      setState(agent.state)
      setZipCode(agent.zip_code)
      setContractStatus(agent.contract_status)
      setNotes(agent.notes || "")
    } else {
      resetForm()
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!agentName || !email || !phone || !streetAddress || !city || !state || !zipCode) {
      toast({
        variant: "destructive",
        title: t("validation-error"),
        description: t("fill-in-all-required-fields"),
      })
      return
    }

    setIsSaving(true)
    const supabase = createClient()

    const data = {
      company_id: companyId, // Add company_id to satisfy RLS policy
      agent_name: agentName,
      agent_company_name: agentCompanyName || null,
      agent_type: agentType,
      email,
      phone,
      street_address: streetAddress,
      city,
      state,
      zip_code: zipCode,
      country: "USA",
      contract_status: contractStatus,
      notes: notes || null,
      is_primary: false,
      updated_at: new Date().toISOString(),
    }

    let error

    if (editingId) {
      const result = await supabase.from("us_agents").update(data).eq("id", editingId)
      error = result.error
    } else {
      const result = await supabase.from("us_agents").insert(data)
      error = result.error
    }

    if (error) {
      toast({
        variant: "destructive",
        title: t("save-error"),
        description: error.message,
      })
      setIsSaving(false)
      return
    }

    toast({
      title: editingId ? t("updated-successfully") : t("agent-added"),
      description: editingId ? t("agent-information-updated") : t("new-agent-added"),
    })

    setShowDialog(false)
    resetForm()
    loadData()
    setIsSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t("confirm-delete-agent", { name }))) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from("us_agents").delete().eq("id", id)

    if (error) {
      toast({
        variant: "destructive",
        title: t("delete-error"),
        description: error.message,
      })
      return
    }

    toast({
      title: t("deleted-successfully"),
      description: t("deleted-agent", { name }),
    })

    loadData()
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: t("active"), className: "bg-green-100 text-green-700" },
      expired: { label: t("expired"), className: "bg-red-100 text-red-700" },
      cancelled: { label: t("cancelled"), className: "bg-gray-100 text-gray-700" },
    }
    return config[status] || config.active
  }

  const isSystemAdmin = userRole === "system_admin"

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("us-agent-management")}</h1>
          <p className="text-muted-foreground mt-1">{t("manage-all-fda-agents-independent-entities")}</p>
        </div>
        {isSystemAdmin && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            {t("add-us-agent")}
          </Button>
        )}
      </div>

      {!isSystemAdmin && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <svg className="h-5 w-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-semibold">Chế độ xem (View Only)</p>
            <p className="text-sm">
              Bạn chỉ có thể xem danh sách US Agent. Liên hệ System Admin để thêm mới hoặc chỉnh sửa.
            </p>
          </div>
        </div>
      )}

      {isSystemAdmin && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <svg className="h-5 w-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-semibold">{t("system-admin-mode")}</p>
            <p className="text-sm">{t("agents-are-independent-us-representatives")}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {t("us-agents-list")} ({agents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">{t("no-agents-yet")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("agent-name")}</TableHead>
                  <TableHead>{t("agent-company")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("contact")}</TableHead>
                  <TableHead>{t("address")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="font-medium">{agent.agent_name}</div>
                    </TableCell>
                    <TableCell>
                      {agent.agent_company_name ? (
                        <div className="text-sm">{agent.agent_company_name}</div>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t("individual")}</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{agent.agent_type}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{agent.email}</div>
                        <div className="text-muted-foreground">{agent.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {agent.city}, {agent.state}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(agent.contract_status).className}>
                        {getStatusBadge(agent.contract_status).label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/us-agents/${agent.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {isSystemAdmin ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleOpenDialog(agent)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(agent.id, agent.agent_name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t("edit-us-agent") : t("add-new-us-agent")}</DialogTitle>
              <DialogDescription>{t("agent-independent-entity-explanation")}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agentName">{t("agent-name")} *</Label>
                  <Input
                    id="agentName"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agentCompanyName">{t("agent-company")}</Label>
                  <Input
                    id="agentCompanyName"
                    value={agentCompanyName}
                    onChange={(e) => setAgentCompanyName(e.target.value)}
                    placeholder="FDA Consulting Inc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agentType">{t("agent-type")} *</Label>
                  <Select value={agentType} onValueChange={setAgentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">{t("individual")}</SelectItem>
                      <SelectItem value="company">{t("company")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractStatus">{t("contract-status")} *</Label>
                  <Select value={contractStatus} onValueChange={setContractStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("active")}</SelectItem>
                      <SelectItem value="expired">{t("expired")}</SelectItem>
                      <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="agent@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")} *</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streetAddress">{t("street-address")} *</Label>
                <Input
                  id="streetAddress"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("city")} *</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">{t("state")} *</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t("zip-code")} *</Label>
                  <Input
                    id="zipCode"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="10001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t("notes")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("additional-notes-about-the-agent")}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
