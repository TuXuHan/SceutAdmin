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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  EyeOff
} from "lucide-react"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"

interface SubscribersDialogProps {
  open: boolean
  onClose: () => void
}

export function SubscribersDialog({ open, onClose }: SubscribersDialogProps) {
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [syncLoading, setSyncLoading] = useState(false)
  const [recalculateLoading, setRecalculateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSubscriber, setExpandedSubscriber] = useState<string | null>(null)
  const [generatingRecommendations, setGeneratingRecommendations] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<{[key: string]: any}>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // 使用與 UserHome 相同的防抖機制
  const { loading, startLoading, stopLoading, shouldSkipLoad, resetLoadingState } = useDebouncedLoading({
    debounceMs: 60000, // 60 秒防抖
    maxRetries: 1
  })

  const loadSubscribers = async (forceReload = false) => {
    // 使用智能防抖機制
    if (shouldSkipLoad(forceReload)) {
      stopLoading()
      return
    }

    try {
      startLoading()
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
      stopLoading()
    }
  }

  const recalculatePaymentSchedule = async () => {
    try {
      setRecalculateLoading(true)
      setError(null)
      setSuccessMessage(null)

      const response = await fetch('/api/recalculate-payments', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuccessMessage(
            `✅ 扣款排程重新計算完成！更新了 ${data.results.updated} 筆訂閱記錄` +
            (data.results.completed > 0 ? `，${data.results.completed} 筆已完成` : '')
          )
          // 重新載入訂閱者資料
          await loadSubscribers(true)
        } else {
          setError(data.error || '重新計算失敗')
        }
      } else {
        setError('重新計算扣款排程失敗')
      }
    } catch (err) {
      console.error('重新計算扣款排程錯誤:', err)
      setError(err instanceof Error ? err.message : '重新計算扣款排程失敗')
    } finally {
      setRecalculateLoading(false)
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

  const toggleExpanded = (subscriberId: string) => {
    setExpandedSubscriber(expandedSubscriber === subscriberId ? null : subscriberId)
  }

  const generateRecommendations = async (subscriber: any) => {
    try {
      setGeneratingRecommendations(subscriber.id)
      
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: subscriber.user_id || subscriber.id,
          quizAnswers: subscriber.quiz_answers
        })
      })

      if (response.ok) {
        const data = await response.json()
        setRecommendations(prev => ({
          ...prev,
          [subscriber.id]: data.recommendations
        }))
        // 設置成功消息，3秒後自動消失
        setSuccessMessage('推薦生成成功！結果已顯示在下方')
        setTimeout(() => setSuccessMessage(null), 3000)
        console.log('[v0] 推薦生成成功！', data.recommendations)
        console.log('[v0] 使用的 Sheet ID (部分):', data.debug?.sheetId || '未提供')
      } else {
        const errorData = await response.json()
        console.error('生成推薦失敗:', errorData.error)
        // 可以在這裡設置錯誤狀態來顯示錯誤訊息
        setRecommendations(prev => ({
          ...prev,
          [subscriber.id]: { error: errorData.error || '生成推薦失敗' }
        }))
      }
    } catch (err) {
      console.error("生成推薦錯誤:", err)
      // 設置錯誤狀態
      setRecommendations(prev => ({
        ...prev,
        [subscriber.id]: { error: '生成推薦時發生錯誤，請稍後再試' }
      }))
    } finally {
      setGeneratingRecommendations(null)
    }
  }

  const formatQuizAnswers = (quizAnswers: any) => {
    if (!quizAnswers) return null
    
    try {
      const answers = typeof quizAnswers === 'string' ? JSON.parse(quizAnswers) : quizAnswers
      return answers
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (!open) return
    resetLoadingState()
    loadSubscribers()
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
              onClick={() => recalculatePaymentSchedule()}
              disabled={recalculateLoading}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <Calendar className={`w-4 h-4 ${recalculateLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{recalculateLoading ? '計算中...' : '重新計算扣款'}</span>
              <span className="sm:hidden">計算</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadSubscribers(true)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="border-gray-200">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-gray-800">{subscribers.length}</div>
                <p className="text-sm text-gray-600">總訂閱者</p>
              </CardContent>
            </Card>
            <Card className="border-green-300 bg-green-50">
              <CardContent className="p-4">
                <div className="text-3xl font-bold text-green-700">
                  {subscribers.filter(s => s.subscription_status?.toLowerCase() === 'active').length}
                </div>
                <p className="text-sm text-green-600">已訂閱</p>
              </CardContent>
            </Card>
          </div>

          {successMessage && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

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
                        <div 
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 cursor-pointer flex-1"
                          onClick={() => toggleExpanded(subscriber.id)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedSubscriber === subscriber.id ? 
                              <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            }
                            <h3 className="font-medium text-gray-800 text-base">
                              {subscriber.name || subscriber.email}
                            </h3>
                          </div>
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

                      {/* 展開的詳細資訊 */}
                      {expandedSubscriber === subscriber.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                          {/* 操作按鈕區域 */}
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => generateRecommendations(subscriber)}
                              disabled={generatingRecommendations === subscriber.id}
                              className="flex items-center gap-2 bg-[#A69E8B] hover:bg-[#8A7B6C]"
                            >
                              <Sparkles className={`w-4 h-4 ${generatingRecommendations === subscriber.id ? 'animate-spin' : ''}`} />
                              {generatingRecommendations === subscriber.id ? '生成中...' : '生成個人化推薦'}
                            </Button>
                            
                            {/* 成功消息顯示 */}
                            {successMessage && (
                              <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-md border border-green-200 animate-pulse">
                                {successMessage}
                              </div>
                            )}
                          </div>

                          {/* 測驗答案詳細資訊 */}
                          {subscriber.quiz_answers && (
                            <div>
                              <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                測驗答案詳細資訊
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  {(() => {
                                    const answers = formatQuizAnswers(subscriber.quiz_answers)
                                    if (!answers) return <p className="text-gray-500">無法解析測驗答案</p>
                                    
                                    return Object.entries(answers).map(([question, answer]: [string, any]) => (
                                      <div key={question} className="space-y-1">
                                        <div className="font-medium text-gray-700">{question}:</div>
                                        <div className="text-gray-600 pl-2">
                                          {Array.isArray(answer) ? answer.join(', ') : String(answer)}
                                        </div>
                                      </div>
                                    ))
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 推薦結果 */}
                          {recommendations[subscriber.id] && (
                            <div>
                              <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                                個人化推薦結果
                              </h4>
                              
                              {/* 錯誤狀態顯示 */}
                              {recommendations[subscriber.id].error ? (
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                                  <div className="text-red-600 font-medium mb-2">
                                    ❌ 推薦生成失敗
                                  </div>
                                  <div className="text-red-500 text-sm">
                                    {recommendations[subscriber.id].error}
                                  </div>
                                  <button 
                                    onClick={() => generateRecommendations(subscriber)}
                                    className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                                    disabled={generatingRecommendations === subscriber.id}
                                  >
                                    {generatingRecommendations === subscriber.id ? '重新生成中...' : '重新生成推薦'}
                                  </button>
                                </div>
                              ) : (
                              <>
                              {/* 正常推薦結果顯示 */}
                              <div className="grid gap-4">
                                {Object.entries(recommendations[subscriber.id]).map(([type, rec]: [string, any]) => {
                                  const typeConfig = {
                                    primary: { 
                                      title: '🥇 主要推薦', 
                                      bgColor: 'bg-gradient-to-br from-amber-50 to-yellow-50', 
                                      borderColor: 'border-amber-200',
                                      textColor: 'text-amber-900',
                                      badgeColor: 'bg-amber-100 text-amber-800'
                                    },
                                    secondary: { 
                                      title: '🥈 次要推薦', 
                                      bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50', 
                                      borderColor: 'border-blue-200',
                                      textColor: 'text-blue-900',
                                      badgeColor: 'bg-blue-100 text-blue-800'
                                    },
                                    alternative: { 
                                      title: '🥉 替代推薦', 
                                      bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50', 
                                      borderColor: 'border-purple-200',
                                      textColor: 'text-purple-900',
                                      badgeColor: 'bg-purple-100 text-purple-800'
                                    }
                                  }
                                  
                                  const config = typeConfig[type as keyof typeof typeConfig]
                                  
                                  return (
                                    <div key={type} className={`${config.bgColor} rounded-xl p-5 border-2 ${config.borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                                      {/* 標題區域 */}
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className={`font-semibold text-lg ${config.textColor}`}>
                                          {config.title}
                                        </h5>
                                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.badgeColor}`}>
                                          {rec.confidence}% 匹配度
                                        </span>
                                      </div>
                                      
                                      {/* 香水資訊 */}
                                      <div className="space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                          <div className={`font-bold text-xl ${config.textColor} flex-1`}>
                                            {rec.name}
                                          </div>
                                          {rec.number && (
                                            <div className="text-sm font-medium text-gray-600 bg-white px-2 py-1 rounded-md border flex-shrink-0">
                                              No.{rec.number}
                                            </div>
                                          )}
                                          <div className="text-sm text-gray-600 bg-white px-2 py-1 rounded-md border flex-shrink-0">
                                            {rec.brand}
                                          </div>
                                        </div>
                                        
                                        <div className={`text-sm leading-relaxed ${config.textColor.replace('900', '700')}`}>
                                          {rec.description}
                                        </div>
                                        
                                        {/* 推薦理由 */}
                                        <div className="mt-4">
                                          <div className={`font-medium text-sm mb-2 ${config.textColor}`}>
                                            💡 推薦理由：
                                          </div>
                                          <div className="grid gap-2">
                                            {rec.reasons.map((reason: string, index: number) => (
                                              <div key={index} className="flex items-start gap-2">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.badgeColor} flex-shrink-0 mt-0.5`}>
                                                  {index + 1}
                                                </span>
                                                <span className={`text-sm ${config.textColor.replace('900', '700')}`}>
                                                  {reason}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                              
                              {/* 生成時間 */}
                              <div className="mt-4 text-xs text-gray-500 text-center">
                                ✨ 推薦生成時間：{new Date().toLocaleString('zh-TW')}
                              </div>
                              </>
                              )}
                            </div>
                          )}
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
