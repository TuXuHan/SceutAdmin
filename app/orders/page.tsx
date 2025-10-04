"use client"

import { useState, useEffect } from "react"
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
  X
} from "lucide-react"
import { useDebouncedLoading } from "@/hooks/use-debounced-loading"
import { CreateOrderDialog } from "@/components/create-order-dialog"
import { SubscribersDialog } from "@/components/subscribers-dialog"

interface Order {
  id: string
  shopify_order_id?: string
  subscriber_name: string
  customer_email: string
  customer_phone?: string
  shipping_address?: string
  order_status: string
  total_price: number
  total_amount?: number  // 保持向後兼容
  currency?: string
  payment_status?: string
  shipping_status?: string
  notes?: string
  user_id?: string
  perfume_name?: string
  ratings?: any
  created_at?: string
  updated_at?: string
}

interface OrderStats {
  total: number
  pending: number
  processing: number
  shipped: number
  delivered: number
  cancelled: number
}

export default function OrdersPage() {
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
    cancelled: 0
  })
  const [error, setError] = useState<string | null>(null)
  const [isDatabaseConfigured, setIsDatabaseConfigured] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingOrder, setEditingOrder] = useState<string | null>(null)
  const [tempOrderStatus, setTempOrderStatus] = useState<string>("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSubscribersDialog, setShowSubscribersDialog] = useState(false)
  const [subscribersCount, setSubscribersCount] = useState(0)
  const { loading, startLoading, stopLoading, shouldSkipLoad, resetLoadingState } = useDebouncedLoading({
    debounceMs: 500,
    maxRetries: 1
  })

  // 計算各個order_status的函式
  const calculateOrderStats = (orders: Order[]): OrderStats => {
    return {
      total: orders.length,
      pending: orders.filter(order => order.order_status === 'pending').length,
      processing: orders.filter(order => order.order_status === 'processing').length,
      shipped: orders.filter(order => order.order_status === 'shipped' || order.order_status === 'shippped').length,
      delivered: orders.filter(order => order.order_status === 'delivered').length,
      cancelled: orders.filter(order => order.order_status === 'cancelled').length
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
      
      const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&order=updated_at.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setOrders(data || [])
        setFilteredOrders(data || [])
        
        const newStats = calculateOrderStats(data || [])
        setStats(newStats)
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

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.order_status === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [orders, searchTerm, statusFilter])

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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: orderId,
          order_status: newStatus
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === orderId 
                ? { ...order, order_status: newStatus, updated_at: result.order.updated_at }
                : order
            )
          )
          setEditingOrder(null)
          setTempOrderStatus("")
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
    await updateOrderStatus(orderId, tempOrderStatus)
  }

  const handleCancelEdit = () => {
    setEditingOrder(null)
    setTempOrderStatus("")
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => loadOrders(true)}
                className="flex items-center gap-2 text-sm"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">重新整理</span>
              </Button>
            </div>
          </div>

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
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h3 className="font-medium text-gray-800 text-sm sm:text-base">
                          訂單 #{order.shopify_order_id || order.id}
                        </h3>
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
                            } else {
                              setEditingOrder(order.id)
                              setTempOrderStatus(order.order_status)
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
                      {order.shipping_address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate max-w-xs">{order.shipping_address}</span>
                        </div>
                      )}
                    </div>

                    {/* 編輯狀態選單 */}
                    {editingOrder === order.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
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
    </div>
  )
}
