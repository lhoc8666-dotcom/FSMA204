"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const urlError = searchParams.get("error")
    if (urlError === "rls_recursion") {
      setError(
        "Hệ thống cơ sở dữ liệu cần được cấu hình lại. Vui lòng liên hệ quản trị viên để khắc phục vấn đề RLS policies.",
      )
      toast({
        variant: "destructive",
        title: "⚠️ Lỗi cấu hình RLS",
        description: "Cần chạy script 016_ultimate_rls_fix.sql để khắc phục.",
        duration: 10000,
      })
    } else if (urlError === "profile_creation_failed") {
      setError("Không thể tạo hồ sơ người dùng. Vui lòng liên hệ quản trị viên.")
      toast({
        variant: "destructive",
        title: "⚠️ Lỗi tạo hồ sơ",
        description: "Hệ thống không thể tạo hồ sơ người dùng. Vui lòng liên hệ quản trị viên.",
      })
    } else if (urlError === "profile_missing") {
      setError("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.")
      toast({
        variant: "destructive",
        title: "⚠️ Lỗi hồ sơ người dùng",
        description: "Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.",
      })
    } else if (urlError === "database_config_error") {
      setError("Lỗi cấu hình cơ sở dữ liệu. Vui lòng liên hệ quản trị viên.")
      toast({
        variant: "destructive",
        title: "⚠️ Lỗi cấu hình hệ thống",
        description: "Cơ sở dữ liệu cần được cấu hình lại. Vui lòng liên hệ quản trị viên.",
      })
    }
  }, [searchParams, toast])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      toast({
        title: "✅ Đăng nhập thành công!",
        description: `Chào mừng bạn trở lại, ${email}`,
      })

      router.push("/dashboard")
      router.refresh()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Đã xảy ra lỗi"
      setError(errorMessage)

      toast({
        variant: "destructive",
        title: "❌ Đăng nhập thất bại",
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="w-full max-w-sm">
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Đăng nhập</CardTitle>
            <CardDescription className="text-center">Hệ thống truy xuất nguồn gốc thực phẩm</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Chưa có tài khoản?{" "}
                <Link href="/auth/sign-up" className="underline underline-offset-4 text-blue-600 hover:text-blue-700">
                  Đăng ký
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        <Alert className="mt-4 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-900">
            Nếu bạn gặp vấn đề đăng nhập, vui lòng liên hệ quản trị viên hệ thống.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
