import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 開始自動生成訂單...")
    
    // 計算3天後的日期（包含今天）
    const now = new Date()
    const todayYear = now.getFullYear()
    const todayMonth = now.getMonth()
    const todayDay = now.getDate()
    const todayOnly = new Date(todayYear, todayMonth, todayDay)
    todayOnly.setHours(0, 0, 0, 0)
    
    const threeDaysLater = new Date(todayOnly)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    
    console.log("📅 今天:", todayOnly.toLocaleDateString('zh-TW'), `(${todayOnly.toISOString()})`)
    console.log("📅 3天後:", threeDaysLater.toLocaleDateString('zh-TW'), `(${threeDaysLater.toISOString()})`)
    
    // 獲取所有活躍訂閱者（包含 active 和 paid 狀態）
    // 使用 OR 條件來獲取兩種狀態的訂閱者
    const allActiveSubscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*&subscription_status=in.(active,paid)`, {
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
    console.log("📊 所有活躍訂閱者數量 (active + paid):", allActiveSubscribers.length)
    console.log("📊 所有活躍訂閱者詳細資訊:", JSON.stringify(allActiveSubscribers.map((s: any) => ({
      name: s.name,
      email: s.email,
      subscription_status: s.subscription_status,
      next_payment_date: s.next_payment_date,
      monthly_fee: s.monthly_fee
    })), null, 2))
    
    // 獲取所有合作對象（從 partner_list 表）
    // 包含 active 和 paid 狀態，確保不遺漏任何合作對象
    const partnersResponse = await fetch(`${SUPABASE_URL}/rest/v1/partner_list?select=*&subscription_status=in.(active,paid)`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    let partners: any[] = []
    if (partnersResponse.ok) {
      partners = await partnersResponse.json()
      console.log("📊 所有合作對象數量 (active + paid):", partners.length)
      
      // 如果沒有找到任何合作對象，嘗試獲取所有（不限制狀態）來檢查
      if (partners.length === 0) {
        const allPartnersResponse = await fetch(`${SUPABASE_URL}/rest/v1/partner_list?select=*`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        if (allPartnersResponse.ok) {
          const allPartners = await allPartnersResponse.json()
          console.log(`📊 所有合作對象（不限狀態）: ${allPartners.length} 筆`)
          if (allPartners.length > 0) {
            console.log("⚠️ 注意：有合作對象但狀態不是 active/paid，可能被遺漏")
          }
        }
      }
    } else {
      console.warn("⚠️ 獲取合作對象失敗:", partnersResponse.statusText)
    }

    // 在應用層面過濾出3天內要付款的訂閱者
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
      
      // 檢查是否在3天內（包括今天和3天後）
      const isWithinRange = paymentDateOnly >= todayOnly && paymentDateOnly <= threeDaysLater
      
      // 詳細調試信息
      console.log(`🔍 檢查訂閱者: ${subscriber.name}`)
      console.log(`   原始付款日期: ${subscriber.next_payment_date}`)
      console.log(`   解析後的付款日期: ${paymentDateOnly.toISOString()}`)
      console.log(`   本地日期: ${paymentDateOnly.toLocaleDateString('zh-TW')}`)
      console.log(`   今天: ${todayOnly.toLocaleDateString('zh-TW')}`)
      console.log(`   3天後: ${threeDaysLater.toLocaleDateString('zh-TW')}`)
      console.log(`   是否在範圍內: ${isWithinRange}`)
      
      if (isWithinRange) {
        console.log(`✅ 找到3天內要付款的訂閱者: ${subscriber.name}, 付款日期: ${subscriber.next_payment_date}`)
      }
      
      return isWithinRange
    })

    // 過濾出3天內要付款的合作對象
    const partnersForOrder = partners.filter((partner: any) => {
      if (!partner.next_payment_date) {
        return false
      }
      
      const paymentDate = new Date(partner.next_payment_date)
      const paymentYear = paymentDate.getFullYear()
      const paymentMonth = paymentDate.getMonth()
      const paymentDay = paymentDate.getDate()
      const paymentDateOnly = new Date(paymentYear, paymentMonth, paymentDay)
      paymentDateOnly.setHours(0, 0, 0, 0)
      
      return paymentDateOnly >= todayOnly && paymentDateOnly <= threeDaysLater
    })

    // 合併訂閱者和合作對象，轉換為統一的格式
    const allCustomers = [
      ...subscribers.map((s: any) => ({ ...s, source: 'subscriber' })),
      ...partnersForOrder.map((p: any) => ({ 
        ...p, 
        source: 'partner',
        user_id: p.user_id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        monthly_fee: p.monthly_fee || 599,
        delivery_method: p.delivery_method,
        "711": p["711"],
        address: p.address,
        next_payment_date: p.next_payment_date
      }))
    ]
    
    console.log("📊 符合3天內付款條件的訂閱者數量:", subscribers.length)
    console.log("📊 符合3天內付款條件的合作對象數量:", partnersForOrder.length)
    console.log("📊 符合條件的客戶:", JSON.stringify(allCustomers.map((s: any) => ({ 
      name: s.name, 
      email: s.email, 
      source: s.source,
      next_payment_date: s.next_payment_date 
    })), null, 2))
    
    if (!allCustomers || allCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '沒有3天內要付款的客戶需要生成訂單',
        generatedOrders: 0,
        skippedOrders: 0,
        totalProcessed: 0
      })
    }

    let generatedOrders = 0
    let skippedOrders = 0
    const errors: string[] = []

    for (const customer of allCustomers) {
      try {
        console.log(`\n🔄 處理客戶: ${customer.name} (${customer.source})`)
        console.log(`   付款日期: ${customer.next_payment_date}`)
        console.log(`   月費: ${customer.monthly_fee}`)
        console.log(`   配送方式: ${customer.delivery_method}`)
        
        // 檢查是否已經有相同訂閱者的待處理或處理中訂單
        const existingOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,order_status&subscriber_name=eq.${encodeURIComponent(customer.name)}&order_status=in.(pending,processing)`, {
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
              console.log(`   ⏭️ 跳過 ${customer.name} (${customer.source}) - 已有待處理訂單`)
            } else if (processingOrders.length > 0) {
              console.log(`   ⏭️ 跳過 ${customer.name} (${customer.source}) - 已有處理中訂單`)
            }
            skippedOrders++
            continue // 跳過已存在待處理或處理中訂單的客戶
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
          customer_email: customer.email,
          customer_phone: customer.phone || null,
          total_price: customer.monthly_fee || '599.00',
          currency: 'TWD',
          order_status: 'pending',
          subscriber_name: customer.name,
          user_id: customer.user_id || null,
          perfume_name: null,
          delivery_method: customer.delivery_method || null,
          "711": customer["711"] || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ratings: null,
          last_checked: new Date().toISOString()
        }

        // 只有當配送方式是宅配時才添加shipping_address
        if (customer.delivery_method === 'home' && customer.address) {
          newOrder.shipping_address = customer.address
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
          console.log(`   ✅ 為 ${customer.name} (${customer.source}) 生成訂單成功`)
        } else {
          const errorText = await createOrderResponse.text()
          console.log(`   ❌ 為 ${customer.name} (${customer.source}) 創建訂單失敗: ${errorText}`)
          errors.push(`為 ${customer.name} (${customer.source}) 創建訂單失敗: ${errorText}`)
        }

      } catch (err) {
        console.log(`   ❌ 處理 ${customer.name} (${customer.source}) 時發生錯誤:`, err)
        errors.push(`處理 ${customer.name} (${customer.source}) 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `自動訂單生成完成`,
      generatedOrders,
      skippedOrders,
      totalProcessed: allCustomers.length,
      subscribersCount: subscribers.length,
      partnersCount: partnersForOrder.length,
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
