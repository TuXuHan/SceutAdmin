import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// POST - 檢查並更新缺少電話號碼的訂單
export async function POST(request: NextRequest) {
  try {
    // 1. 獲取所有訂單（包括缺少電話號碼的）
    const ordersResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=id,user_id,subscriber_name,customer_email,customer_phone`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!ordersResponse.ok) {
      throw new Error(`Failed to fetch orders: ${ordersResponse.status}`)
    }

    const allOrders = await ordersResponse.json()
    
    // 過濾出缺少電話號碼的訂單（null、空字符串或空白）
    const ordersWithoutPhone = allOrders.filter((order: any) => {
      const phone = order.customer_phone
      return !phone || (typeof phone === 'string' && phone.trim() === '')
    })
    
    if (ordersWithoutPhone.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有訂單都已有電話號碼',
        updated: 0,
        skipped: 0
      })
    }

    console.log(`📋 找到 ${ordersWithoutPhone.length} 個缺少電話號碼的訂單`)

    // 2. 獲取所有用戶資料
    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?select=id,phone,email,name`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    let profiles: any[] = []
    if (profilesResponse.ok) {
      profiles = await profilesResponse.json()
    }

    // 3. 獲取所有訂閱者資料
    const subscribersResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?select=user_id,phone,email,name`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    let subscribers: any[] = []
    if (subscribersResponse.ok) {
      subscribers = await subscribersResponse.json()
    }

    // 4. 建立查找表
    const phoneMap = new Map<string, string>()

    // 從 user_profiles 建立映射（使用 user_id）
    profiles.forEach((profile: any) => {
      if (profile.id && profile.phone) {
        phoneMap.set(profile.id, profile.phone)
      }
      // 也使用 email 作為備用查找
      if (profile.email && profile.phone) {
        phoneMap.set(`email:${profile.email.toLowerCase()}`, profile.phone)
      }
      // 使用 name 作為備用查找
      if (profile.name && profile.phone) {
        phoneMap.set(`name:${profile.name}`, profile.phone)
      }
    })

    // 從 subscribers 建立映射
    subscribers.forEach((subscriber: any) => {
      if (subscriber.user_id && subscriber.phone) {
        phoneMap.set(subscriber.user_id, subscriber.phone)
      }
      // 也使用 email 作為備用查找
      if (subscriber.email && subscriber.phone) {
        phoneMap.set(`email:${subscriber.email.toLowerCase()}`, subscriber.phone)
      }
      // 使用 name 作為備用查找
      if (subscriber.name && subscriber.phone) {
        phoneMap.set(`name:${subscriber.name}`, subscriber.phone)
      }
    })

    // 5. 更新訂單
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const order of ordersWithoutPhone) {
      let phone: string | null = null

      // 優先使用 user_id 查找
      if (order.user_id) {
        phone = phoneMap.get(order.user_id) || null
      }

      // 如果沒有找到，使用 email 查找
      if (!phone && order.customer_email) {
        phone = phoneMap.get(`email:${order.customer_email.toLowerCase()}`) || null
      }

      // 如果還是沒有找到，使用 subscriber_name 查找
      if (!phone && order.subscriber_name) {
        phone = phoneMap.get(`name:${order.subscriber_name}`) || null
      }

      if (phone) {
        try {
          const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({
                customer_phone: phone,
                updated_at: new Date().toISOString()
              })
            }
          )

          if (updateResponse.ok) {
            updated++
            console.log(`✅ 已更新訂單 ${order.id} 的電話號碼: ${phone}`)
          } else {
            const errorText = await updateResponse.text()
            errors.push(`訂單 ${order.id}: ${errorText}`)
            skipped++
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`訂單 ${order.id}: ${errorMsg}`)
          skipped++
        }
      } else {
        skipped++
        console.log(`⚠️ 無法為訂單 ${order.id} 找到電話號碼 (user_id: ${order.user_id}, email: ${order.customer_email}, name: ${order.subscriber_name})`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `處理完成：更新了 ${updated} 個訂單，跳過了 ${skipped} 個訂單`,
      updated,
      skipped,
      total: ordersWithoutPhone.length,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error filling missing phones:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fill missing phones'
      },
      { status: 500 }
    )
  }
}
