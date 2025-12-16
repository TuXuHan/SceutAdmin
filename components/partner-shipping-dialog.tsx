"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  User, 
  X, 
  RefreshCw,
  Search,
  Mail, 
  Phone, 
  Calendar,
  ChevronLeft,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  EyeOff,
  Save,
  Truck,
  Package,
  UserPlus
} from "lucide-react"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"

interface PartnerShippingDialogProps {
  open: boolean
  onClose: () => void
}

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  delivery_method?: string
  quiz_answers?: any
  created_at?: string
  updated_at?: string
}

export function PartnerShippingDialog({ open, onClose }: PartnerShippingDialogProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<UserProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [generatingRecommendations, setGeneratingRecommendations] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<{[key: string]: any}>({})
  const [generatingOrder, setGeneratingOrder] = useState(false)
  const [addingToSubscribers, setAddingToSubscribers] = useState(false)
  const [partnerList, setPartnerList] = useState<UserProfile[]>([])
  const [loadingPartnerList, setLoadingPartnerList] = useState(false)
  const [showPartnerList, setShowPartnerList] = useState(true) // 預設顯示互惠對象名單
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null)
  const [generatingPartnerRecommendations, setGeneratingPartnerRecommendations] = useState<string | null>(null)
  const [partnerRecommendations, setPartnerRecommendations] = useState<{[key: string]: any}>({})
  
  // 編輯狀態
  const [editingPhone, setEditingPhone] = useState("")
  const [editingDeliveryMethod, setEditingDeliveryMethod] = useState("")
  const [editingQuizAnswers, setEditingQuizAnswers] = useState<any>({})

  const { loading: searchLoading, startLoading, stopLoading, shouldSkipLoad, resetLoadingState } = useDebouncedLoading({
    debounceMs: 300,
    maxRetries: 1
  })

  const searchUsers = async (forceReload = false) => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      return
    }

    if (shouldSkipLoad(forceReload)) {
      stopLoading()
      return
    }

    try {
      startLoading()
      setError(null)

      const response = await fetch(`/api/partner-shipping?search=${encodeURIComponent(searchTerm)}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.users && Array.isArray(data.users)) {
          setSearchResults(data.users)
        } else {
          setSearchResults([])
        }
      } else {
        const errorText = await response.text()
        console.error("搜尋用戶失敗:", response.status, errorText)
        setError(`搜尋失敗: ${response.status} ${response.statusText}`)
        setSearchResults([])
      }
    } catch (err) {
      console.error("搜尋用戶錯誤:", err)
      const errorMessage = err instanceof Error ? err.message : "搜尋用戶資料失敗"
      setError(errorMessage)
      setSearchResults([])
    } finally {
      stopLoading()
    }
  }

  const loadPartnerList = async () => {
    try {
      setLoadingPartnerList(true)
      // 加上 timestamp 避免快取
      const response = await fetch(`/api/partner-list?t=${Date.now()}`, {
        cache: 'no-store',
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('載入的互惠對象資料:', data)
        if (data.partners && Array.isArray(data.partners)) {
          setPartnerList(data.partners)
          console.log(`成功載入 ${data.partners.length} 個互惠對象`)
        } else {
          console.warn('API 返回的資料格式不正確:', data)
          setPartnerList([])
        }
      } else {
        const errorText = await response.text()
        console.error("載入互惠對象名單失敗:", response.status, errorText)
        setPartnerList([])
      }
    } catch (err) {
      console.error("載入互惠對象名單錯誤:", err)
      setPartnerList([])
    } finally {
      setLoadingPartnerList(false)
    }
  }

  useEffect(() => {
    if (!open) return
    resetLoadingState()
    setSearchTerm("")
    setSearchResults([])
    setSelectedUser(null)
    setError(null)
    setSuccessMessage(null)
    loadPartnerList() // 載入互惠對象名單
  }, [open])

  useEffect(() => {
    if (searchTerm.trim()) {
      const timeoutId = setTimeout(() => {
        searchUsers()
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setSearchResults([])
    }
  }, [searchTerm])

  const selectUser = (user: UserProfile) => {
    setSelectedUser(user)
    setEditingPhone(user.phone || "")
    setEditingDeliveryMethod(user.delivery_method || "")
    
    // 解析quiz_answers
    let quizAnswers = {}
    if (user.quiz_answers) {
      try {
        quizAnswers = typeof user.quiz_answers === 'string' 
          ? JSON.parse(user.quiz_answers) 
          : user.quiz_answers
      } catch {
        quizAnswers = {}
      }
    }
    setEditingQuizAnswers(quizAnswers)
    setExpandedUser(user.id)
  }

  const saveUserProfile = async () => {
    if (!selectedUser) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/partner-shipping', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          phone: editingPhone,
          delivery_method: editingDeliveryMethod,
          quiz_answers: editingQuizAnswers
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSuccessMessage('✅ 更新成功！')
        setTimeout(() => setSuccessMessage(null), 3000)
        
        // 更新選中的用戶資料
        setSelectedUser({
          ...selectedUser,
          phone: editingPhone,
          delivery_method: editingDeliveryMethod,
          quiz_answers: editingQuizAnswers
        })
        
        // 重新搜尋以更新列表
        if (searchTerm.trim()) {
          await searchUsers(true)
        }
      } else {
        const errorData = await response.json()
        setError(`更新失敗: ${errorData.error || response.statusText}`)
      }
    } catch (err) {
      console.error("更新用戶資料錯誤:", err)
      setError("更新用戶資料失敗，請稍後再試")
    } finally {
      setSaving(false)
    }
  }

  const generateOrder = async () => {
    if (!selectedUser) return

    try {
      setGeneratingOrder(true)
      setError(null)

      // 準備訂單資料
      const orderPayload = {
        subscriber_name: selectedUser.name,
        customer_email: selectedUser.email,
        customer_phone: editingPhone || selectedUser.phone || null,
        total_price: 599, // 預設月費
        currency: 'TWD',
        order_status: 'pending',
        user_id: selectedUser.id,
        perfume_name: null,
        delivery_method: editingDeliveryMethod || selectedUser.delivery_method || null,
        "711": selectedUser["711"] || null,
        shipping_address: selectedUser.address || null
      }

      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      })

      const orderResult = await orderResponse.json()

      if (orderResult.success) {
        // 訂單創建成功後，自動將用戶加入互惠對象名單
        try {
          const partnerResponse = await fetch('/api/partner-shipping', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'add-to-subscribers',
              userId: selectedUser.id
            })
          })

          const partnerResult = await partnerResponse.json()

          if (partnerResult.success) {
            setSuccessMessage('✅ 訂單生成成功並已加入互惠對象名單！')
            await loadPartnerList() // 重新載入互惠對象名單
          } else {
            setSuccessMessage('✅ 訂單生成成功！但加入互惠對象名單失敗，請稍後手動加入')
          }
        } catch (partnerErr) {
          console.error("加入互惠對象名單錯誤:", partnerErr)
          setSuccessMessage('✅ 訂單生成成功！但加入互惠對象名單失敗，請稍後手動加入')
        }
        
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(`生成訂單失敗: ${orderResult.error || '未知錯誤'}`)
      }
    } catch (err) {
      console.error("生成訂單錯誤:", err)
      setError("生成訂單失敗，請稍後再試")
    } finally {
      setGeneratingOrder(false)
    }
  }

  const addToSubscribers = async () => {
    if (!selectedUser) return

    try {
      setAddingToSubscribers(true)
      setError(null)

      const response = await fetch('/api/partner-shipping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'add-to-subscribers',
          userId: selectedUser.id
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage('✅ 用戶已加入互惠對象名單！')
        await loadPartnerList() // 重新載入互惠對象名單
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(`加入互惠對象名單失敗: ${result.error || '未知錯誤'}`)
      }
    } catch (err) {
      console.error("加入互惠對象名單錯誤:", err)
      setError("加入互惠對象名單失敗，請稍後再試")
    } finally {
      setAddingToSubscribers(false)
    }
  }

  const generatePartnerRecommendations = async (partner: any) => {
    try {
      setGeneratingPartnerRecommendations(partner.id)
      
      const quizAnswers = partner.quiz_answers 
        ? (typeof partner.quiz_answers === 'string' 
            ? JSON.parse(partner.quiz_answers) 
            : partner.quiz_answers)
        : {}
      
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: partner.user_id || partner.id,
          quizAnswers: quizAnswers
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPartnerRecommendations(prev => ({
          ...prev,
          [partner.id]: data.recommendations
        }))
        setSuccessMessage('✅ 推薦生成成功！結果已顯示在下方')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const errorData = await response.json()
        setPartnerRecommendations(prev => ({
          ...prev,
          [partner.id]: { error: errorData.error || '生成推薦失敗' }
        }))
      }
    } catch (err) {
      console.error("生成推薦錯誤:", err)
      setPartnerRecommendations(prev => ({
        ...prev,
        [partner.id]: { error: '生成推薦時發生錯誤，請稍後再試' }
      }))
    } finally {
      setGeneratingPartnerRecommendations(null)
    }
  }

  const generateRecommendations = async (user: UserProfile) => {
    try {
      setGeneratingRecommendations(user.id)
      
      const quizAnswers = user.quiz_answers 
        ? (typeof user.quiz_answers === 'string' 
            ? JSON.parse(user.quiz_answers) 
            : user.quiz_answers)
        : {}
      
      const response = await fetch('/api/generate-recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          quizAnswers: quizAnswers
        })
      })

      if (response.ok) {
        const data = await response.json()
        setRecommendations(prev => ({
          ...prev,
          [user.id]: data.recommendations
        }))
        setSuccessMessage('✅ 推薦生成成功！結果已顯示在下方')
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        const errorData = await response.json()
        setRecommendations(prev => ({
          ...prev,
          [user.id]: { error: errorData.error || '生成推薦失敗' }
        }))
      }
    } catch (err) {
      console.error("生成推薦錯誤:", err)
      setRecommendations(prev => ({
        ...prev,
        [user.id]: { error: '生成推薦時發生錯誤，請稍後再試' }
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

  // 常見的問答問題標籤
  const quizQuestionLabels: {[key: string]: string} = {
    gender: '性別偏好',
    style: '風格偏好',
    personality: '個性特質',
    scent_preference: '香調偏好',
    occasion: '使用場合',
    intensity: '強度偏好',
    feel: '感受偏好',
    mood: '氣氛偏好',
    vibe: '氣質偏好',
    scent: '香調類型'
  }

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
              <Truck className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-medium text-gray-800">合作對象出貨</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          {/* 互惠對象名單 */}
          {showPartnerList && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      互惠對象名單 ({partnerList.length})
                    </CardTitle>
                    <CardDescription>所有互惠對象的詳細資訊</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-[#A69E8B] hover:bg-[#8A7B6C] text-white"
                      onClick={loadPartnerList}
                      disabled={loadingPartnerList}
                    >
                      {loadingPartnerList ? '同步中...' : '同步資料'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPartnerList(!showPartnerList)
                      }}
                    >
                      {showPartnerList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {showPartnerList && (
                <CardContent>
                  {loadingPartnerList ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                      <p className="text-gray-600">載入中...</p>
                    </div>
                  ) : partnerList.length === 0 ? (
                    <div className="text-center py-12">
                      <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-2">目前沒有任何互惠對象</p>
                      <p className="text-sm text-gray-500">使用下方搜尋功能添加互惠對象</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {partnerList.map((partner: any) => (
                        <div 
                          key={partner.id} 
                          className={`border rounded-lg p-4 hover:shadow-md transition-shadow bg-white ${
                            selectedUser?.id === partner.user_id ? 'border-blue-300' : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                            <div 
                              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 cursor-pointer flex-1"
                              onClick={() => {
                                // 從 partner_list 轉換為 UserProfile 格式
                                const userProfile: UserProfile = {
                                  id: partner.user_id || partner.id,
                                  name: partner.name,
                                  email: partner.email,
                                  phone: partner.phone,
                                  delivery_method: partner.delivery_method,
                                  quiz_answers: partner.quiz_answers,
                                  created_at: partner.created_at,
                                  updated_at: partner.updated_at
                                }
                                selectUser(userProfile)
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {expandedPartner === partner.id ? 
                                  <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                }
                                <h3 className="font-medium text-gray-800 text-base">
                                  {partner.name || partner.email}
                                </h3>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                  partner.subscription_status === 'active' 
                                    ? 'bg-green-100 text-green-800 border-green-300'
                                    : 'bg-gray-100 text-gray-800 border-gray-300'
                                }`}>
                                  {partner.subscription_status === 'active' ? '✓ 已啟用' : '⏳ 待啟用'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                            {partner.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 truncate">{partner.email}</span>
                              </div>
                            )}
                            {partner.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 truncate">{partner.phone}</span>
                              </div>
                            )}
                            {partner.created_at && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600 text-sm">
                                  加入: {new Date(partner.created_at).toLocaleDateString("zh-TW")}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600 text-sm">
                                訂閱月數: {partner.subscription_months ?? '未設定'}{partner.subscription_months ? ' 個月' : ''}
                              </span>
                            </div>
                          </div>

                          {/* 額外資訊 */}
                          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {partner.delivery_method && (
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-600">
                                  {partner.delivery_method === 'home' ? '宅配' : 
                                   partner.delivery_method === '711' ? '7-11超商' : 
                                   partner.delivery_method}
                                </span>
                              </div>
                            )}
                            {partner.monthly_fee && (
                              <div className="text-gray-600">
                                <span className="font-medium">月費: </span>
                                <span className="text-gray-800">NT$ {partner.monthly_fee}</span>
                              </div>
                            )}
                            {partner.subscription_months !== undefined && partner.subscription_months !== null && (
                              <div className="text-gray-600">
                                <span className="font-medium">訂閱月數: </span>
                                <span className="text-gray-800">{partner.subscription_months} 個月</span>
                              </div>
                            )}
                          </div>

                          {partner.quiz_answers && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">測驗資料: </span>
                                <span className="text-gray-500">
                                  {typeof partner.quiz_answers === 'string' 
                                    ? Object.keys(JSON.parse(partner.quiz_answers)).length 
                                    : Object.keys(partner.quiz_answers).length} 個問題已回答
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 展開的詳細資訊 */}
                          {expandedPartner === partner.id && (
                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                              {/* 操作按鈕區域 */}
                              <div className="flex flex-col items-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => generatePartnerRecommendations(partner)}
                                  disabled={generatingPartnerRecommendations === partner.id}
                                  className="flex items-center gap-2 bg-[#A69E8B] hover:bg-[#8A7B6C]"
                                >
                                  <Sparkles className={`w-4 h-4 ${generatingPartnerRecommendations === partner.id ? 'animate-spin' : ''}`} />
                                  {generatingPartnerRecommendations === partner.id ? '生成中...' : '生成個人化推薦'}
                                </Button>
                              </div>

                              {/* 測驗答案詳細資訊 */}
                              {partner.quiz_answers && (
                                <div>
                                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    測驗答案詳細資訊
                                  </h4>
                                  <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      {(() => {
                                        const answers = formatQuizAnswers(partner.quiz_answers)
                                        if (!answers) return <p className="text-gray-500">無法解析測驗答案</p>
                                        
                                        return Object.entries(answers).map(([question, answer]: [string, any]) => (
                                          <div key={question} className="space-y-1">
                                            <div className="font-medium text-gray-700">
                                              {quizQuestionLabels[question] || question}:
                                            </div>
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
                              {partnerRecommendations[partner.id] && (
                                <div>
                                  <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                    個人化推薦結果
                                  </h4>
                                  
                                  {partnerRecommendations[partner.id].error ? (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                                      <div className="text-red-600 font-medium mb-2">
                                        ❌ 推薦生成失敗
                                      </div>
                                      <div className="text-red-500 text-sm">
                                        {partnerRecommendations[partner.id].error}
                                      </div>
                                      <button 
                                        onClick={() => generatePartnerRecommendations(partner)}
                                        className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                                        disabled={generatingPartnerRecommendations === partner.id}
                                      >
                                        {generatingPartnerRecommendations === partner.id ? '重新生成中...' : '重新生成推薦'}
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="grid gap-4">
                                        {Object.entries(partnerRecommendations[partner.id]).map(([type, rec]: [string, any]) => {
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
                                          if (!config || !rec) return null
                                          
                                          return (
                                            <div key={type} className={`${config.bgColor} rounded-xl p-5 border-2 ${config.borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                                              <div className="flex items-center justify-between mb-3">
                                                <h5 className={`font-semibold text-lg ${config.textColor}`}>
                                                  {config.title}
                                                </h5>
                                                <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.badgeColor}`}>
                                                  {rec.confidence}% 匹配度
                                                </span>
                                              </div>
                                              
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
                                                
                                                <div className="mt-4">
                                                  <div className={`font-medium text-sm mb-2 ${config.textColor}`}>
                                                    💡 推薦理由：
                                                  </div>
                                                  <div className="grid gap-2">
                                                    {rec.reasons?.map((reason: string, index: number) => (
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
                                      
                                      <div className="mt-4 text-xs text-gray-500 text-center">
                                        ✨ 推薦生成時間：{new Date().toLocaleString('zh-TW')}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 點擊展開/收起 */}
                          <div 
                            className="mt-3 pt-3 border-t border-gray-100 cursor-pointer"
                            onClick={() => setExpandedPartner(expandedPartner === partner.id ? null : partner.id)}
                          >
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                              {expandedPartner === partner.id ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  <span>收起詳細資訊</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  <span>展開詳細資訊</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* 搜尋區域 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                搜尋用戶
              </CardTitle>
              <CardDescription>輸入用戶名字進行搜尋</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="輸入用戶名字..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchLoading && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                  搜尋中...
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* 搜尋結果列表 */}
          {searchResults.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>搜尋結果 ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {searchResults.map((user) => (
                    <div 
                      key={user.id} 
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        selectedUser?.id === user.id ? 'bg-blue-50 border-blue-300' : 'bg-white'
                      }`}
                      onClick={() => selectUser(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-gray-500" />
                          <div>
                            <h3 className="font-medium text-gray-800">{user.name}</h3>
                            {user.email && (
                              <p className="text-sm text-gray-600">{user.email}</p>
                            )}
                          </div>
                        </div>
                        {selectedUser?.id === user.id && (
                          <div className="text-sm text-blue-600 font-medium">已選中</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 選中用戶的詳細資訊和編輯 */}
          {selectedUser && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  用戶資料編輯
                </CardTitle>
                <CardDescription>更新用戶的手機、寄送方式和問答答案</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* 基本資訊 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>姓名</Label>
                      <Input value={selectedUser.name} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={selectedUser.email} disabled className="mt-1" />
                    </div>
                  </div>

                  {/* 手機號碼 */}
                  <div>
                    <Label htmlFor="phone">手機號碼</Label>
                    <Input
                      id="phone"
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      placeholder="輸入手機號碼"
                      className="mt-1"
                    />
                  </div>

                  {/* 寄送方式 */}
                  <div>
                    <Label htmlFor="delivery_method">寄送方式</Label>
                    <select
                      id="delivery_method"
                      value={editingDeliveryMethod}
                      onChange={(e) => setEditingDeliveryMethod(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent"
                    >
                      <option value="">請選擇寄送方式</option>
                      <option value="home">宅配</option>
                      <option value="711">7-11超商</option>
                    </select>
                  </div>

                  {/* 問答答案編輯 */}
                  <div>
                    <Label className="mb-2 block">問答答案 (7個問題)</Label>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      {Object.entries(editingQuizAnswers).map(([key, value]) => (
                        <div key={key}>
                          <Label className="text-sm font-medium text-gray-700">
                            {quizQuestionLabels[key] || key}:
                          </Label>
                          <Input
                            value={Array.isArray(value) ? value.join(', ') : String(value || '')}
                            onChange={(e) => {
                              const newValue = e.target.value
                              setEditingQuizAnswers({
                                ...editingQuizAnswers,
                                [key]: newValue.includes(',') ? newValue.split(',').map(v => v.trim()) : newValue
                              })
                            }}
                            placeholder={`輸入${quizQuestionLabels[key] || key}的答案`}
                            className="mt-1"
                          />
                        </div>
                      ))}
                      {Object.keys(editingQuizAnswers).length === 0 && (
                        <p className="text-sm text-gray-500">目前沒有問答資料</p>
                      )}
                    </div>
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex flex-col sm:flex-row justify-end gap-2">
                    <Button
                      onClick={addToSubscribers}
                      disabled={addingToSubscribers}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <UserPlus className={`w-4 h-4 ${addingToSubscribers ? 'animate-spin' : ''}`} />
                      {addingToSubscribers ? '加入中...' : '加入互惠對象名單'}
                    </Button>
                    <Button
                      onClick={generateOrder}
                      disabled={generatingOrder}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Package className={`w-4 h-4 ${generatingOrder ? 'animate-spin' : ''}`} />
                      {generatingOrder ? '生成中...' : '生成訂單'}
                    </Button>
                    <Button
                      onClick={saveUserProfile}
                      disabled={saving}
                      className="bg-[#A69E8B] hover:bg-[#8A7B6C]"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? '儲存中...' : '儲存變更'}
                    </Button>
                  </div>

                  {/* 展開的詳細資訊 */}
                  {expandedUser === selectedUser.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                      {/* 操作按鈕區域 */}
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => generateRecommendations(selectedUser)}
                          disabled={generatingRecommendations === selectedUser.id}
                          className="flex items-center gap-2 bg-[#A69E8B] hover:bg-[#8A7B6C]"
                        >
                          <Sparkles className={`w-4 h-4 ${generatingRecommendations === selectedUser.id ? 'animate-spin' : ''}`} />
                          {generatingRecommendations === selectedUser.id ? '生成中...' : '生成個人化推薦'}
                        </Button>
                      </div>

                      {/* 測驗答案詳細資訊 */}
                      {selectedUser.quiz_answers && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            測驗答案詳細資訊
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(() => {
                                const answers = formatQuizAnswers(selectedUser.quiz_answers)
                                if (!answers) return <p className="text-gray-500">無法解析測驗答案</p>
                                
                                return Object.entries(answers).map(([question, answer]: [string, any]) => (
                                  <div key={question} className="space-y-1">
                                    <div className="font-medium text-gray-700">
                                      {quizQuestionLabels[question] || question}:
                                    </div>
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
                      {recommendations[selectedUser.id] && (
                        <div>
                          <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            個人化推薦結果
                          </h4>
                          
                          {recommendations[selectedUser.id].error ? (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                              <div className="text-red-600 font-medium mb-2">
                                ❌ 推薦生成失敗
                              </div>
                              <div className="text-red-500 text-sm">
                                {recommendations[selectedUser.id].error}
                              </div>
                              <button 
                                onClick={() => generateRecommendations(selectedUser)}
                                className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                                disabled={generatingRecommendations === selectedUser.id}
                              >
                                {generatingRecommendations === selectedUser.id ? '重新生成中...' : '重新生成推薦'}
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-4">
                                {Object.entries(recommendations[selectedUser.id]).map(([type, rec]: [string, any]) => {
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
                                  if (!config || !rec) return null
                                  
                                  return (
                                    <div key={type} className={`${config.bgColor} rounded-xl p-5 border-2 ${config.borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                                      <div className="flex items-center justify-between mb-3">
                                        <h5 className={`font-semibold text-lg ${config.textColor}`}>
                                          {config.title}
                                        </h5>
                                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.badgeColor}`}>
                                          {rec.confidence}% 匹配度
                                        </span>
                                      </div>
                                      
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
                                        
                                        <div className="mt-4">
                                          <div className={`font-medium text-sm mb-2 ${config.textColor}`}>
                                            💡 推薦理由：
                                          </div>
                                          <div className="grid gap-2">
                                            {rec.reasons?.map((reason: string, index: number) => (
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
              </CardContent>
            </Card>
          )}

          {!selectedUser && searchResults.length === 0 && searchTerm.trim() === '' && (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">請輸入用戶名字進行搜尋</p>
                <p className="text-sm text-gray-500">搜尋結果將顯示在此處</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
