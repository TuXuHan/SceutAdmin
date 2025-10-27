import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 開始檢查待處理訂單完整性...")
    
    // 1. 獲取所有待處理訂單
    const pendingOrdersResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order_status=eq.pending`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!pendingOrdersResponse.ok) {
      throw new Error(`獲取待處理訂單失敗: ${pendingOrdersResponse.statusText}`)
    }

    const pendingOrders = await pendingOrdersResponse.json()
    console.log("📊 待處理訂單數量:", pendingOrders.length)

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '沒有待處理訂單需要檢查',
        completedOrders: 0,
        skippedOrders: 0,
        totalProcessed: 0
      })
    }

    // 2. 獲取所有訂閱者資料
    const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!subscribersResponse.ok) {
      throw new Error(`獲取訂閱者資料失敗: ${subscribersResponse.statusText}`)
    }

    const subscribers = await subscribersResponse.json()
    console.log("📊 訂閱者數量:", subscribers.length)

    let completedOrders = 0
    let skippedOrders = 0
    const errors: string[] = []

    // 3. 檢查每個待處理訂單的完整性
    for (const order of pendingOrders) {
      try {
        // 找到對應的訂閱者
        const subscriber = subscribers.find((sub: any) => 
          sub.name === order.subscriber_name || 
          sub.email === order.customer_email ||
          sub.user_id === order.user_id
        )

        if (!subscriber) {
          console.log(`⚠️ 找不到訂單 ${order.id} 對應的訂閱者`)
          skippedOrders++
          continue
        }

        // 檢查需要補齊的欄位
        const updateData: any = {}
        let needsUpdate = false

        // 檢查電話號碼
        if (!order.customer_phone && subscriber.phone) {
          updateData.customer_phone = subscriber.phone
          needsUpdate = true
          console.log(`📞 補齊訂單 ${order.id} 的電話號碼: ${subscriber.phone}`)
        }

        // 檢查配送方式
        if (!order.delivery_method && subscriber.delivery_method) {
          updateData.delivery_method = subscriber.delivery_method
          needsUpdate = true
          console.log(`🚚 補齊訂單 ${order.id} 的配送方式: ${subscriber.delivery_method}`)
        }

        // 檢查7-11門市資訊
        if (!order["711"] && subscriber["711"]) {
          updateData["711"] = subscriber["711"]
          needsUpdate = true
          console.log(`🏪 補齊訂單 ${order.id} 的7-11門市: ${subscriber["711"]}`)
        }

        // 檢查配送地址
        if (!order.shipping_address && subscriber.address && subscriber.delivery_method === 'home') {
          updateData.shipping_address = subscriber.address
          needsUpdate = true
          console.log(`🏠 補齊訂單 ${order.id} 的配送地址: ${subscriber.address}`)
        }

        // 檢查訂單金額
        if (!order.total_price && subscriber.monthly_fee) {
          updateData.total_price = subscriber.monthly_fee
          needsUpdate = true
          console.log(`💰 補齊訂單 ${order.id} 的訂單金額: ${subscriber.monthly_fee}`)
        }

        // 檢查貨幣
        if (!order.currency) {
          updateData.currency = 'TWD'
          needsUpdate = true
          console.log(`💱 補齊訂單 ${order.id} 的貨幣: TWD`)
        }

        // 如果有需要更新的資料，執行更新
        if (needsUpdate) {
          updateData.updated_at = new Date().toISOString()

          const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(updateData)
          })

          if (updateResponse.ok) {
            completedOrders++
            console.log(`✅ 成功補齊訂單 ${order.id} 的資訊`)
          } else {
            const errorText = await updateResponse.text()
            errors.push(`更新訂單 ${order.id} 失敗: ${errorText}`)
            console.error(`❌ 更新訂單 ${order.id} 失敗:`, errorText)
          }
        } else {
          skippedOrders++
          console.log(`ℹ️ 訂單 ${order.id} 資訊已完整，跳過`)
        }

      } catch (err) {
        errors.push(`處理訂單 ${order.id} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
        console.error(`❌ 處理訂單 ${order.id} 時發生錯誤:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      message: `待處理訂單完整性檢查完成`,
      completedOrders,
      skippedOrders,
      totalProcessed: pendingOrders.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error("❌ 檢查待處理訂單完整性失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "檢查待處理訂單完整性失敗" 
      },
      { status: 500 }
    )
  }
}
