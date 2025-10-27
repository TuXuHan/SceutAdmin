import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 開始自動生成訂單...")
    
    // 計算10天後的日期
    const tenDaysFromNow = new Date()
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)
    
    // 獲取下次付款時間在10天內的活躍訂閱者
    // 使用 gte 來獲取 next_payment_date 大於等於今天且小於等於10天後的訂閱者
    const today = new Date().toISOString()
    console.log("📅 今天:", today)
    console.log("📅 10天後:", tenDaysFromNow.toISOString())
    
    // 先檢查所有活躍訂閱者
    const allActiveSubscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*&subscription_status=eq.active`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!allActiveSubscribersResponse.ok) {
      throw new Error(`獲取活躍訂閱者資料失敗: ${allActiveSubscribersResponse.statusText}`)
    }

    const allActiveSubscribers = await allActiveSubscribersResponse.json()
    console.log("📊 所有活躍訂閱者數量:", allActiveSubscribers.length)
    console.log("📊 所有活躍訂閱者:", JSON.stringify(allActiveSubscribers, null, 2))
    
    // 獲取下次付款時間在10天內的活躍訂閱者
    const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*&subscription_status=eq.active&next_payment_date=gte.${today}&next_payment_date=lte.${tenDaysFromNow.toISOString()}`, {
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
    console.log("📊 符合條件的訂閱者數量:", subscribers.length)
    console.log("📊 符合條件的訂閱者:", JSON.stringify(subscribers, null, 2))
    
    if (!subscribers || subscribers.length === 0) {
      // 如果沒有符合條件的訂閱者，嘗試為所有活躍訂閱者生成訂單（如果他們沒有待處理訂單）
      console.log("⚠️ 沒有符合10天內付款條件的訂閱者，嘗試為所有活躍訂閱者生成訂單...")
      
      let generatedOrders = 0
      let skippedOrders = 0
      const errors: string[] = []

      for (const subscriber of allActiveSubscribers) {
        try {
          // 檢查是否已經有相同訂閱者的待處理訂單
          const existingOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&subscriber_name=eq.${encodeURIComponent(subscriber.name)}&order_status=eq.pending`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          })

          if (existingOrderResponse.ok) {
            const existingOrders = await existingOrderResponse.json()
            if (existingOrders && existingOrders.length > 0) {
              skippedOrders++
              continue // 跳過已存在待處理訂單的訂閱者
            }
          }

          // 生成新的訂單ID
          const orderId = crypto.randomUUID()
          
          // 生成Shopify訂單ID格式 (H + 7位數字)
          const shopifyOrderId = 'H' + Math.floor(1000000 + Math.random() * 9000000).toString()

          // 創建新訂單
          const newOrder = {
            id: orderId,
            shopify_order_id: shopifyOrderId,
            customer_email: subscriber.email,
            customer_phone: subscriber.phone || null,
            total_price: subscriber.monthly_fee || '599.00',
            currency: 'TWD',
            order_status: 'pending',
            subscriber_name: subscriber.name,
            user_id: subscriber.user_id,
            perfume_name: null,
            delivery_method: subscriber.delivery_method || null,
            "711": subscriber["711"] || null,
            shipping_address: subscriber.delivery_method === 'home' ? subscriber.address : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ratings: null,
            last_checked: new Date().toISOString()
          }

          const createOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(newOrder)
          })

          if (createOrderResponse.ok) {
            generatedOrders++
            console.log(`✅ 為 ${subscriber.name} 生成訂單成功`)
          } else {
            const errorText = await createOrderResponse.text()
            errors.push(`為 ${subscriber.name} 創建訂單失敗: ${errorText}`)
            console.error(`❌ 為 ${subscriber.name} 創建訂單失敗:`, errorText)
          }

        } catch (err) {
          errors.push(`處理 ${subscriber.name} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
          console.error(`❌ 處理 ${subscriber.name} 時發生錯誤:`, err)
        }
      }

      return NextResponse.json({
        success: true,
        message: `自動訂單生成完成（為所有活躍訂閱者）`,
        generatedOrders,
        skippedOrders,
        totalProcessed: allActiveSubscribers.length,
        errors: errors.length > 0 ? errors : undefined
      })
    }

    let generatedOrders = 0
    let skippedOrders = 0
    const errors: string[] = []

    for (const subscriber of subscribers) {
      try {
        // 檢查是否已經有相同訂閱者的待處理訂單
        const existingOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&subscriber_name=eq.${encodeURIComponent(subscriber.name)}&order_status=eq.pending`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (existingOrderResponse.ok) {
          const existingOrders = await existingOrderResponse.json()
          if (existingOrders && existingOrders.length > 0) {
            skippedOrders++
            continue // 跳過已存在待處理訂單的訂閱者
          }
        }

        // 生成新的訂單ID
        const orderId = crypto.randomUUID()
        
        // 生成Shopify訂單ID格式 (H + 7位數字)
        const shopifyOrderId = 'H' + Math.floor(1000000 + Math.random() * 9000000).toString()

        // 創建新訂單
        const newOrder = {
          id: orderId,
          shopify_order_id: shopifyOrderId,
          customer_email: subscriber.email,
          customer_phone: subscriber.phone || null,
          total_price: subscriber.monthly_fee || '599.00',
          currency: 'TWD',
          order_status: 'pending',
          subscriber_name: subscriber.name,
          user_id: subscriber.user_id,
          perfume_name: null,
          delivery_method: subscriber.delivery_method || null,
          "711": subscriber["711"] || null,
          shipping_address: subscriber.delivery_method === 'home' ? subscriber.address : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ratings: null,
          last_checked: new Date().toISOString()
        }

        const createOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(newOrder)
        })

        if (createOrderResponse.ok) {
          generatedOrders++
        } else {
          const errorText = await createOrderResponse.text()
          errors.push(`為 ${subscriber.name} 創建訂單失敗: ${errorText}`)
        }

      } catch (err) {
        errors.push(`處理 ${subscriber.name} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `自動訂單生成完成`,
      generatedOrders,
      skippedOrders,
      totalProcessed: subscribers.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error("❌ 自動生成訂單失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "自動生成訂單失敗" 
      },
      { status: 500 }
    )
  }
}
