"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, User, Mail, Phone, MapPin, Package, Plus, X } from "lucide-react"

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  postal_code?: string
  country?: string
  "711"?: string
  delivery_method?: string
  created_at: string
  updated_at: string
  // 訂閱相關資訊
  subscription_status?: string
  monthly_fee?: string
  next_payment_date?: string
  // 標記是否為合作對象
  isPartner?: boolean
}

interface CreateOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderCreated: () => void
}

export function CreateOrderDialog({ open, onOpenChange, onOrderCreated }: CreateOrderDialogProps) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [partners, setPartners] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showUserList, setShowUserList] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 訂單表單資料
  const [orderData, setOrderData] = useState({
    shopify_order_id: "",
    subscriber_name: "",
    customer_email: "",
    customer_phone: "",
    shipping_address: "",
    city: "",
    "711": "",
    delivery_method: "",
    total_price: "",
    currency: "TWD",
    order_status: "pending",
    perfume_name: "",
    notes: ""
  })

  // 載入用戶列表（訂閱者）
  const loadUsers = async (search: string = "") => {
    try {
      setLoading(true)
      const response = await fetch(`/api/users${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const result = await response.json()
      
      if (result.success) {
        // 標記為訂閱者
        const subscribers = result.users.map((user: UserProfile) => ({
          ...user,
          isPartner: false
        }))
        setUsers(subscribers)
      }
    } catch (error) {
      console.error('載入訂閱者失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  // 載入合作對象列表
  const loadPartners = async (search: string = "") => {
    try {
      const response = await fetch(`/api/partner-list${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const result = await response.json()
      
      if (result.success) {
        // 將合作對象轉換為與 UserProfile 相容的格式
        const partnerProfiles = result.partners.map((partner: any) => ({
          id: partner.user_id || partner.id,
          name: partner.name || "",
          email: partner.email || "",
          phone: partner.phone || "",
          address: partner.address || "",
          city: partner.city || "",
          postal_code: partner.postal_code || "",
          country: partner.country || "",
          "711": partner["711"] || "",
          delivery_method: partner.delivery_method || "",
          created_at: partner.created_at || new Date().toISOString(),
          updated_at: partner.updated_at || new Date().toISOString(),
          subscription_status: partner.subscription_status || "active",
          monthly_fee: partner.monthly_fee || "599",
          next_payment_date: partner.next_payment_date || null,
          isPartner: true
        }))
        setPartners(partnerProfiles)
      }
    } catch (error) {
      console.error('載入合作對象失敗:', error)
    }
  }

  // 載入所有用戶（訂閱者 + 合作對象）
  const loadAllUsers = async (search: string = "") => {
    await Promise.all([
      loadUsers(search),
      loadPartners(search)
    ])
  }

  // 當 searchTerm 改變時，從 API 搜索（防抖處理）
  useEffect(() => {
    if (searchTerm.length > 0) {
      const searchTimeout = setTimeout(() => {
        loadAllUsers(searchTerm)
      }, 300) // 防抖處理
      
      return () => clearTimeout(searchTimeout)
    } else {
      // 沒有搜索詞時，重新載入所有用戶
      loadAllUsers()
    }
  }, [searchTerm])

  // 當 users 或 partners 更新時，更新過濾列表
  useEffect(() => {
    const allUsers = [...users, ...partners]
    if (searchTerm.length === 0) {
      // 沒有搜索詞時，顯示所有用戶
      setFilteredUsers(allUsers)
    } else {
      // 如果有搜索詞，在前端也進行過濾（API 已經過濾，這裡作為雙重保障）
      const filtered = allUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredUsers(filtered)
    }
  }, [users, partners, searchTerm])

  // 選擇用戶
  const selectUser = (user: UserProfile) => {
    setSelectedUser(user)
    setSearchTerm(user.name)
    setShowUserList(false)
    
    // 自動填寫用戶資料
    setOrderData(prev => ({
      ...prev,
      subscriber_name: user.name,
      customer_email: user.email,
      customer_phone: user.phone || "",
      shipping_address: user.address || "",
      city: user.city || "",
      "711": user["711"] || "",
      delivery_method: user.delivery_method || ""
    }))
  }

  // 清除選擇的用戶
  const clearSelectedUser = () => {
    setSelectedUser(null)
    setSearchTerm("")
    setOrderData(prev => ({
      ...prev,
      subscriber_name: "",
      customer_email: "",
      customer_phone: "",
      shipping_address: "",
      city: "",
      "711": "",
      delivery_method: ""
    }))
  }

  // 提交訂單
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      
      const orderPayload = {
        shopify_order_id: orderData.shopify_order_id,
        subscriber_name: orderData.subscriber_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone || null,
        total_price: parseFloat(orderData.total_price) || 0,
        currency: orderData.currency || 'TWD',
        order_status: orderData.order_status || 'pending',
        user_id: selectedUser?.id || null,
        perfume_name: orderData.perfume_name || null,
        delivery_method: orderData.delivery_method || null,
        "711": orderData["711"] || null
      }
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      })

      const result = await response.json()
      
      if (result.success) {
        onOrderCreated()
        onOpenChange(false)
        // 重置表單
        setOrderData({
          shopify_order_id: "",
          subscriber_name: "",
          customer_email: "",
          customer_phone: "",
          shipping_address: "",
          city: "",
          "711": "",
          delivery_method: "",
          total_price: "",
          currency: "TWD",
          order_status: "pending",
          perfume_name: "",
          notes: ""
        })
        clearSelectedUser()
      } else {
        console.error('創建訂單失敗:', result.error)
      }
    } catch (error) {
      console.error('創建訂單時發生錯誤:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // 當對話框打開時載入用戶（訂閱者 + 合作對象）
  useEffect(() => {
    if (open) {
      loadAllUsers()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            創建新訂單
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 用戶選擇區域 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">選擇訂閱者或合作對象</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜尋訂閱者或合作對象姓名或Email..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setShowUserList(true)
                  }}
                  onFocus={() => setShowUserList(true)}
                  className="pl-10"
                />
                {selectedUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedUser}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* 用戶列表 */}
              {showUserList && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-center text-gray-500">載入中...</div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectUser(user)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium">{user.name}</div>
                              {user.isPartner ? (
                                <Badge 
                                  variant="default"
                                  className="text-xs bg-blue-100 text-blue-800 border-blue-300"
                                >
                                  合作對象
                                </Badge>
                              ) : user.subscription_status && (
                                <Badge 
                                  variant={user.subscription_status === 'active' ? 'default' : 'secondary'}
                                  className={`text-xs ${
                                    user.subscription_status === 'active' 
                                      ? 'bg-green-100 text-green-800 border-green-300' 
                                      : 'bg-gray-100 text-gray-800 border-gray-300'
                                  }`}
                                >
                                  {user.subscription_status === 'active' ? '✓ 已訂閱' : '⏳ 待訂閱'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            {user.monthly_fee && (
                              <div className="text-xs text-gray-400">月費: NT$ {user.monthly_fee}</div>
                            )}
                            {user.next_payment_date && (
                              <div className="text-xs text-gray-400">
                                下次付款: {new Date(user.next_payment_date).toLocaleDateString("zh-TW")}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline">選擇</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">沒有找到訂閱者或合作對象</div>
                  )}
                </div>
              )}

              {/* 已選擇的用戶 */}
              {selectedUser && (
                <div className={`p-4 border rounded-lg ${
                  selectedUser.isPartner 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <User className={`w-4 h-4 ${selectedUser.isPartner ? 'text-blue-600' : 'text-green-600'}`} />
                    <span className={`font-medium ${selectedUser.isPartner ? 'text-blue-800' : 'text-green-800'}`}>
                      {selectedUser.isPartner ? '已選擇合作對象' : '已選擇訂閱者'}
                    </span>
                    {selectedUser.isPartner ? (
                      <Badge 
                        variant="default"
                        className="text-xs bg-blue-100 text-blue-800 border-blue-300"
                      >
                        合作對象
                      </Badge>
                    ) : selectedUser.subscription_status && (
                      <Badge 
                        variant={selectedUser.subscription_status === 'active' ? 'default' : 'secondary'}
                        className={`text-xs ${
                          selectedUser.subscription_status === 'active' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}
                      >
                        {selectedUser.subscription_status === 'active' ? '✓ 已訂閱' : '⏳ 待訂閱'}
                      </Badge>
                    )}
                  </div>
                  <div className={`text-sm space-y-1 ${
                    selectedUser.isPartner ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    <div>姓名: {selectedUser.name}</div>
                    <div>Email: {selectedUser.email}</div>
                    {selectedUser.phone && <div>電話: {selectedUser.phone}</div>}
                    {selectedUser.city && <div>縣市: {selectedUser.city}</div>}
                    {selectedUser.delivery_method && (
                      <div>配送方式: {selectedUser.delivery_method === 'home' ? '宅配' : selectedUser.delivery_method === '711' ? '7-11超商' : selectedUser.delivery_method}</div>
                    )}
                    {selectedUser.delivery_method === 'home' && selectedUser.address && (
                      <div>配送地址: {selectedUser.address}</div>
                    )}
                    {selectedUser.delivery_method === '711' && selectedUser["711"] && (
                      <div>7-11門市: {selectedUser["711"]}</div>
                    )}
                    {selectedUser.monthly_fee && <div>月費: NT$ {selectedUser.monthly_fee}</div>}
                    {selectedUser.next_payment_date && (
                      <div>下次付款: {new Date(selectedUser.next_payment_date).toLocaleDateString("zh-TW")}</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 訂單資料表單 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">訂單資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shopify_order_id">貨號 (Shopify Order ID)</Label>
                  <Input
                    id="shopify_order_id"
                    value={orderData.shopify_order_id}
                    onChange={(e) => setOrderData(prev => ({ ...prev, shopify_order_id: e.target.value }))}
                    placeholder="輸入貨號..."
                  />
                </div>
                <div>
                  <Label htmlFor="perfume_name">香水名稱</Label>
                  <Input
                    id="perfume_name"
                    value={orderData.perfume_name}
                    onChange={(e) => setOrderData(prev => ({ ...prev, perfume_name: e.target.value }))}
                    placeholder="輸入香水名稱..."
                  />
                </div>
                <div>
                  <Label htmlFor="subscriber_name">訂購人姓名 *</Label>
                  <Input
                    id="subscriber_name"
                    value={orderData.subscriber_name}
                    onChange={(e) => setOrderData(prev => ({ ...prev, subscriber_name: e.target.value }))}
                    placeholder="訂購人姓名"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customer_email">Email *</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={orderData.customer_email}
                    onChange={(e) => setOrderData(prev => ({ ...prev, customer_email: e.target.value }))}
                    placeholder="Email地址"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customer_phone">電話</Label>
                  <Input
                    id="customer_phone"
                    value={orderData.customer_phone}
                    onChange={(e) => setOrderData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="電話號碼"
                  />
                </div>
                <div>
                  <Label htmlFor="city">縣市</Label>
                  <Input
                    id="city"
                    value={orderData.city}
                    onChange={(e) => setOrderData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="縣市"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_method">配送方式</Label>
                  <select
                    id="delivery_method"
                    value={orderData.delivery_method}
                    onChange={(e) => setOrderData(prev => ({ ...prev, delivery_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent"
                  >
                    <option value="">選擇配送方式</option>
                    <option value="home">宅配</option>
                    <option value="711">7-11超商</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="711">7-11門市</Label>
                  <Input
                    id="711"
                    value={orderData["711"]}
                    onChange={(e) => setOrderData(prev => ({ ...prev, "711": e.target.value }))}
                    placeholder="7-11門市名稱"
                    disabled={orderData.delivery_method !== '711'}
                  />
                </div>
                <div>
                  <Label htmlFor="shipping_address">配送地址</Label>
                  <Input
                    id="shipping_address"
                    value={orderData.shipping_address}
                    onChange={(e) => setOrderData(prev => ({ ...prev, shipping_address: e.target.value }))}
                    placeholder={orderData.delivery_method === 'home' ? '完整配送地址' : '配送地址'}
                    disabled={orderData.delivery_method === '711'}
                  />
                </div>
                <div>
                  <Label htmlFor="total_price">總金額 *</Label>
                  <Input
                    id="total_price"
                    type="number"
                    value={orderData.total_price}
                    onChange={(e) => setOrderData(prev => ({ ...prev, total_price: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">幣別</Label>
                  <select
                    id="currency"
                    value={orderData.currency}
                    onChange={(e) => setOrderData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent"
                  >
                    <option value="TWD">TWD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="order_status">訂單狀態</Label>
                  <select
                    id="order_status"
                    value={orderData.order_status}
                    onChange={(e) => setOrderData(prev => ({ ...prev, order_status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent"
                  >
                    <option value="pending">待處理</option>
                    <option value="processing">處理中</option>
                    <option value="shipped">已出貨</option>
                    <option value="delivered">已送達</option>
                    <option value="cancelled">已取消</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">備註</Label>
                <textarea
                  id="notes"
                  value={orderData.notes}
                  onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="訂單備註..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#A69E8B] focus:border-transparent"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitting || !orderData.subscriber_name || !orderData.customer_email || !orderData.total_price}
              className="bg-[#A69E8B] hover:bg-[#8A7B6C] text-white"
            >
              {submitting ? "創建中..." : "創建訂單"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
