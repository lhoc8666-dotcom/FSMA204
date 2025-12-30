"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Edit, AlertCircle, Bell, ClipboardCheck } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface FDARegistration {
  id: string
  company_id: string
  facility_name: string
  facility_address: string
  facility_city: string
  facility_state: string
  facility_zip_code: string
  facility_country: string
  owner_operator_name: string
  fda_registration_number: string | null
  registration_status: string
  registration_date: string | null
  expiry_date: string | null
  renewal_date: string | null
  fei_number: string | null
  duns_number: string | null
  facility_type_fda: string[] | null
  food_product_categories: string[] | null
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string | null
  last_inspection_date: string | null
  next_inspection_date: string | null
  notification_enabled: boolean
  notification_days_before: number
  created_at: string
  updated_at: string
  company_name?: string
  agent_assignments?: {
    us_agents?: {
      agent_name: string
      email: string
      phone: string
    }
    assignment_date: string
    expiry_date: string
    status: string
  }[]
}

interface Company {
  id: string
  name: string
  registration_number: string
  email: string | null
}

interface USAgent {
  id: string
  agent_name: string
  email: string
  phone: string
}

export default function AdminFDARegistrationsPage() {
  const { toast } = useToast()
  const [registrations, setRegistrations] = useState<FDARegistration[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [usAgents, setUsAgents] = useState<USAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState<
    Partial<FDARegistration & { us_agent_id?: string; registration_years?: number }>
  >({
    company_id: "",
    facility_name: "",
    facility_address: "",
    facility_city: "",
    facility_state: "",
    facility_zip_code: "",
    facility_country: "Vietnam",
    owner_operator_name: "",
    fda_registration_number: "",
    registration_status: "pending",
    registration_date: "",
    expiry_date: "",
    renewal_date: "",
    fei_number: "",
    duns_number: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    last_inspection_date: "",
    next_inspection_date: "",
    notification_enabled: true,
    notification_days_before: 30,
    us_agent_id: "",
    registration_years: 2,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    const supabase = createClient()

    console.log("[v0] Checking user authentication and role...")
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[v0] User authentication failed:", userError)
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please sign in to access this page.",
      })
      setIsLoading(false)
      return
    }

    console.log("[v0] User authenticated:", user.id)

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error("[v0] Error loading user profile:", profileError)
      toast({
        variant: "destructive",
        title: "Profile Not Found",
        description: "Your user profile could not be loaded. Please contact support or sign up again.",
      })
      setIsLoading(false)
      return
    }

    const currentRole = profile?.role
    const userCompanyId = profile?.company_id
    setUserRole(currentRole)
    setUserCompanyId(userCompanyId)
    console.log("[v0] User role:", currentRole, "Company ID:", userCompanyId)

    if (!currentRole || !["system_admin", "admin"].includes(currentRole)) {
      console.warn("[v0] Insufficient permissions. User role:", currentRole)
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You don't have permission to access this page. System Admin or Admin role required.",
      })
      setIsLoading(false)
      return
    }

    console.log("[v0] Loading companies...")
    const companiesQuery = supabase.from("companies").select("id, name, registration_number, email").order("name")

    if (currentRole !== "system_admin" && userCompanyId) {
      companiesQuery.eq("id", userCompanyId)
    }

    const { data: companiesData, error: companiesError } = await companiesQuery

    if (companiesError) {
      console.error("[v0] Error loading companies:", companiesError)
      if (companiesError.code !== "PGRST116") {
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: `Failed to load companies: ${companiesError.message}`,
        })
      }
    } else {
      console.log("[v0] Companies loaded:", companiesData?.length || 0)
      if (companiesData) setCompanies(companiesData)
    }

    console.log("[v0] Loading US agents...")
    const agentsQuery = supabase.from("us_agents").select("id, agent_name, email, phone").order("agent_name")

    if (currentRole !== "system_admin" && userCompanyId) {
      agentsQuery.eq("company_id", userCompanyId)
    }

    const { data: usAgentsData, error: agentsError } = await agentsQuery

    if (agentsError) {
      console.error("[v0] US agents query error:", {
        message: agentsError.message,
        code: agentsError.code,
        details: agentsError.details,
        hint: agentsError.hint,
      })

      if (agentsError.message?.includes("email")) {
        console.log("[v0] Retrying US agents query without email column...")
        const retryQuery = supabase.from("us_agents").select("id, agent_name, phone").order("agent_name")

        if (currentRole !== "system_admin" && userCompanyId) {
          retryQuery.eq("company_id", userCompanyId)
        }

        const { data: retryData, error: retryError } = await retryQuery

        if (!retryError && retryData) {
          console.log(`[v0] Retry successful: Loaded ${retryData.length} US agent(s)`)
          setUsAgents(retryData)
        } else if (retryError && retryError.code !== "PGRST116") {
          console.error("[v0] Retry also failed:", retryError.message)
          toast({
            variant: "destructive",
            title: "Lỗi tải dữ liệu",
            description: `Không thể tải US Agents: ${retryError.message}`,
          })
        }
      } else if (agentsError.code !== "PGRST116") {
        toast({
          variant: "destructive",
          title: "Lỗi tải dữ liệu",
          description: `Không thể tải US Agents: ${agentsError.message}`,
        })
      } else {
        console.log("[v0] No US agents found or no access")
      }
    } else {
      const agentCount = usAgentsData?.length || 0
      console.log(`[v0] Loaded ${agentCount} US agent(s)`)

      setUsAgents(usAgentsData || [])
    }

    console.log("[v0] Loading FDA registrations...")
    const registrationsQuery = supabase
      .from("fda_registrations")
      .select(
        `
        *,
        companies (name)
      `,
      )
      .order("renewal_date", { ascending: true })

    if (currentRole !== "system_admin" && userCompanyId) {
      const { data: userFacilities } = await supabase.from("facilities").select("id").eq("company_id", userCompanyId)

      if (userFacilities && userFacilities.length > 0) {
        const facilityIds = userFacilities.map((f) => f.id)
        registrationsQuery.in("facility_id", facilityIds)
      } else {
        console.log("[v0] No facilities found for company, skipping registrations")
        setRegistrations([])
        setIsLoading(false)
        return
      }
    }

    const { data: registrationsData, error } = await registrationsQuery

    if (error) {
      if (error.message && error.code && error.code !== "PGRST116") {
        console.error("[v0] Error loading FDA registrations:", error.message, "Code:", error.code)
        toast({
          variant: "destructive",
          title: "Lỗi tải dữ liệu",
          description: `Không thể tải FDA Registrations: ${error.message}`,
        })
      } else {
        console.log("[v0] No FDA registrations found or no access")
      }
    } else {
      const regCount = registrationsData?.length || 0
      console.log(`[v0] Loaded ${regCount} FDA registration(s)`)
      setRegistrations(registrationsData || [])
    }

    setIsLoading(false)
  }

  const resetForm = () => {
    setFormData({
      company_id: "",
      facility_name: "",
      facility_address: "",
      facility_city: "",
      facility_state: "",
      facility_zip_code: "",
      facility_country: "Vietnam",
      owner_operator_name: "",
      fda_registration_number: "",
      registration_status: "pending",
      registration_date: "",
      expiry_date: "",
      renewal_date: "",
      fei_number: "",
      duns_number: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      notes: "",
      last_inspection_date: "",
      next_inspection_date: "",
      notification_enabled: true,
      notification_days_before: 30,
      us_agent_id: "",
      registration_years: 2,
    })
    setEditingId(null)
  }

  const handleCompanyChange = (companyId: string) => {
    const selectedCompany = companies.find((c) => c.id === companyId)
    setFormData({
      ...formData,
      company_id: companyId,
      owner_operator_name: selectedCompany?.name || "",
      contact_email: selectedCompany?.email || formData.contact_email,
    })
  }

  const handleOpenDialog = (registration?: FDARegistration) => {
    if (registration) {
      setEditingId(registration.id)
      const activeAssignment = registration.agent_assignments?.find((a) => a.status === "active")
      setFormData({
        ...registration,
        us_agent_id: activeAssignment ? activeAssignment.us_agent_id : "",
      })
    } else {
      resetForm()
    }
    setShowDialog(true)
  }

  const handleEdit = (registration: FDARegistration) => {
    handleOpenDialog(registration)
  }

  const handleSave = async () => {
    const {
      company_id,
      facility_name,
      facility_address,
      facility_city,
      facility_state,
      facility_zip_code,
      facility_country,
      owner_operator_name,
      fda_registration_number,
      registration_status,
      registration_date,
      expiry_date,
      renewal_date,
      fei_number,
      duns_number,
      contact_name,
      contact_email,
      contact_phone,
      notes,
      last_inspection_date,
      next_inspection_date,
      notification_enabled,
      notification_days_before,
      us_agent_id,
      registration_years,
    } = formData

    if (!company_id || !facility_name || !owner_operator_name || !contact_name || !contact_email || !contact_phone) {
      toast({
        variant: "destructive",
        title: "Lỗi xác thực",
        description: "Vui lòng điền đầy đủ thông tin bắt buộc (công ty, tên cơ sở, tên chủ sở hữu, thông tin liên hệ)",
      })
      return
    }

    setIsSaving(true)
    const supabase = createClient()

    const fdaData = {
      company_id,
      facility_name,
      facility_address: facility_address || null,
      facility_city: facility_city || null,
      facility_state: facility_state || null,
      facility_zip_code: facility_zip_code || null,
      facility_country: facility_country || "Vietnam",
      owner_operator_name,
      fda_registration_number: fda_registration_number || null,
      registration_status,
      registration_date: registration_date || null,
      expiry_date: expiry_date || null,
      renewal_date: renewal_date || null,
      fei_number: fei_number || null,
      duns_number: duns_number || null,
      contact_name,
      contact_email,
      contact_phone,
      notes: notes || null,
      last_inspection_date: last_inspection_date || null,
      next_inspection_date: next_inspection_date || null,
      notification_enabled,
      notification_days_before,
      updated_at: new Date().toISOString(),
    }

    let fdaRegistrationId = editingId
    let error

    if (editingId) {
      const result = await supabase.from("fda_registrations").update(fdaData).eq("id", editingId)
      error = result.error
    } else {
      const result = await supabase.from("fda_registrations").insert(fdaData).select().single()
      error = result.error
      if (!error && result.data) {
        fdaRegistrationId = result.data.id
      }
    }

    if (error) {
      toast({
        variant: "destructive",
        title: "Lỗi lưu dữ liệu",
        description: error.message,
      })
      setIsSaving(false)
      return
    }

    if (us_agent_id && fdaRegistrationId && formData.registration_date && registration_years) {
      const assignmentData = {
        us_agent_id,
        company_id,
        fda_registration_id: fdaRegistrationId,
        assignment_date: formData.registration_date,
        assignment_years: registration_years,
        expiry_date: calculateAgentExpiryDate(formData.registration_date, registration_years),
        status: "active",
      }

      console.log("[v0] Processing agent assignment:", assignmentData)

      // Check if assignment already exists with explicit error handling
      const { data: existingAssignments, error: queryError } = await supabase
        .from("agent_assignments")
        .select("id")
        .eq("fda_registration_id", fdaRegistrationId)
        .eq("us_agent_id", us_agent_id)
        .maybeSingle()

      if (queryError) {
        console.error("[v0] Error checking existing assignments:", queryError)
        toast({
          variant: "destructive",
          title: "Lỗi kiểm tra agent",
          description: queryError.message,
        })
        setIsSaving(false)
        return
      }

      console.log("[v0] Existing assignment:", existingAssignments ? "found" : "not found")

      let assignmentError

      if (existingAssignments) {
        // Update existing assignment
        console.log("[v0] Updating existing agent assignment:", existingAssignments.id)
        const result = await supabase.from("agent_assignments").update(assignmentData).eq("id", existingAssignments.id)
        assignmentError = result.error

        if (!assignmentError) {
          console.log("[v0] Successfully updated agent assignment")
          toast({
            title: "Thành công",
            description: "Đã cập nhật thông tin US Agent",
          })
        }
      } else {
        // Create new assignment
        console.log("[v0] Creating new agent assignment")
        const result = await supabase.from("agent_assignments").insert(assignmentData)
        assignmentError = result.error

        if (!assignmentError) {
          console.log("[v0] Successfully created agent assignment")
          toast({
            title: "Thành công",
            description: "Đã gán US Agent thành công",
          })
        }
      }

      if (assignmentError) {
        console.error("[v0] Error with agent assignment:", assignmentError)
        toast({
          variant: "destructive",
          title: "Lỗi agent assignment",
          description: assignmentError.message,
        })
      }
    }

    toast({
      title: editingId ? "Cập nhật thành công" : "Tạo đăng ký FDA thành công",
      description: editingId ? "Thông tin đăng ký đã được cập nhật" : "Đã thêm đăng ký FDA mới",
    })

    setShowDialog(false)
    resetForm()
    loadData()
    setIsSaving(false)
  }

  const calculateFdaExpiryDate = (registrationDateStr: string) => {
    if (!registrationDateStr) return ""
    const regDate = new Date(registrationDateStr)
    const regYear = regDate.getFullYear()

    let expiryYear = regYear
    if (expiryYear % 2 === 1) {
      expiryYear += 1
    } else {
      expiryYear += 2
    }

    return `${expiryYear}-12-31`
  }

  const calculateAgentExpiryDate = (registrationDate: string, years: number) => {
    if (!registrationDate || !years) return ""
    const date = new Date(registrationDate)
    date.setFullYear(date.getFullYear() + years)
    return date.toISOString().split("T")[0]
  }

  useEffect(() => {
    if (formData.registration_date) {
      const newExpiryDate = calculateFdaExpiryDate(formData.registration_date)
      setFormData((prev) => ({ ...prev, expiry_date: newExpiryDate }))
    }
  }, [formData.registration_date])

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      pending: { label: "Đang chờ", className: "bg-yellow-100 text-yellow-700" },
      active: { label: "Đang hoạt động", className: "bg-green-100 text-green-700" },
      expired: { label: "Hết hạn", className: "bg-red-100 text-red-700" },
      cancelled: { label: "Đã hủy", className: "bg-gray-100 text-gray-700" },
    }
    return config[status] || config.pending
  }

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const today = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getExpiryWarning = (expiryDate: string | null, notificationDaysBefore: number) => {
    const days = getDaysUntilExpiry(expiryDate)
    if (days === null) return null

    if (days < 0) {
      return { type: "expired", message: `Đã hết hạn ${Math.abs(days)} ngày trước`, className: "text-red-600" }
    } else if (days <= notificationDaysBefore) {
      return {
        type: "warning",
        message: `Sắp hết hạn (còn ${days} ngày)`,
        className: "text-amber-600",
      }
    }
    return null
  }

  const upcomingExpirations = registrations.filter((reg) => {
    const days = getDaysUntilExpiry(reg.expiry_date)
    return days !== null && days > 0 && days <= reg.notification_days_before
  })

  const expiredRegistrations = registrations.filter((reg) => {
    const days = getDaysUntilExpiry(reg.expiry_date)
    return days !== null && days < 0
  })

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
    <div className="p-8 space-y-6" data-tour="fda-registration">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Quản lý đăng ký FDA</h1>
          <p className="text-muted-foreground">
            {isSystemAdmin
              ? "Tạo và quản lý đăng ký FDA cho các công ty"
              : "Xem danh sách đăng ký FDA (chỉ System Admin có thể tạo mới)"}
          </p>
        </div>
        <div className="flex gap-2">
          {isSystemAdmin && (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/facility-requests">
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Yêu cầu cập nhật
                </Link>
              </Button>
              <Button onClick={() => handleOpenDialog()} disabled={isLoading || companies.length === 0}>
                {isLoading ? "Đang tải..." : "Tạo đăng ký FDA mới"}
              </Button>
            </>
          )}
        </div>
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
              Bạn chỉ có thể xem danh sách đăng ký FDA. Liên hệ System Admin để tạo mới hoặc chỉnh sửa.
            </p>
          </div>
        </div>
      )}

      {(upcomingExpirations.length > 0 || expiredRegistrations.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredRegistrations.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Đã hết hạn ({expiredRegistrations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {expiredRegistrations.slice(0, 3).map((reg) => (
                    <li key={reg.id} className="text-sm">
                      <span className="font-medium">{reg.facility_name}</span>
                      <span className="text-red-600 ml-2">
                        {getExpiryWarning(reg.expiry_date, reg.notification_days_before)?.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {upcomingExpirations.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="text-amber-700 flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Sắp hết hạn ({upcomingExpirations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {upcomingExpirations.slice(0, 3).map((reg) => (
                    <li key={reg.id} className="text-sm">
                      <span className="font-medium">{reg.facility_name}</span>
                      <span className="text-amber-600 ml-2">
                        {getExpiryWarning(reg.expiry_date, reg.notification_days_before)?.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách đăng ký FDA ({registrations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Chưa có đăng ký FDA nào</p>
              <p className="text-sm text-muted-foreground mb-4">
                {isSystemAdmin
                  ? "Tạo đăng ký FDA đầu tiên bằng cách nhấn nút 'Tạo đăng ký FDA mới'"
                  : "Liên hệ System Admin để tạo đăng ký FDA cho công ty của bạn"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Công ty</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Số đăng ký FDA</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày hết hạn FDA</TableHead>
                  <TableHead>Đại diện Mỹ</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg) => {
                  const warning = getExpiryWarning(reg.expiry_date, reg.notification_days_before)
                  const activeAgent = reg.agent_assignments?.find((a) => a.status === "active")
                  const agentWarning = activeAgent
                    ? getExpiryWarning(activeAgent.expiry_date, reg.notification_days_before)
                    : null

                  return (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">
                        <div>{reg.company_name}</div>
                        <div className="text-xs text-muted-foreground">{reg.owner_operator_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{reg.facility_name}</div>
                        <div className="text-xs text-muted-foreground">{reg.facility_address}</div>
                      </TableCell>
                      <TableCell>{reg.fda_registration_number || "-"}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(reg.registration_status).className}>
                          {getStatusBadge(reg.registration_status).label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.expiry_date ? (
                          <div className="flex items-center gap-2">
                            <span>{new Date(reg.expiry_date).toLocaleDateString("vi-VN")}</span>
                            {warning && (
                              <Badge variant="outline" className={warning.className}>
                                {warning.type === "expired" ? "Hết hạn" : "Sắp hết hạn"}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {activeAgent ? (
                          <div className="text-sm">
                            <div className="font-medium">{activeAgent.us_agents?.agent_name}</div>
                            <div className="text-xs text-muted-foreground">
                              Hết hạn: {new Date(activeAgent.expiry_date).toLocaleDateString("vi-VN")}
                            </div>
                            {agentWarning && (
                              <Badge variant="outline" className={agentWarning.className}>
                                {agentWarning.type === "expired" ? "Agent hết hạn" : "Agent sắp hết hạn"}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Chưa gán</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSystemAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(reg)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Chỉnh sửa đăng ký FDA" : "Thêm đăng ký FDA mới"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Cập nhật thông tin đăng ký FDA" : "Chọn công ty và nhập thông tin cơ sở để đăng ký FDA"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Company Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin công ty</h3>
              <div className="space-y-2">
                <Label>Công ty *</Label>
                <Select value={formData.company_id} onValueChange={handleCompanyChange} disabled={!!editingId}>
                  <SelectTrigger>
                    <SelectValue placeholder={companies.length === 0 ? "Chưa có công ty nào" : "Chọn công ty"} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <p className="font-medium mb-2">Chưa có công ty nào trong hệ thống</p>
                        <p className="text-xs">System Admin cần tạo công ty tại trang "Companies" trước</p>
                      </div>
                    ) : (
                      companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.registration_number})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Chọn công ty cần đăng ký FDA. Tên công ty sẽ tự động điền vào "Tên chủ sở hữu".
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tên chủ sở hữu / Owner Operator Name *</Label>
                <Input
                  value={formData.owner_operator_name || ""}
                  onChange={(e) => setFormData({ ...formData, owner_operator_name: e.target.value })}
                  placeholder="Tên pháp lý của công ty"
                />
                <p className="text-xs text-muted-foreground">
                  Tên công ty được đăng ký với FDA (thường trùng với tên công ty)
                </p>
              </div>
            </div>

            <Separator />

            {/* Facility Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin cơ sở FDA</h3>
              <p className="text-sm text-muted-foreground">
                Nhập thông tin cơ sở sản xuất/chế biến sẽ được đăng ký với FDA
              </p>

              <div className="space-y-2">
                <Label>Tên cơ sở *</Label>
                <Input
                  value={formData.facility_name || ""}
                  onChange={(e) => setFormData({ ...formData, facility_name: e.target.value })}
                  placeholder="VD: Nhà máy sản xuất VNTEETH"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Địa chỉ</Label>
                  <Input
                    value={formData.facility_address || ""}
                    onChange={(e) => setFormData({ ...formData, facility_address: e.target.value })}
                    placeholder="Số nhà, đường"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thành phố</Label>
                  <Input
                    value={formData.facility_city || ""}
                    onChange={(e) => setFormData({ ...formData, facility_city: e.target.value })}
                    placeholder="VD: Hà Nội"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tỉnh/Thành phố</Label>
                  <Input
                    value={formData.facility_state || ""}
                    onChange={(e) => setFormData({ ...formData, facility_state: e.target.value })}
                    placeholder="VD: Hà Nội"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mã bưu điện</Label>
                  <Input
                    value={formData.facility_zip_code || ""}
                    onChange={(e) => setFormData({ ...formData, facility_zip_code: e.target.value })}
                    placeholder="VD: 100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quốc gia</Label>
                  <Input
                    value={formData.facility_country || "Vietnam"}
                    onChange={(e) => setFormData({ ...formData, facility_country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* FDA Registration Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">1. Đăng ký cơ sở với FDA</h3>
              <p className="text-sm text-muted-foreground">
                Đăng ký FDA có thời hạn 2 năm và tự động gia hạn đến cuối năm chẵn tiếp theo
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số đăng ký FDA</Label>
                  <Input
                    value={formData.fda_registration_number || ""}
                    onChange={(e) => setFormData({ ...formData, fda_registration_number: e.target.value })}
                    placeholder="VD: FDA-VNT-REG-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select
                    value={formData.registration_status}
                    onValueChange={(value) => setFormData({ ...formData, registration_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Đang chờ</SelectItem>
                      <SelectItem value="active">Đang hoạt động</SelectItem>
                      <SelectItem value="expired">Hết hạn</SelectItem>
                      <SelectItem value="cancelled">Đã hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày đăng ký FDA *</Label>
                  <Input
                    type="date"
                    value={formData.registration_date || ""}
                    onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Nhập năm đăng ký. VD: 2025 → Hết hạn 31/12/2026</p>
                </div>
                <div className="space-y-2">
                  <Label>Ngày hết hạn FDA</Label>
                  <Input type="date" value={formData.expiry_date || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Tự động tính đến cuối năm chẵn tiếp theo (thời hạn 2 năm)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>FEI Number</Label>
                  <Input
                    value={formData.fei_number || ""}
                    onChange={(e) => setFormData({ ...formData, fei_number: e.target.value })}
                    placeholder="10-digit FEI number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DUNS Number</Label>
                  <Input
                    value={formData.duns_number || ""}
                    onChange={(e) => setFormData({ ...formData, duns_number: e.target.value })}
                    placeholder="9-digit DUNS number"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* US Agent Assignment */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">2. Gán US Agent (Tùy chọn)</h3>
              <p className="text-sm text-muted-foreground">
                Chọn US Agent và số năm hợp đồng. US Agent có thể được gán sau.
              </p>

              <div className="space-y-2">
                <Label>US Agent</Label>
                <Select
                  value={formData.us_agent_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, us_agent_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn US Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không chọn (gán sau)</SelectItem>
                    {usAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agent_name} ({agent.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  US Agent là bắt buộc cho FDA registration. Có thể gán bây giờ hoặc sau.
                </p>
              </div>

              {formData.us_agent_id && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Số năm hợp đồng Agent</Label>
                    <Select
                      value={String(formData.registration_years || 2)}
                      onValueChange={(value) =>
                        setFormData({ ...formData, registration_years: Number.parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 năm</SelectItem>
                        <SelectItem value="2">2 năm</SelectItem>
                        <SelectItem value="3">3 năm</SelectItem>
                        <SelectItem value="5">5 năm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ngày hết hạn Agent</Label>
                    <Input
                      type="date"
                      value={
                        formData.registration_date && formData.registration_years
                          ? calculateAgentExpiryDate(formData.registration_date, formData.registration_years)
                          : ""
                      }
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">3. Thông tin liên hệ</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên liên hệ *</Label>
                  <Input
                    value={formData.contact_name || ""}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Họ tên người liên hệ"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.contact_email || ""}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Số điện thoại *</Label>
                  <Input
                    value={formData.contact_phone || ""}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+84 xxx xxx xxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ghi chú</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú bổ sung (tùy chọn)"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSaving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={isSaving || companies.length === 0}>
              {isSaving ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
