"use client"

import { useState, useEffect } from "react"

export default function TestPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testSupabaseConnection = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabaseUrl = "https://bbrnbyzjmxgxnczzymdt.supabase.co"
        const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"
        
        const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&limit=5`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log("✅ Supabase連接成功:", data)
          setOrders(data || [])
        } else {
          console.error("❌ Supabase連接失敗:", response.status, response.statusText)
          setError(`連接失敗: ${response.status} ${response.statusText}`)
        }
      } catch (err) {
        console.error("❌ 連接錯誤:", err)
        setError(err instanceof Error ? err.message : "未知錯誤")
      } finally {
        setLoading(false)
      }
    }

    testSupabaseConnection()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">測試Supabase連接中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F2ED] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-light text-gray-800 mb-8">Supabase連接測試</h1>
        
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="text-red-800 font-medium mb-2">連接失敗</h2>
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h2 className="text-green-800 font-medium mb-2">✅ 連接成功</h2>
            <p className="text-green-600">成功連接到Supabase orders表</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-medium text-gray-800 mb-4">訂單資料 ({orders.length} 筆)</h2>
          
          {orders.length === 0 ? (
            <p className="text-gray-600">沒有找到訂單資料</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => (
                <div key={order.id || index} className="border rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">ID:</span>
                      <span className="ml-2 text-gray-600">{order.id}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">客戶姓名:</span>
                      <span className="ml-2 text-gray-600">{order.subscriber_name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="ml-2 text-gray-600">{order.customer_email}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">狀態:</span>
                      <span className="ml-2 text-gray-600">{order.order_status}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">金額:</span>
                      <span className="ml-2 text-gray-600">{order.currency || 'NT$'} {order.total_price}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Shopify ID:</span>
                      <span className="ml-2 text-gray-600">{order.shopify_order_id || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
