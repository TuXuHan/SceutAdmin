"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Database, CheckCircle, XCircle, AlertCircle } from "lucide-react"

export default function TestDatabasePage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const testConnection = async () => {
    setLoading(true)
    setResults(null)

    try {
      // 測試訂閱者 API
      const subscribersResponse = await fetch('/api/subscribers')
      const subscribersData = await subscribersResponse.json()

      // 測試用戶 API
      const usersResponse = await fetch('/api/users')
      const usersData = await usersResponse.json()

      setResults({
        subscribers: {
          success: subscribersResponse.ok,
          status: subscribersResponse.status,
          data: subscribersData
        },
        users: {
          success: usersResponse.ok,
          status: usersResponse.status,
          data: usersData
        }
      })
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : "測試失敗"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-6 h-6" />
              <div>
                <CardTitle>資料庫連接測試</CardTitle>
                <CardDescription>檢查 Supabase 連接和環境變量設置</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">測試步驟：</div>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>點擊下方的「開始測試」按鈕</li>
                  <li>查看測試結果和詳細信息</li>
                  <li>如果失敗，請檢查終端日誌獲取更多信息</li>
                  <li>確保已設置 SUPABASE_SERVICE_ROLE_KEY 環境變量</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Button 
              onClick={testConnection} 
              disabled={loading}
              className="w-full bg-[#A69E8B] hover:bg-[#8A7B6C]"
            >
              {loading ? "測試中..." : "開始測試"}
            </Button>

            {results && (
              <div className="space-y-4">
                {results.error ? (
                  <Alert className="border-red-200 bg-red-50">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <div className="font-medium mb-2">測試失敗</div>
                      <pre className="text-xs overflow-auto">{results.error}</pre>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* 訂閱者測試結果 */}
                    <Card className={results.subscribers.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          {results.subscribers.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <CardTitle className="text-base">
                            訂閱者 API 測試 - 狀態: {results.subscribers.status}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="font-medium">結果: </span>
                            {results.subscribers.success ? (
                              <span className="text-green-700">
                                ✅ 成功 - 找到 {results.subscribers.data.count || 0} 個訂閱者
                              </span>
                            ) : (
                              <span className="text-red-700">
                                ❌ 失敗 - {results.subscribers.data.error || "未知錯誤"}
                              </span>
                            )}
                          </div>
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium">查看詳細信息</summary>
                            <pre className="mt-2 p-2 bg-white rounded overflow-auto max-h-60">
                              {JSON.stringify(results.subscribers.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 用戶測試結果 */}
                    <Card className={results.users.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          {results.users.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          <CardTitle className="text-base">
                            用戶 API 測試 - 狀態: {results.users.status}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="font-medium">結果: </span>
                            {results.users.success ? (
                              <span className="text-green-700">
                                ✅ 成功 - 找到用戶資料
                              </span>
                            ) : (
                              <span className="text-red-700">
                                ❌ 失敗 - {results.users.data.error || "未知錯誤"}
                              </span>
                            )}
                          </div>
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium">查看詳細信息</summary>
                            <pre className="mt-2 p-2 bg-white rounded overflow-auto max-h-60">
                              {JSON.stringify(results.users.data, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="font-medium mb-2">提示：</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>如果訂閱者數量為 0 但沒有錯誤，可能是使用了 ANON_KEY（需要 SERVICE_ROLE_KEY）</li>
                  <li>檢查終端日誌查看 "🔑 使用的 Key 类型" 確認使用的是哪種 Key</li>
                  <li>確保 .env.local 文件存在並包含正確的 SUPABASE_SERVICE_ROLE_KEY</li>
                  <li>修改環境變量後需要重啟開發服務器</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

