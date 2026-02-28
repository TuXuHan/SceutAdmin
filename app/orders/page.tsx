"use client"

import { useState, useEffect, Suspense } from "react"
import { useAuth } from "@/app/auth-provider"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Package, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  AlertCircle, 
  Database,
  RefreshCw,
  Calendar,
  User,
  Mail,
  Phone,
  MapPin,
  Plus,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Truck
} from "lucide-react"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { CreateOrderDialog } from "@/components/create-order-dialog"
import { SubscribersDialog } from "@/components/subscribers-dialog"
import { PartnerShippingDialog } from "@/components/partner-shipping-dialog"

interface Order {
  id: string
  shopify_order_id?: string
  subscriber_name: string
  customer_email: string
  customer_phone?: string
  shipping_address?: string
  delivery_method?: string
  "711"?: string
  order_status: string
  total_price: number
  total_amount?: number  // 保持向後兼容
  currency?: string
  payment_status?: string
  shipping_status?: string
  notes?: string
  cancellation_note?: string
  user_id?: string
  perfume_name?: string
  ratings?: any
  created_at?: string
  updated_at?: string
  ship_date?: string | null
}

interface OrderStats {
  total: number
  pending: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
  partner: number
}

function OrdersPageContent() {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    partner: 0
  })
  const [partnerList, setPartnerList] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingOrder, setEditingOrder] = useState<string | null>(null)
  const [tempOrderStatus, setTempOrderStatus] = useState<string>("")
  const [tempPerfumeName, setTempPerfumeName] = useState<string>("")
  const [tempShopifyOrderId, setTempShopifyOrderId] = useState<string>("")
  const [tempCancellationNote, setTempCancellationNote] = useState<string>("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSubscribersDialog, setShowSubscribersDialog] = useState(false)
  const [showPartnerShippingDialog, setShowPartnerShippingDialog] = useState(false)
  const [subscribersCount, setSubscribersCount] = useState(0)
  const [updating711Status, setUpdating711Status] = useState(false)
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null)
  const [autoGeneratingOrders, setAutoGeneratingOrders] = useState(false)
  const [autoOrderMessage, setAutoOrderMessage] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [fillingPhones, setFillingPhones] = useState(false)
  const [fillPhonesMessage, setFillPhonesMessage] = useState<string | null>(null)
  const [fillingAddresses, setFillingAddresses] = useState(false)
  const [fillAddressesMessage, setFillAddressesMessage] = useState<string | null>(null)
  const [perfumes, setPerfumes] = useState<Array<{ number: string; name: string; brand: string }>>([])
  const [loadingPerfumes, setLoadingPerfumes] = useState(false)
  const { loading, startLoading, stopLoading, shouldSkipLoad, resetLoadingState } = useDebouncedLoading({
    debounceMs: 60000, // 60 秒防抖
    maxRetries: 1
  })

  // 載入合作對象列表
  const loadPartnerList = async () => {
    try {
      const response = await fetch('/api/partner-list')
      if (response.ok) {
        const data = await response.json()
        setPartnerList(data.partners || [])
      }
    } catch (err) {
      console.error("載入合作對象列表失敗:", err)
    }
  }

  // 載入香水列表
  const loadPerfumes = async () => {
    try {
      setLoadingPerfumes(true)
      const response = await fetch('/api/perfumes')
      const result = await response.json()
      
      if (result.success) {
        setPerfumes(result.perfumes || [])
      } else {
        console.error('載入香水列表失敗:', result.error)
      }
    } catch (error) {
      console.error('載入香水列表時發生錯誤:', error)
    } finally {
      setLoadingPerfumes(false)
    }
  }

  // 檢查訂單是否為合作對象訂單
  const isPartnerOrder = (order: Order): boolean => {
    if (!order.subscriber_name || partnerList.length === 0) {
      return false
    }
    return partnerList.some(partner => 
      partner.name === order.subscriber_name || 
      partner.email === order.customer_email
    )
  }

  // 計算各個order_status的函式
  const calculateOrderStats = (orders: Order[]): OrderStats => {
    return {
      total: orders.length,
      pending: orders.filter(order => order.order_status === 'pending').length,
      processing: orders.filter(order => order.order_status === 'processing').length,
      shipped: orders.filter(order => order.order_status === 'shipped' || order.order_status === 'shippped').length,
      delivered: orders.filter(order => order.order_status === 'delivered').length,
      cancelled: orders.filter(order => order.order_status === 'cancelled').length,
      partner: orders.filter(order => isPartnerOrder(order)).length
    }
  }

  const loadOrders = async (forceReload = false) => {
    if (shouldSkipLoad(forceReload)) {
      stopLoading()
      return
    }

    try {
      startLoading()
      setError(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"
      
      const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&order=created_at.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setOrders(data || [])
      } else {
        const errorText = await response.text()
        console.error("載入訂單失敗:", response.status, errorText)
        setOrders([])
        setFilteredOrders([])
        setError(`查詢失敗: ${response.status} ${response.statusText}`)
      }

    } catch (err) {
      console.error("載入訂單錯誤:", err)
      const errorMessage = err instanceof Error ? err.message : "載入訂單資料失敗"
      setError(errorMessage)
      setOrders([])
      setFilteredOrders([])
    } finally {
      stopLoading()
    }
  }

  useEffect(() => {
    let filtered = orders

    if (searchTerm) {
      filtered = filtered.filter(order => {
        const searchLower = searchTerm.toLowerCase()
        return (
          (order.subscriber_name && order.subscriber_name.toLowerCase().includes(searchLower)) ||
          (order.customer_email && order.customer_email.toLowerCase().includes(searchLower)) ||
          (order.id && order.id.toLowerCase().includes(searchLower)) ||
          (order.shopify_order_id && order.shopify_order_id.toLowerCase().includes(searchLower))
        )
      })
    }

    if (statusFilter === "partner") {
      // 過濾合作對象訂單
      filtered = filtered.filter(order => isPartnerOrder(order))
    } else if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.order_status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter, partnerList])

  // 當訂單或合作對象列表更新時，重新計算統計數據
  useEffect(() => {
    const newStats = calculateOrderStats(orders)
    setStats(newStats)
  }, [orders, partnerList])

  // 暫時移除認證檢查，直接顯示訂單管理頁面
  // useEffect(() => {
  //   if (!authLoading && !isAuthenticated) {
  //     console.log("[v0] Admin orders access denied - redirecting to login")
  //     router.push("/login")
  //   }
  // }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    // 直接載入訂單資料，不需要用戶認證
    resetLoadingState()
    loadOrders()
    // 載入訂閱者數量
    loadSubscribersCount()
    // 載入合作對象列表
    loadPartnerList()
    // 載入香水列表
    loadPerfumes()
  }, [])

  const loadSubscribersCount = async () => {
    try {
      const response = await fetch('/api/subscribers')
      if (response.ok) {
        const data = await response.json()
        setSubscribersCount(data.count || 0)
      }
    } catch (err) {
      console.error("載入訂閱者數量失敗:", err)
    }
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetLoadingState()
        loadOrders(true)
      }
    }

    const handleFocus = () => {
      resetLoadingState()
      loadOrders(true)
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [])

  const handleRetry = () => {
    setError(null)
    startLoading()
    loadOrders(true)
  }

  const updateOrderStatus = async (orderId: string, newStatus: string, perfumeName?: string, shopifyOrderId?: string, cancellationNote?: string) => {
    try {
      const updateData: any = {
        id: orderId,
        order_status: newStatus
      }
      
      if (perfumeName !== undefined) {
        updateData.perfume_name = perfumeName
      }
      
      if (shopifyOrderId !== undefined) {
        updateData.shopify_order_id = shopifyOrderId
      }
      
      if (newStatus === 'cancelled' && cancellationNote !== undefined) {
        updateData.cancellation_note = cancellationNote
      } else if (newStatus !== 'cancelled') {
        // 如果狀態不是已取消，清除取消備注
        updateData.cancellation_note = null
      }
      
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === orderId 
                ? { 
                    ...order, 
                    order_status: newStatus, 
                    updated_at: result.order.updated_at,
                    ship_date: result.order.ship_date ?? order.ship_date,
                    cancellation_note: result.order.cancellation_note ?? order.cancellation_note
                  }
                : order
            )
          )
          setEditingOrder(null)
          setTempOrderStatus("")
          setTempCancellationNote("")
          loadOrders(true)
        } else {
          console.error('更新訂單失敗:', result.error)
        }
      } else {
        console.error('更新訂單失敗:', response.status)
      }
    } catch (error) {
      console.error('更新訂單錯誤:', error)
    }
  }

  const handleSaveStatus = async (orderId: string) => {
    await updateOrderStatus(orderId, tempOrderStatus, tempPerfumeName, tempShopifyOrderId, tempCancellationNote)
  }

  const handleCancelEdit = () => {
    setEditingOrder(null)
    setTempOrderStatus("")
    setTempPerfumeName("")
    setTempShopifyOrderId("")
    setTempCancellationNote("")
  }

  const handleUpdate711Status = async () => {
    try {
      setUpdating711Status(true)
      setStatusUpdateMessage("正在查詢 7-11 物流狀態...")
      
      const response = await fetch('/api/update-711-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        setStatusUpdateMessage(`✅ ${result.message}`)
        // 更新成功後重新載入訂單列表
        await loadOrders(true)
        
        // 3秒後清除訊息
        setTimeout(() => {
          setStatusUpdateMessage(null)
        }, 3000)
      } else {
        setStatusUpdateMessage(`❌ 更新失敗：${result.error || result.message}`)
        setTimeout(() => {
          setStatusUpdateMessage(null)
        }, 5000)
      }
    } catch (err) {
      console.error("更新 7-11 狀態錯誤:", err)
      setStatusUpdateMessage("❌ 更新失敗，請稍後再試")
      setTimeout(() => {
        setStatusUpdateMessage(null)
      }, 5000)
    } finally {
      setUpdating711Status(false)
    }
  }

  const handleAutoGenerateOrders = async (skipReload = false) => {
    try {
      setAutoGeneratingOrders(true)
      setAutoOrderMessage("正在檢查需要生成訂單的訂閱者...")
      
      const response = await fetch('/api/auto-generate-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        if (result.generatedOrders > 0) {
          setAutoOrderMessage(`✅ 成功生成 ${result.generatedOrders} 個待處理訂單${result.skippedOrders > 0 ? `，跳過 ${result.skippedOrders} 個已有訂單的訂閱者` : ''}`)
        } else {
          setAutoOrderMessage(`ℹ️ ${result.message}`)
        }
        
        // 如果不需要跳過重新載入，則重新載入訂單列表
        if (!skipReload) {
          await loadOrders(true)
        }
        
        // 5秒後清除訊息
        setTimeout(() => {
          setAutoOrderMessage(null)
        }, 5000)
      } else {
        setAutoOrderMessage(`❌ 自動生成失敗：${result.error || result.message}`)
        setTimeout(() => {
          setAutoOrderMessage(null)
        }, 5000)
      }
    } catch (err) {
      console.error("自動生成訂單錯誤:", err)
      setAutoOrderMessage("❌ 自動生成失敗，請稍後再試")
      setTimeout(() => {
        setAutoOrderMessage(null)
      }, 5000)
    } finally {
      setAutoGeneratingOrders(false)
    }
  }

  const handleFillMissingPhones = async (skipReload = false) => {
    try {
      setFillingPhones(true)
      setFillPhonesMessage("正在檢查缺少電話號碼的訂單...")
      
      const response = await fetch('/api/orders/fill-missing-phones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        if (result.updated > 0) {
          setFillPhonesMessage(`✅ ${result.message}${result.errors && result.errors.length > 0 ? ` (有 ${result.errors.length} 個錯誤)` : ''}`)
        } else {
          setFillPhonesMessage(`ℹ️ ${result.message}`)
        }
        
        // 如果不需要跳過重新載入，則重新載入訂單列表
        if (!skipReload) {
          await loadOrders(true)
        }
        
        // 5秒後清除訊息
        setTimeout(() => {
          setFillPhonesMessage(null)
        }, 5000)
      } else {
        setFillPhonesMessage(`❌ 更新失敗：${result.error || result.message}`)
        setTimeout(() => {
          setFillPhonesMessage(null)
        }, 5000)
      }
    } catch (err) {
      console.error("填充電話號碼錯誤:", err)
      setFillPhonesMessage("❌ 更新失敗，請稍後再試")
      setTimeout(() => {
        setFillPhonesMessage(null)
      }, 5000)
    } finally {
      setFillingPhones(false)
    }
  }

  const handleFillMissingAddresses = async (skipReload = false) => {
    try {
      setFillingAddresses(true)
      setFillAddressesMessage("正在檢查缺少宅配地址的訂單...")
      
      const response = await fetch('/api/orders/fill-missing-addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        if (result.updated > 0) {
          setFillAddressesMessage(`✅ ${result.message}${result.errors && result.errors.length > 0 ? ` (有 ${result.errors.length} 個錯誤)` : ''}`)
        } else {
          setFillAddressesMessage(`ℹ️ ${result.message}`)
        }
        
        if (!skipReload) {
          await loadOrders(true)
        }

        setTimeout(() => {
          setFillAddressesMessage(null)
        }, 5000)
      } else {
        setFillAddressesMessage(`❌ 更新失敗：${result.error || result.message}`)
        setTimeout(() => {
          setFillAddressesMessage(null)
        }, 5000)
      }
    } catch (err) {
      console.error("填充宅配地址錯誤:", err)
      setFillAddressesMessage("❌ 更新失敗，請稍後再試")
      setTimeout(() => {
        setFillAddressesMessage(null)
      }, 5000)
    } finally {
      setFillingAddresses(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'outline' // 灰色邊框 - 待處理
      case 'processing':
        return 'default' // 藍色 - 處理中
      case 'shipped':
      case 'shippped': // 處理拼寫錯誤
        return 'secondary' // 紫色 - 已出貨
      case 'delivered':
        return 'default' // 綠色 - 已送達
      case 'cancelled':
        return 'destructive' // 紅色 - 已取消
      default:
        return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-300' // 灰色 - 待處理
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300' // 藍色 - 處理中
      case 'shipped':
      case 'shippped': // 處理拼寫錯誤
        return 'bg-purple-100 text-purple-800 border-purple-300' // 紫色 - 已出貨
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-300' // 綠色 - 已送達
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300' // 紅色 - 已取消
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待處理'
      case 'processing':
        return '處理中'
      case 'shipped':
      case 'shippped': // 處理拼寫錯誤
        return '已出貨'
      case 'delivered':
        return '已送達'
      case 'cancelled':
        return '已取消'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex">
      {/* 手機版遮罩層 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 左側導航選單 */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 lg:p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg lg:text-xl font-light text-gray-800">訂單管理系統</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "all" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-gray-300"
              }`}
              onClick={() => {
                setStatusFilter("all")
                setSidebarOpen(false)
              }}
            >
              <Package className="w-4 h-4 inline mr-3" />
              所有訂單 ({stats.total})
            </button>
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "processing" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-blue-300"
              }`}
              onClick={() => {
                setStatusFilter("processing")
                setSidebarOpen(false)
              }}
            >
              <Package className="w-4 h-4 inline mr-3" />
              處理中訂單 ({stats.processing})
            </button>
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "shipped" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-purple-300"
              }`}
              onClick={() => {
                setStatusFilter("shipped")
                setSidebarOpen(false)
              }}
            >
              <Package className="w-4 h-4 inline mr-3" />
              已出貨訂單 ({stats.shipped})
            </button>
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "delivered" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-green-300"
              }`}
              onClick={() => {
                setStatusFilter("delivered")
                setSidebarOpen(false)
              }}
            >
              <Package className="w-4 h-4 inline mr-3" />
              已送達訂單 ({stats.delivered})
            </button>
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "pending" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-gray-400"
              }`}
              onClick={() => {
                setStatusFilter("pending")
                setSidebarOpen(false)
              }}
            >
              <Package className="w-4 h-4 inline mr-3" />
              待處理訂單 ({stats.pending})
            </button>
            <button 
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm ${
                statusFilter === "partner" 
                  ? "bg-[#A69E8B] text-white" 
                  : "text-gray-700 hover:bg-gray-100 border-l-4 border-orange-300"
              }`}
              onClick={() => {
                setStatusFilter("partner")
                setSidebarOpen(false)
              }}
            >
              <Truck className="w-4 h-4 inline mr-3" />
              合作對象訂單 ({stats.partner})
            </button>
            
            {/* 分隔線 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            {/* 訂閱者管理 */}
            <button 
              className="w-full text-left px-4 py-3 rounded-lg transition-colors bg-[#A69E8B] text-white hover:bg-[#8A7B6C] text-sm"
              onClick={() => {
                setShowSubscribersDialog(true)
                setSidebarOpen(false)
              }}
            >
              <User className="w-4 h-4 inline mr-3" />
              所有訂閱者 ({subscribersCount})
            </button>
            
            {/* 合作對象出貨 */}
            <button 
              className="w-full text-left px-4 py-3 rounded-lg transition-colors bg-[#A69E8B] text-white hover:bg-[#8A7B6C] text-sm"
              onClick={() => {
                setShowPartnerShippingDialog(true)
                setSidebarOpen(false)
              }}
            >
              <Truck className="w-4 h-4 inline mr-3" />
              合作對象出貨
            </button>
            
            {/* 分隔線 */}
            <div className="border-t border-gray-200 my-2"></div>
            
            <button 
              className="w-full text-left px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-100 text-sm"
              onClick={() => {
                setShowCreateDialog(true)
                setSidebarOpen(false)
              }}
            >
              <Plus className="w-4 h-4 inline mr-3" />
              創建新訂單
            </button>
          </div>
        </nav>
      </div>

      {/* 主要內容區域 */}
      <div className="flex-1 lg:ml-0">
        {/* 手機版標題欄 */}
        <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-medium text-gray-800">訂單管理</h1>
          <div className="w-9"></div> {/* 佔位符保持居中 */}
        </div>

        <div className="p-4 lg:p-8">
          {/* 頁面標題和操作按鈕 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 lg:mb-8 gap-4">
            <div>
              <h2 className="text-xl lg:text-2xl font-light text-gray-800 mb-2">訂單列表</h2>
              <p className="text-gray-600 text-sm lg:text-base">管理所有訂單和配送狀態</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline" 
                onClick={handleUpdate711Status}
                disabled={updating711Status}
                className="flex items-center gap-2 text-sm bg-[#A69E8B] text-white hover:bg-[#8A7B6C] hover:text-white"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${updating711Status ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {updating711Status ? '查詢中...' : '更新 7-11 狀態'}
                </span>
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  // 1. 補齊缺少電話號碼的訂單（跳過單獨重新載入）
                  await handleFillMissingPhones(true)
                  // 2. 補齊缺少宅配地址的訂單（跳過單獨重新載入）
                  await handleFillMissingAddresses(true)
                  // 3. 然後執行自動生成訂單（跳過單獨重新載入）
                  await handleAutoGenerateOrders(true)
                  // 4. 最後統一重新載入訂單列表
                  await loadOrders(true)
                }}
                disabled={autoGeneratingOrders || fillingPhones || fillingAddresses}
                className="flex items-center gap-2 text-sm"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 ${(autoGeneratingOrders || fillingPhones) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {(autoGeneratingOrders || fillingPhones || fillingAddresses) ? '檢查中...' : '重新整理'}
                </span>
              </Button>
            </div>
          </div>

        {/* 7-11 狀態更新訊息 */}
        {statusUpdateMessage && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              {statusUpdateMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* 自動訂單生成訊息 */}
        {autoOrderMessage && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              {autoOrderMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* 補充電話號碼訊息 */}
        {fillPhonesMessage && (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              {fillPhonesMessage}
            </AlertDescription>
          </Alert>
        )}

      {/* 補齊宅配地址訊息 */}
      {fillAddressesMessage && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertDescription className="text-blue-800">
            {fillAddressesMessage}
          </AlertDescription>
        </Alert>
      )}

        {!isDatabaseConfigured && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <Database className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              資料庫尚未配置。請在專案設定中添加 Supabase 整合以啟用完整功能。
            </AlertDescription>
          </Alert>
        )}

        {error && isDatabaseConfigured && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
              <Button variant="link" className="p-0 h-auto text-red-800 underline ml-2" onClick={handleRetry}>
                重新載入
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-6 lg:mb-8">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <p className="text-sm text-gray-600">總訂單</p>
            </CardContent>
          </Card>
          <Card className="border-gray-300 bg-gray-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-700">{stats.pending}</div>
              <p className="text-sm text-gray-600">待處理</p>
            </CardContent>
          </Card>
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700">{stats.processing}</div>
              <p className="text-sm text-blue-600">處理中</p>
            </CardContent>
          </Card>
          <Card className="border-purple-300 bg-purple-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-700">{stats.shipped}</div>
              <p className="text-sm text-purple-600">已出貨</p>
            </CardContent>
          </Card>
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
              <p className="text-sm text-green-600">已送達</p>
            </CardContent>
          </Card>
        </div>

        {/* 搜尋和過濾 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜尋訂單..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm min-w-0 flex-1 sm:flex-none"
                >
                  <option value="all">所有狀態</option>
                  <option value="pending">🟫 待處理</option>
                  <option value="processing">🔵 處理中</option>
                  <option value="shipped">🟣 已出貨</option>
                  <option value="delivered">🟢 已送達</option>
                  <option value="cancelled">🔴 已取消</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 訂單列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              訂單列表 ({filteredOrders.length})
            </CardTitle>
            <CardDescription>所有訂單的詳細資訊</CardDescription>
          </CardHeader>
          <CardContent>
            {!isDatabaseConfigured ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">資料庫尚未配置</p>
                <p className="text-sm text-gray-500 mb-4">請在專案設定中添加 Supabase 整合以查看訂單資料</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== "all" ? "沒有找到符合條件的訂單" : "目前沒有任何訂單"}
                </p>
                {(searchTerm || statusFilter !== "all") && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                    }}
                  >
                    清除篩選
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order: any) => (
                  <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-800 text-sm sm:text-base">
                            訂單 #{order.shopify_order_id || '無貨號'}
                          </h3>
                          {/* 下拉按鈕 - 只在待處理訂單時顯示 */}
                          {order.order_status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                              className="p-1 h-auto"
                            >
                              {expandedOrder === order.id ? 
                                <ChevronUp className="w-4 h-4 text-gray-500" /> : 
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              }
                            </Button>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.order_status)}`}>
                          {getStatusText(order.order_status)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (editingOrder === order.id) {
                              setEditingOrder(null)
                              setTempOrderStatus("")
                              setTempPerfumeName("")
                              setTempShopifyOrderId("")
                            } else {
                              setEditingOrder(order.id)
                              setTempOrderStatus(order.order_status)
                              setTempPerfumeName(order.perfume_name || "")
                              setTempShopifyOrderId(order.shopify_order_id || "")
                              setTempCancellationNote(order.cancellation_note || "")
                            }
                          }}
                          className="text-xs sm:text-sm"
                        >
                          <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span className="hidden sm:inline">
                            {editingOrder === order.id ? '取消編輯' : '編輯狀態'}
                          </span>
                          <span className="sm:hidden">
                            {editingOrder === order.id ? '取消' : '編輯'}
                          </span>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{order.subscriber_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{order.customer_email}</span>
                      </div>
                      {order.customer_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-gray-600 truncate">{order.customer_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 text-xs sm:text-sm">
                          {order.updated_at ? new Date(order.updated_at).toLocaleDateString("zh-TW") : '無日期資訊'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        總金額: <span className="font-medium text-gray-800">{order.currency || 'NT$'} {(order.total_price || order.total_amount || 0).toLocaleString()}</span>
                      </div>
                      {/* 根據配送方式顯示不同的配送資訊 */}
                      {order.delivery_method === 'home' && order.shipping_address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">宅配: {order.shipping_address}</span>
                        </div>
                      )}
                      {order.delivery_method === '711' && order["711"] && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">7-11: {order["711"]}</span>
                        </div>
                      )}
                      {/* 向後兼容：如果沒有配送方式但有配送地址，顯示原來的格式 */}
                      {!order.delivery_method && order.shipping_address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">{order.shipping_address}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 顯示取消備注（僅當訂單狀態為已取消且有備注時） */}
                    {order.order_status === 'cancelled' && order.cancellation_note && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-red-700">取消備注：</span>
                            <span className="text-red-600">{order.cancellation_note}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 展開的詳細訊息 - 只在待處理訂單且展開時顯示 */}
                    {order.order_status === 'pending' && expandedOrder === order.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            配送詳細資訊
                          </h4>
                          <div className="space-y-3">
                            {/* 根據配送方式顯示不同資訊 */}
                            {order.delivery_method === 'home' && (
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 flex-1">
                                  <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-gray-800">宅配配送</div>
                                    <div className="text-gray-600 mt-1">
                                      {order.shipping_address || '未設定配送地址'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {order.delivery_method === '711' && (
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 flex-1">
                                  <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-gray-800">7-11超商配送</div>
                                    <div className="text-gray-600 mt-1">
                                      {order["711"] || '未設定門市'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {!order.delivery_method && (
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0 flex-1">
                                  <MapPin className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-gray-800">配送資訊</div>
                                    <div className="text-gray-600 mt-1">
                                      {order.shipping_address || '未設定配送資訊'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* 訂單基本資訊 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center gap-2 text-sm">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">訂購人:</span>
                                <span className="font-medium">{order.subscriber_name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Email:</span>
                                <span className="font-medium">{order.customer_email}</span>
                              </div>
                              {order.customer_phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">電話:</span>
                                  <span className="font-medium">{order.customer_phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">訂單日期:</span>
                                <span className="font-medium">
                                  {order.created_at ? new Date(order.created_at).toLocaleDateString("zh-TW") : '無'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">訂單金額:</span>
                                <span className="font-medium text-green-600">
                                  {order.currency || 'NT$'} {(order.total_price || order.total_amount || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 編輯狀態選單 */}
                    {editingOrder === order.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="space-y-4">
                          {/* 第一行：出貨狀態 */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">出貨狀態:</span>
                              <select
                                value={tempOrderStatus}
                                onChange={(e) => setTempOrderStatus(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm min-w-0 flex-1 sm:flex-none"
                              >
                                <option value="pending">🟫 待處理</option>
                                <option value="processing">🔵 處理中</option>
                                <option value="shipped">🟣 已出貨</option>
                                <option value="delivered">🟢 已送達</option>
                                <option value="cancelled">🔴 已取消</option>
                              </select>
                            </div>
                            {/* 當選擇已取消時，顯示取消備注輸入框 */}
                            {tempOrderStatus === 'cancelled' && (
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">取消備注</label>
                                <input
                                  type="text"
                                  value={tempCancellationNote}
                                  onChange={(e) => setTempCancellationNote(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm"
                                  placeholder="請輸入取消原因或備注..."
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* 第二行：香水名稱和貨號 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">香水名稱</label>
                              <select
                                value={tempPerfumeName}
                                onChange={(e) => setTempPerfumeName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm"
                                disabled={loadingPerfumes}
                              >
                                <option value="">選擇香水...</option>
                                {perfumes.map((perfume, index) => {
                                  const displayText = perfume.number 
                                    ? `${perfume.number} - ${perfume.name}${perfume.brand ? ` (${perfume.brand})` : ''}`
                                    : perfume.name
                                  return (
                                    <option key={index} value={perfume.name}>
                                      {displayText}
                                    </option>
                                  )
                                })}
                              </select>
                              {loadingPerfumes && (
                                <p className="text-xs text-gray-500 mt-1">載入香水中...</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">貨號</label>
                              <input
                                type="text"
                                value={tempShopifyOrderId}
                                onChange={(e) => setTempShopifyOrderId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent text-sm"
                                placeholder="輸入貨號..."
                              />
                            </div>
                          </div>
                          
                          {/* 第三行：按鈕和時間 */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSaveStatus(order.id)}
                                size="sm"
                                className="bg-[#A69E8B] hover:bg-[#8A7B6C] text-white text-xs sm:text-sm"
                              >
                                儲存
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                variant="outline"
                                size="sm"
                                className="text-xs sm:text-sm"
                              >
                                取消
                              </Button>
                            </div>
                            <div className="text-xs text-gray-500 sm:ml-auto">
                              最後更新: {order.updated_at ? new Date(order.updated_at).toLocaleString("zh-TW") : '無'}
                            </div>
                          </div>
                        </div>
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

      {/* 創建訂單對話框 */}
      <CreateOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onOrderCreated={() => {
          loadOrders(true)
          setShowCreateDialog(false)
        }}
      />

      {/* 訂閱者管理對話框 */}
      <SubscribersDialog
        open={showSubscribersDialog}
        onClose={() => {
          setShowSubscribersDialog(false)
          loadSubscribersCount() // 關閉時重新載入數量
        }}
      />

      {/* 合作對象出貨對話框 */}
      <PartnerShippingDialog
        open={showPartnerShippingDialog}
        onClose={() => {
          setShowPartnerShippingDialog(false)
        }}
      />
    </div>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  )
}
