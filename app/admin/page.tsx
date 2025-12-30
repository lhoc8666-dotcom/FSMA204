"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Shield,
  Activity,
  RefreshCw,
  Building2,
  PackageIcon,
  Warehouse,
  Tags,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  BarChart3,
  Eye,
  EyeOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useLanguage } from "@/contexts/language-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { WasteDashboardWidget } from "@/components/waste-dashboard-widget"
import { ExpirationMonitorWidget } from "@/components/expiration-monitor-widget"
import { InventoryStockWidgetEnhanced } from "@/components/inventory-stock-widget-enhanced"
import { AuditTrailViewer } from "@/components/audit-trail-viewer"
import { AdminDashboardSecurityCard } from "@/components/admin-dashboard-security-card"
import { AdminDashboardActivityCard } from "@/components/admin-dashboard-activity-card"
import { AdminDashboardComplianceCard } from "@/components/admin-dashboard-compliance-card"
import { AdminDashboardQuickActions } from "@/components/admin-dashboard-quick-actions"

interface AdminStats {
  totalUsers: number
  totalFacilities: number
  totalProducts: number
  totalSystemLogs: number
  adminCount: number
  totalCompanies?: number
  totalPackages?: number
  recentUsers?: any[]
}

interface UserProfile {
  id: string
  full_name: string
  role: string
  created_at: string
}

interface ProfileData {
  role: string
  company_id: string | null
  companies: {
    name: string
  } | null
}

interface FacilityDashboardStats {
  // Core metrics
  totalFacilities: number
  totalProducts: number
  totalTLCs: number
  totalCTEs: number

  // FSMA 204 Compliance metrics
  activeTLCs: number
  expiredTLCs: number
  tlcsWithCompleteCTEs: number
  tlcsWithMissingKDEs: number
  complianceScore: number

  // FDA Registration metrics
  fdaRegisteredFacilities: number
  fdaRegistrationsExpiring: number
  usAgentsActive: number
  usAgentsExpiring: number

  // Operational metrics
  operatorsCount: number
  managersCount: number
  recentAlertsCount: number
  storageUsagePercent: number
  currentStorageGB: number
  maxStorageGB: number
}

interface RecentActivity {
  id: string
  type: "tlc" | "cte" | "alert" | "fda"
  title: string
  description: string
  timestamp: string
  status: "success" | "warning" | "error"
  icon: any
}

