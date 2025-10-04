"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  User, 
  X, 
  RefreshCw, 
  Database, 
  Mail, 
  Phone, 
  Calendar,
  ChevronLeft,
  AlertCircle
} from "lucide-react"

interface SubscribersDialogProps {
  open: boolean
  onClose: () => void
}

export function SubscribersDialog({ open, onClose }: SubscribersDialogProps) {
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubscribers = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscribers')
      
      if (response.ok) {
        const data = await response.json()
        if (data.subscribers && Array.isArray(data.subscribers)) {
          setSubscribers(data.subscribers)
        } else {
          setSubscribers([])
        }
      } else {
        const errorText = await response.text()
        console.error("載入訂閱者失敗:", response.status, errorText)
        setError(`查詢失敗: ${response.status} ${response.statusText}`)
        setSubscribers([])
      }
    } catch (err) {
      console.error("載入訂閱者錯誤:", err)
      const errorMessage = err instanceof Error ? err.message : "載入訂閱者資料失敗"
      setError(errorMessage)
      setSubscribers([])
    } finally {
      setLoading(false)
    }
  }

  const syncSubscribers = async () => {
    try {
      setSyncLoading(true)
      setError(null)

      const response = await fetch('/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'sync' })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`同步完成！\n更新: ${data.stats.synced} 筆\n新增: ${data.stats.created} 筆\n${data.stats.errors > 0 ? `錯誤: ${data.stats.errors} 筆` : ''}`)
        await loadSubscribers()
      } else {
        const errorData = await response.json()
        console.error("同步失敗:", response.status, errorData)
        setError(`同步失敗: ${errorData.error || response.statusText}`)
      }
    } catch (err) {
      console.error("同步錯誤:", err)
      const errorMessage = err instanceof Error ? err.message : "同步訂閱者資料失敗"
      setError(errorMessage)
    } finally {
      setSyncLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadSubscribers()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F2ED]">
      {/* 頂部導航欄 */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">返回</span>
            </Button>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-medium text-gray-800">訂閱者管理</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadSubscribers()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">重新整理</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => syncSubscribers()}
              disabled={syncLoading}
              className="flex items-center gap-2 bg-[#A69E8B] hover:bg-[#8A7B6C]"
            >
              <Database className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncLoading ? '同步中...' : '同步資料'}</span>
              <span className="sm:hidden">同步</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 主要內容 */}
      <div className="overflow-y-auto h-[calc(100vh-57px)]">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-gray-800">{subscribers.length}</div>
                <p className="text-sm text-gray-600">總訂閱者</p>
              </CardContent>
            </Card>
            <Card className="border-green-300 bg-green-50">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-green-700">
                  {subscribers.filter(s => s.subscription_status === 'active').length}
                </div>
                <p className="text-sm text-green-600">已訂閱</p>
              </CardContent>
            </Card>
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-red-700">
                  {subscribers.filter(s => s.subscription_status === 'terminated').length}
                </div>
                <p className="text-sm text-red-600">已終止</p>
              </CardContent>
            </Card>
          </div>

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-red-800 underline ml-2" 
                  onClick={() => loadSubscribers()}
                >
                  重新載入
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 訂閱者列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                訂閱者列表 ({subscribers.length})
              </CardTitle>
              <CardDescription>所有訂閱者的詳細資訊</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-gray-600">載入中...</p>
                </div>
              ) : subscribers.length === 0 ? (
                <div className="text-center py-12">
                  <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">目前沒有任何訂閱者</p>
                  <p className="text-sm text-gray-500">點擊上方的「同步資料」按鈕同步用戶資料</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscribers.map((subscriber: any) => (
                    <div key={subscriber.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <h3 className="font-medium text-gray-800 text-base">
                            {subscriber.name || subscriber.email}
                          </h3>
                          <div className="flex gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              subscriber.subscription_status === 'active' 
                                ? 'bg-green-100 text-green-800 border-green-300'
                                : subscriber.subscription_status === 'terminated'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-gray-100 text-gray-800 border-gray-300'
                            }`}>
                            {subscriber.subscription_status === 'active' ? '✓ 已訂閱' : 
                             subscriber.subscription_status === 'terminated' ? '✗ 已終止' : 
                             '⏳ 待訂閱'}
                            </span>
                            {subscriber.payment_status && subscriber.payment_status !== 'active' && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                subscriber.payment_status === 'paid' 
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : subscriber.payment_status === 'terminated'
                                  ? 'bg-red-100 text-red-800 border-red-300'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              }`}>
                                {subscriber.payment_status === 'paid' ? '💳 已付款' : 
                                 subscriber.payment_status === 'terminated' ? '⛔ 付款已停止' : 
                                 subscriber.payment_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {subscriber.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600 truncate">{subscriber.email}</span>
                          </div>
                        )}
                        {subscriber.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600 truncate">{subscriber.phone}</span>
                          </div>
                        )}
                        {subscriber.created_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-600 text-sm">
                              註冊: {new Date(subscriber.created_at).toLocaleDateString("zh-TW")}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* 額外資訊 */}
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {subscriber.monthly_fee && (
                          <div className="text-gray-600">
                            <span className="font-medium">月費: </span>
                            <span className="text-gray-800">NT$ {subscriber.monthly_fee}</span>
                          </div>
                        )}
                        {subscriber.payment_method && (
                          <div className="text-gray-600">
                            <span className="font-medium">付款方式: </span>
                            <span className="text-gray-800">
                              {subscriber.payment_method === 'CREDIT' ? '信用卡定期定額' : 
                               subscriber.payment_method === 'credit_card' ? '信用卡' : 
                               subscriber.payment_method}
                            </span>
                          </div>
                        )}
                        {subscriber.last_payment_date && (
                          <div className="text-gray-600">
                            <span className="font-medium">最後付款: </span>
                            <span className="text-gray-800">{new Date(subscriber.last_payment_date).toLocaleDateString("zh-TW")}</span>
                          </div>
                        )}
                        {subscriber.next_payment_date && (
                          <div className="text-gray-600">
                            <span className="font-medium">下次付款: </span>
                            <span className="text-gray-800">{new Date(subscriber.next_payment_date).toLocaleDateString("zh-TW")}</span>
                          </div>
                        )}
                      </div>
                      
                      {subscriber.quiz_answers && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">測驗資料: </span>
                            <span className="text-gray-500">
                              {typeof subscriber.quiz_answers === 'string' 
                                ? Object.keys(JSON.parse(subscriber.quiz_answers)).length 
                                : Object.keys(subscriber.quiz_answers).length} 個問題已回答
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {subscriber.updated_at && (
                        <div className="mt-2 text-xs text-gray-500">
                          最後更新: {new Date(subscriber.updated_at).toLocaleString("zh-TW")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
