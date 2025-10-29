import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 開始自動生成訂單...")
    
    // 計算10天後的日期
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = now.getMonth()
    const todayDay = now.getDate()
    const todayOnly = new Date(todayYear, todayMonth, todayDay)
    todayOnly.setHours(0, 0, 0, 0)
    
    const tenDaysLater = new Date(todayOnly)
    tenDaysLater.setDate(tenDaysLater.getDate() + 10)
    
    console.log("📅 今天:", todayOnly.toLocaleDateString('zh-TW'), `(${todayOnly.toISOString()})`)
    console.log("📅 10天後:", tenDaysLater.toLocaleDateString('zh-TW'), `(${tenDaysLater.toISOString()})`)
    
    // 獲取所有活躍訂閱者
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
    console.log("📊 所有活躍訂閱者詳細資訊:", JSON.stringify(allActiveSubscribers.map((s: any) => ({
      name: s.name,
      email: s.email,
      subscription_status: s.subscription_status,
      next_payment_date: s.next_payment_date,
      monthly_fee: s.monthly_fee
    })), null, 2))
    
    // 在應用層面過濾出10天內要付款的訂閱者
    const subscribers = allActiveSubscribers.filter((subscriber: any) => {
      if (!subscriber.next_payment_date) {
        console.log(`⚠️ 訂閱者 ${subscriber.name} 沒有 next_payment_date`)
        return false
      }
      
      // 解析付款日期（處理UTC和本地時間）
      const paymentDate = new Date(subscriber.next_payment_date)
      
      // 獲取日期部分（年月日），忽略時間和時區
      const paymentYear = paymentDate.getFullYear()
      const paymentMonth = paymentDate.getMonth()
      const paymentDay = paymentDate.getDate()
      const paymentDateOnly = new Date(paymentYear, paymentMonth, paymentDay)
      paymentDateOnly.setHours(0, 0, 0, 0)
      
      // 檢查是否在10天內（包括今天和10天後）
      const isWithinRange = paymentDateOnly >= todayOnly && paymentDateOnly <= tenDaysLater
      
      // 詳細調試信息
      console.log(`🔍 檢查訂閱者: ${subscriber.name}`)
      console.log(`   原始付款日期: ${subscriber.next_payment_date}`)
      console.log(`   解析後的付款日期: ${paymentDateOnly.toISOString()}`)
      console.log(`   本地日期: ${paymentDateOnly.toLocaleDateString('zh-TW')}`)
      console.log(`   今天: ${todayOnly.toLocaleDateString('zh-TW')}`)
      console.log(`   10天後: ${tenDaysLater.toLocaleDateString('zh-TW')}`)
      console.log(`   是否在範圍內: ${isWithinRange}`)
      
      if (isWithinRange) {
        console.log(`✅ 找到10天內要付款的訂閱者: ${subscriber.name}, 付款日期: ${subscriber.next_payment_date}`)
      }
      
      return isWithinRange
    })
    
    console.log("📅 今天:", todayOnly.toLocaleDateString('zh-TW'), `(${todayOnly.toISOString()})`)
    console.log("📅 10天後:", tenDaysLater.toLocaleDateString('zh-TW'), `(${tenDaysLater.toISOString()})`)
    console.log("📊 符合10天內付款條件的訂閱者數量:", subscribers.length)
    console.log("📊 符合條件的訂閱者:", JSON.stringify(subscribers.map((s: any) => ({ 
      name: s.name, 
      email: s.email, 
      next_payment_date: s.next_payment_date 
    })), null, 2))
    
    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '沒有10天內要付款的訂閱者需要生成訂單',
        generatedOrders: 0,
        skippedOrders: 0,
        totalProcessed: 0
      })
    }

    let generatedOrders = 0
    let skippedOrders = 0
    const errors: string[] = []

    for (const subscriber of subscribers) {
      try {
        console.log(`\n🔄 處理訂閱者: ${subscriber.name}`)
        console.log(`   付款日期: ${subscriber.next_payment_date}`)
        console.log(`   月費: ${subscriber.monthly_fee}`)
        console.log(`   配送方式: ${subscriber.delivery_method}`)
        
        // 檢查是否已經有相同訂閱者的待處理或處理中訂單
        const existingOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,order_status&subscriber_name=eq.${encodeURIComponent(subscriber.name)}&order_status=in.(pending,processing)`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        })

        if (existingOrderResponse.ok) {
          const existingOrders = await existingOrderResponse.json()
          console.log(`   現有訂單數量: ${existingOrders.length}`)
          if (existingOrders && existingOrders.length > 0) {
            const pendingOrders = existingOrders.filter((order: any) => order.order_status === 'pending')
            const processingOrders = existingOrders.filter((order: any) => order.order_status === 'processing')
            
            if (pendingOrders.length > 0) {
              console.log(`   ⏭️ 跳過 ${subscriber.name} - 已有待處理訂單`)
            } else if (processingOrders.length > 0) {
              console.log(`   ⏭️ 跳過 ${subscriber.name} - 已有處理中訂單`)
            }
            skippedOrders++
            continue // 跳過已存在待處理或處理中訂單的訂閱者
          }
        } else {
          console.log(`   ❌ 檢查現有訂單失敗: ${existingOrderResponse.status}`)
        }

        // 生成新的訂單ID
        const orderId = crypto.randomUUID()
        
        // 生成Shopify訂單ID格式 (H + 7位數字)
        const shopifyOrderId = 'H' + Math.floor(1000000 + Math.random() * 9000000).toString()

        // 創建新訂單
        const newOrder: any = {
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ratings: null,
          last_checked: new Date().toISOString()
        }

        // 只有當配送方式是宅配時才添加shipping_address
        if (subscriber.delivery_method === 'home' && subscriber.address) {
          newOrder.shipping_address = subscriber.address
        }

        console.log(`   📦 準備創建訂單:`, JSON.stringify(newOrder, null, 2))

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
          console.log(`   ✅ 為 ${subscriber.name} 生成訂單成功`)
        } else {
          const errorText = await createOrderResponse.text()
          console.log(`   ❌ 為 ${subscriber.name} 創建訂單失敗: ${errorText}`)
          errors.push(`為 ${subscriber.name} 創建訂單失敗: ${errorText}`)
        }

      } catch (err) {
        console.log(`   ❌ 處理 ${subscriber.name} 時發生錯誤:`, err)
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