export default function AdminDashboard() {
  const { locale, t } = useLanguage()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<FacilityDashboardStats>({
    totalFacilities: 0,
    totalProducts: 0,
    totalTLCs: 0,
    totalCTEs: 0,
    activeTLCs: 0,
    expiredTLCs: 0,
    tlcsWithCompleteCTEs: 0,
    tlcsWithMissingKDEs: 0,
    complianceScore: 0,
    fdaRegisteredFacilities: 0,
    fdaRegistrationsExpiring: 0,
    usAgentsActive: 0,
    usAgentsExpiring: 0,
    operatorsCount: 0,
    managersCount: 0,
    recentAlertsCount: 0,
    storageUsagePercent: 0,
    currentStorageGB: 0,
    maxStorageGB: 0,
  })
  const [enhancedStats, setEnhancedStats] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)

    try {
      const supabase = createClient()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error("[v0] Auth error:", authError)
        router.push("/auth/login")
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, company_id, companies(name)")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("[v0] Profile fetch error:", profileError)
        setIsLoading(false)
        return
      }

      if (profileData) {
        setProfile(profileData)

        const isSystemAdminUser = profileData.role === "system_admin"

        if (isSystemAdminUser) {
          const [statsResponse, enhancedResponse] = await Promise.all([
            fetch("/api/admin/stats"),
            fetch("/api/admin/dashboard-stats"),
          ])

          if (statsResponse.ok && enhancedResponse.ok) {
            const adminStats = await statsResponse.json()
            const enhanced = await enhancedResponse.json()

            setStats({
              totalUsers: adminStats.totalUsers || 0,
              totalCompanies: adminStats.totalCompanies || 0,
              totalFacilities: adminStats.totalFacilities || 0,
              totalProducts: adminStats.totalProducts || 0,
              totalTLCs: adminStats.totalTLCs || 0,
              totalCTEs: 0,
              activeTLCs: 0,
              expiredTLCs: 0,
              tlcsWithCompleteCTEs: 0,
              tlcsWithMissingKDEs: 0,
              complianceScore: 85,
              fdaRegisteredFacilities: 0,
              fdaRegistrationsExpiring: 0,
              usAgentsActive: 0,
              usAgentsExpiring: 0,
              operatorsCount: 0,
              managersCount: 0,
              recentAlertsCount: 0,
              storageUsagePercent: 0,
              currentStorageGB: 0,
              maxStorageGB: 0,
              recentUsers: adminStats.recentUsers || [], // Added recentUsers
            })

            setEnhancedStats(enhanced)
          }
        } else {
          const companyId = profileData.company_id

          if (!companyId) {
            console.error("[v0] No company_id found for user")
            setIsLoading(false)
            return
          }

          const [metricsResponse, alertsResponse] = await Promise.all([
            fetch("/api/dashboard/metrics"),
            fetch("/api/dashboard/compliance-alerts"),
          ])

          if (!metricsResponse.ok || !alertsResponse.ok) {
            console.error("[v0] Error fetching dashboard data")
            setIsLoading(false)
            return
          }

          const metrics = await metricsResponse.json()
          const complianceAlerts = await alertsResponse.json()

          setStats({
            totalFacilities: metrics.total_facilities || 0,
            totalProducts: metrics.total_products || 0,
            totalTLCs: metrics.total_tlcs || 0,
            totalCTEs: metrics.total_ctes || 0,
            activeTLCs: metrics.active_tlcs || 0,
            expiredTLCs: metrics.expired_tlcs || 0,
            tlcsWithCompleteCTEs: 0,
            tlcsWithMissingKDEs: complianceAlerts?.missing_kde_count || 0,
            complianceScore: 0,
            fdaRegisteredFacilities: metrics.fda_registered_facilities || 0,
            fdaRegistrationsExpiring: metrics.fda_registrations_expiring_soon || 0,
            usAgentsActive: metrics.active_us_agents || 0,
            usAgentsExpiring: metrics.us_agents_expiring_soon || 0,
            operatorsCount: metrics.operators_count || 0,
            managersCount: metrics.managers_count || 0,
            recentAlertsCount: complianceAlerts?.total_alerts || 0,
            storageUsagePercent: metrics.storage_usage_percent || 0,
            currentStorageGB: metrics.current_storage_gb || 0,
            maxStorageGB: metrics.max_storage_gb || 0,
          })

          const { data: recentLogs, error: logsError } = await supabase
            .from("activity_logs")
            .select(`
              *,
              profiles:user_id(company_id, full_name)
            `)
            .eq("profiles.company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(5)

          if (logsError) {
            console.error("[v0] Activity logs fetch error:", logsError)
          }

          setRecentActivity(
            (recentLogs || []).map((log) => ({
              id: log.id,
              type: log.resource_type === "traceability_lots" ? "tlc" : "cte",
              title: log.action,
              description: `${log.resource_type || "Unknown"} - ${log.action}`,
              timestamp: log.created_at,
              status: log.action.includes("DELETE") ? "error" : "success",
              icon: log.resource_type === "traceability_lots" ? Tags : FileText,
            })),
          )
        }
      }
    } catch (error) {
      console.error("[v0] Error loading dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      system_admin: "bg-purple-100 text-purple-700 border-purple-300",
      admin: "bg-red-100 text-red-700",
      manager: "bg-blue-100 text-blue-700",
      operator: "bg-green-100 text-green-700",
      viewer: "bg-gray-100 text-gray-700",
    }
    return colors[role] || colors.viewer
  }

  const getComplianceColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getComplianceMessage = (score: number) => {
    if (score >= 90) return "Tốt - Tuân thủ đầy đủ"
    if (score >= 70) return "Trung bình - Cần cải thiện"
    return "Thấp - Cần hành động khẩn"
  }

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  const isSystemAdmin = profile?.role === "system_admin"

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{t("admin.overview.title")}</h1>
            {isSystemAdmin ? (
              <Badge className="bg-purple-600 text-white text-xs">{t("admin.overview.systemBadge")}</Badge>
            ) : (
              <Badge className="bg-red-600 text-white text-xs">{t("admin.overview.companyBadge")}</Badge>
            )}
          </div>
          {profile?.companies && !isSystemAdmin && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{(profile.companies as any).name}</span>
            </div>
          )}
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("common.actions.refresh")}
        </Button>
      </div>

      {isSystemAdmin && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 px-4 py-2.5 rounded-lg flex items-start gap-3">
          <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="font-semibold text-sm">System Admin Mode</p>
            <p className="text-xs">Đăng nhập với Company Admin để xem data nghiệp vụ chi tiết.</p>
          </div>
        </div>
      )}

      {isSystemAdmin && enhancedStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AdminDashboardSecurityCard stats={enhancedStats.security} />
          <AdminDashboardActivityCard stats={enhancedStats.activity} />
          <AdminDashboardComplianceCard stats={enhancedStats.compliance} />
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Đang hoạt động:</span>
                <span className="font-semibold">{enhancedStats?.subscriptions?.active || 0}</span>
              </div>
              {enhancedStats?.subscriptions?.expiringSoon > 0 && (
                <div className="flex items-center justify-between p-2 bg-orange-50 rounded-md">
                  <span className="text-xs font-medium text-orange-700">Sắp hết hạn</span>
                  <Badge className="bg-orange-100 text-orange-700">{enhancedStats.subscriptions.expiringSoon}</Badge>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 bg-transparent"
                onClick={() => router.push("/admin/subscriptions")}
              >
                Quản lý gói dịch vụ
              </Button>
            </CardContent>
          </Card>

          <AdminDashboardQuickActions isSystemAdmin={isSystemAdmin} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Sự kiện quan trọng
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {enhancedStats?.criticalEvents?.slice(0, 3).map((event: any) => (
                  <div key={event.id} className="text-xs border-l-2 border-red-500 pl-2 py-1">
                    <p className="font-medium">{event.action}</p>
                    <p className="text-muted-foreground text-[10px]">{event.description}</p>
                  </div>
                ))}
                {(!enhancedStats?.criticalEvents || enhancedStats.criticalEvents.length === 0) && (
                  <p className="text-xs text-muted-foreground">Không có sự kiện quan trọng</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 justify-between"
                onClick={() => router.push("/admin/system-logs?severity=critical")}
              >
                Xem tất cả
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {!isSystemAdmin && stats && (
        <>
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">FSMA 204 Compliance</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${getComplianceColor(stats.complianceScore)}`}>
                      {stats.complianceScore}%
                    </p>
                    <p className="text-xs text-muted-foreground">{getComplianceMessage(stats.complianceScore)}</p>
                  </div>
                  {(stats.fdaRegistrationsExpiring > 0 || stats.recentAlertsCount > 0) && (
                    <div className="flex flex-col gap-1">
                      {stats.fdaRegistrationsExpiring > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" />
                          {stats.fdaRegistrationsExpiring} FDA hết hạn
                        </Badge>
                      )}
                      {stats.recentAlertsCount > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1 whitespace-nowrap">
                          <AlertTriangle className="h-3 w-3" />
                          {stats.recentAlertsCount} cảnh báo
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Progress value={stats.complianceScore} className="h-2" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500"
              onClick={() => router.push("/dashboard/facilities")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cơ sở</CardTitle>
                <Warehouse className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">{stats.totalFacilities}</div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <p className="text-xs text-muted-foreground">{stats.fdaRegisteredFacilities} FDA</p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-green-500"
              onClick={() => router.push("/dashboard/products")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sản phẩm FTL</CardTitle>
                <PackageIcon className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                <p className="text-xs text-muted-foreground mt-1">Sản phẩm truy xuất</p>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-purple-500"
              onClick={() => router.push("/dashboard/traceability")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Mã TLC</CardTitle>
                <Tags className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-bold">{stats.totalTLCs}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">{stats.activeTLCs} active</span>
                  {stats.expiredTLCs > 0 && (
                    <span className="text-xs text-red-600 font-medium">{stats.expiredTLCs} expired</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-orange-500"
              onClick={() => router.push("/dashboard/cte")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sự kiện CTE</CardTitle>
                <FileText className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCTEs}</div>
                <p className="text-xs text-muted-foreground mt-1">Critical Events</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="compliance" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="compliance" className="text-xs">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                FDA & Compliance
              </TabsTrigger>
              <TabsTrigger value="operations" className="text-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Operations
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Monitoring
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compliance" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      Đăng ký FDA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Đã đăng ký:</span>
                      <span className="font-semibold text-sm">
                        {stats.fdaRegisteredFacilities}/{stats.totalFacilities}
                      </span>
                    </div>
                    {stats.fdaRegistrationsExpiring > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-red-600">Sắp hết hạn:</span>
                        <Badge variant="destructive" className="text-xs">
                          {stats.fdaRegistrationsExpiring}
                        </Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs h-8 mt-2"
                      onClick={() => router.push("/admin/fda-registrations")}
                    >
                      Quản lý FDA
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-600" />
                      US Agent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Hoạt động:</span>
                      <span className="font-semibold text-sm">{stats.usAgentsActive}</span>
                    </div>
                    {stats.usAgentsExpiring > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-red-600">Sắp hết hạn:</span>
                        <Badge variant="destructive" className="text-xs">
                          {stats.usAgentsExpiring}
                        </Badge>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs h-8 mt-2"
                      onClick={() => router.push("/admin/us-agents")}
                    >
                      Quản lý US Agent
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      Đội ngũ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Operators:</span>
                      <span className="font-semibold text-sm">{stats.operatorsCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Managers:</span>
                      <span className="font-semibold text-sm">{stats.managersCount}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs h-8 mt-2"
                      onClick={() => router.push("/admin/users")}
                    >
                      Quản lý Users
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      Dung lượng Lưu trữ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Đã sử dụng:</span>
                        <span className="font-semibold text-sm">
                          {stats.currentStorageGB.toFixed(2)} / {stats.maxStorageGB} GB
                        </span>
                      </div>
                      <Progress value={stats.storageUsagePercent} className="h-1.5" />
                      <p className="text-xs">
                        {stats.storageUsagePercent >= 90 ? (
                          <span className="text-red-600 font-medium">⚠️ Gần đầy dung lượng</span>
                        ) : stats.storageUsagePercent >= 75 ? (
                          <span className="text-yellow-600 font-medium">Đã dùng hơn 75%</span>
                        ) : (
                          <span className="text-green-600">Dung lượng thoải mái</span>
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      Cảnh báo Gần đây
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.recentAlertsCount === 0 ? (
                      <div className="text-center py-3">
                        <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1.5" />
                        <p className="text-xs text-muted-foreground">Không có cảnh báo</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-red-600">{stats.recentAlertsCount}</div>
                        <p className="text-xs text-muted-foreground">Cảnh báo cần xử lý</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between text-xs h-8"
                          onClick={() => router.push("/dashboard/alerts")}
                        >
                          Xem chi tiết
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {recentActivity.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      Hoạt động Gần đây
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recentActivity.slice(0, 3).map((activity) => {
                        const Icon = activity.icon
                        return (
                          <div
                            key={activity.id}
                            className="flex items-start gap-2 p-2 border rounded-md hover:bg-slate-50 transition-colors"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs truncate">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(activity.timestamp).toLocaleString(locale, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <Badge
                              variant={
                                activity.status === "success"
                                  ? "default"
                                  : activity.status === "warning"
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {activity.status}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between text-xs h-8 mt-3"
                      onClick={() => router.push("/admin/system-logs")}
                    >
                      Xem tất cả hoạt động
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Waste Tracking</CardTitle>
                    <CardDescription className="text-xs">Theo dõi hao hụt</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs bg-transparent"
                      onClick={() => router.push("/dashboard/waste-tracking")}
                    >
                      Xem báo cáo Waste
                      <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Expiration Monitor</CardTitle>
                    <CardDescription className="text-xs">Theo dõi hạn sử dụng</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs bg-transparent"
                      onClick={() => router.push("/dashboard/expiration")}
                    >
                      Xem sản phẩm hết hạn
                      <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Inventory Stock</CardTitle>
                  <CardDescription className="text-xs">Tình trạng tồn kho</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-transparent"
                    onClick={() => router.push("/dashboard/inventory")}
                  >
                    Xem chi tiết tồn kho
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Audit Trail</CardTitle>
                  <CardDescription className="text-xs">Lịch sử thay đổi</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs bg-transparent"
                    onClick={() => router.push("/admin/audit-logs")}
                  >
                    Xem audit trail
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {showAdvanced ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      Advanced Metrics & Analytics
                    </CardTitle>
                    <ChevronRight className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CardDescription className="text-xs mt-1">
                  Widgets nâng cao: Waste, Expiration, Inventory, Audit (click để {showAdvanced ? "ẩn" : "hiển thị"})
                </CardDescription>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <WasteDashboardWidget />
                    <ExpirationMonitorWidget />
                  </div>
                  <InventoryStockWidgetEnhanced />
                  <AuditTrailViewer />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {isSystemAdmin && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
              onClick={() => router.push("/admin/users")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Tất cả users</p>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500"
              onClick={() => router.push("/admin/companies")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Companies</CardTitle>
                <Building2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCompanies || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Công ty hoạt động</p>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-purple-500"
              onClick={() => router.push("/admin/service-packages")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">Facilities</CardTitle>
                <Warehouse className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFacilities || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Tổng số cơ sở</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Users</CardTitle>
              <CardDescription className="text-xs">Users mới đăng ký</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentUsers?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Chưa có users mới</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats?.recentUsers?.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <p className="font-medium text-sm">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <Badge className={`${getRoleBadge(user.role)} text-xs`}>{user.role}</Badge>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 justify-between text-xs h-8"
                onClick={() => router.push("/admin/users")}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                View all users
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
