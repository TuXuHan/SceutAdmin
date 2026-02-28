import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// POST - 檢查並更新缺少宅配地址的訂單（僅限宅配 delivery_method = 'home'）
export async function POST(request: NextRequest) {
  try {
    // 1. 取得訂單資料（欄位可能因 DB schema 不同而不存在，因此做降級重試）
    const ordersSelectCandidates = [
      'id,user_id,subscriber_name,customer_email,delivery_method,shipping_address,"711"',
      'id,user_id,subscriber_name,customer_email,delivery_method,shipping_address',
      'id,user_id,subscriber_name,customer_email,shipping_address,"711"',
      'id,user_id,subscriber_name,customer_email,shipping_address',
      '*',
    ]

    let allOrders: any[] = []
    let ordersResponse: Response | null = null
    let lastOrdersErrorText: string | null = null

    for (const sel of ordersSelectCandidates) {
      const selectParam = encodeURIComponent(sel)
      const url = `${supabaseUrl}/rest/v1/orders?select=${selectParam}`
      const resp = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      ordersResponse = resp
      if (resp.ok) {
        const data = await resp.json()
        allOrders = Array.isArray(data) ? data : []
        lastOrdersErrorText = null
        break
      }

      // 400 多半是欄位不存在，記錄文字後嘗試下一個 select
      if (resp.status === 400) {
        lastOrdersErrorText = await resp.text()
        continue
      }

      // 其他錯誤直接返回
      lastOrdersErrorText = await resp.text()
      return NextResponse.json(
        { success: false, error: 'Failed to fetch orders', details: lastOrdersErrorText },
        { status: resp.status }
      )
    }

    if (!ordersResponse || !ordersResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch orders (schema mismatch)',
          details: lastOrdersErrorText || `HTTP ${ordersResponse?.status ?? 'unknown'}`,
        },
        { status: 400 }
      )
    }

    // 2. 取得 user_profiles、subscribers 和 partner_list 的地址資料
    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?select=id,address,email,name`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let profiles: any[] = []
    if (profilesResponse.ok) {
      profiles = await profilesResponse.json()
    }

    const subscribersResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?select=user_id,address,email,name,delivery_method,"711"`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let subscribers: any[] = []
    if (subscribersResponse.ok) {
      subscribers = await subscribersResponse.json()
    }

    // 從 partner_list 獲取地址資料
    const partnersResponse = await fetch(
      `${supabaseUrl}/rest/v1/partner_list?select=user_id,address,email,name,delivery_method`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    let partners: any[] = []
    if (partnersResponse.ok) {
      partners = await partnersResponse.json()
    }

    // 輔助函數：標準化姓名（去除空白、統一格式）
    const normalizeName = (name: string | null | undefined): string | null => {
      if (!name || typeof name !== 'string') return null
      return name.trim().replace(/\s+/g, ' ')
    }

    // 3. 建立地址查找表（使用多種 key 格式以增加匹配成功率）
    const addressMap = new Map<string, string>()
    const methodMap = new Map<string, string>()

    // user_profiles: 以 id / email / name（多種格式）查找
    profiles.forEach((profile: any) => {
      if (profile.id && profile.address) {
        addressMap.set(profile.id, profile.address)
      }
      if (profile.email && profile.address) {
        const emailKey = profile.email.toLowerCase().trim()
        addressMap.set(`email:${emailKey}`, profile.address)
      }
      if (profile.name && profile.address) {
        const nameNorm = normalizeName(profile.name)
        if (nameNorm) {
          // 原始姓名
          addressMap.set(`name:${profile.name}`, profile.address)
          // 標準化姓名（去除多餘空白）
          addressMap.set(`name:${nameNorm}`, profile.address)
          // 去除所有空白
          addressMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, profile.address)
        }
      }
    })

    // subscribers: 以 user_id / email / name（多種格式）查找
    subscribers.forEach((sub: any) => {
      if (sub.user_id && sub.address) {
        addressMap.set(sub.user_id, sub.address)
      }
      if (sub.email && sub.address) {
        const emailKey = sub.email.toLowerCase().trim()
        addressMap.set(`email:${emailKey}`, sub.address)
      }
      if (sub.name && sub.address) {
        const nameNorm = normalizeName(sub.name)
        if (nameNorm) {
          // 原始姓名
          addressMap.set(`name:${sub.name}`, sub.address)
          // 標準化姓名（去除多餘空白）
          addressMap.set(`name:${nameNorm}`, sub.address)
          // 去除所有空白
          addressMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, sub.address)
        }
      }

      // 同步配送方式，用來判斷是否宅配（home）
      const dm = typeof sub.delivery_method === 'string' ? sub.delivery_method : null
      if (sub.user_id && dm) {
        methodMap.set(sub.user_id, dm)
      }
      if (sub.email && dm) {
        const emailKey = sub.email.toLowerCase().trim()
        methodMap.set(`email:${emailKey}`, dm)
      }
      if (sub.name && dm) {
        const nameNorm = normalizeName(sub.name)
        if (nameNorm) {
          methodMap.set(`name:${sub.name}`, dm)
          methodMap.set(`name:${nameNorm}`, dm)
          methodMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, dm)
        }
      }
    })

    // partner_list: 以 user_id / email / name（多種格式）查找
    partners.forEach((partner: any) => {
      if (partner.user_id && partner.address) {
        addressMap.set(partner.user_id, partner.address)
      }
      if (partner.email && partner.address) {
        const emailKey = partner.email.toLowerCase().trim()
        addressMap.set(`email:${emailKey}`, partner.address)
      }
      if (partner.name && partner.address) {
        const nameNorm = normalizeName(partner.name)
        if (nameNorm) {
          // 原始姓名
          addressMap.set(`name:${partner.name}`, partner.address)
          // 標準化姓名（去除多餘空白）
          addressMap.set(`name:${nameNorm}`, partner.address)
          // 去除所有空白
          addressMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, partner.address)
        }
      }

      // 同步配送方式，用來判斷是否宅配（home）
      const dm = typeof partner.delivery_method === 'string' ? partner.delivery_method : null
      if (partner.user_id && dm) {
        methodMap.set(partner.user_id, dm)
      }
      if (partner.email && dm) {
        const emailKey = partner.email.toLowerCase().trim()
        methodMap.set(`email:${emailKey}`, dm)
      }
      if (partner.name && dm) {
        const nameNorm = normalizeName(partner.name)
        if (nameNorm) {
          methodMap.set(`name:${partner.name}`, dm)
          methodMap.set(`name:${nameNorm}`, dm)
          methodMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, dm)
        }
      }
    })

    // 再從已存在地址的訂單建立映射（同一個人之前下過單）
    allOrders.forEach((order: any) => {
      const addr = order.shipping_address
      if (!addr || (typeof addr === 'string' && addr.trim() === '')) return

      const userId = order.user_id
      const email = order.customer_email ? String(order.customer_email).toLowerCase().trim() : ''
      const name = order.subscriber_name ? String(order.subscriber_name) : ''
      const nameNorm = normalizeName(name)

      if (userId) {
        if (!addressMap.has(userId)) addressMap.set(userId, addr)
      }
      if (email) {
        const key = `email:${email}`
        if (!addressMap.has(key)) addressMap.set(key, addr)
      }
      if (nameNorm) {
        // 多種 name 格式
        if (!addressMap.has(`name:${name}`)) addressMap.set(`name:${name}`, addr)
        if (!addressMap.has(`name:${nameNorm}`)) addressMap.set(`name:${nameNorm}`, addr)
        if (!addressMap.has(`name:${nameNorm.replace(/\s+/g, '')}`)) {
          addressMap.set(`name:${nameNorm.replace(/\s+/g, '')}`, addr)
        }
      }
    })

    // 只處理「宅配(home)」且缺少地址的訂單
    // - 若 orders 表有 delivery_method，直接用它判斷
    // - 否則 fallback 用 subscribers 的 delivery_method 判斷
    // - 若都沒有，則跳過，避免誤補 7-11 訂單
    const ordersWithoutAddress = allOrders.filter((order: any) => {
      const addr = order.shipping_address
      const missingAddr = !addr || (typeof addr === 'string' && addr.trim() === '')
      if (!missingAddr) return false

      // 先用 order.delivery_method
      if (typeof order.delivery_method === 'string') {
        return order.delivery_method === 'home'
      }

      // fallback 用 subscriber 的 delivery_method（使用標準化比對）
      const userId = order.user_id
      const email = order.customer_email ? String(order.customer_email).toLowerCase().trim() : ''
      const name = order.subscriber_name ? String(order.subscriber_name) : ''
      const nameNorm = normalizeName(name)

      let dm: string | null = null
      if (userId) dm = methodMap.get(userId) || null
      if (!dm && email) dm = methodMap.get(`email:${email}`) || null
      if (!dm && nameNorm) {
        // 嘗試多種 name 格式
        dm = methodMap.get(`name:${name}`) || null
        if (!dm) dm = methodMap.get(`name:${nameNorm}`) || null
        if (!dm) dm = methodMap.get(`name:${nameNorm.replace(/\s+/g, '')}`) || null
      }

      return dm === 'home'
    })

    if (ordersWithoutAddress.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有宅配訂單都已有配送地址（或無法判斷宅配訂單）',
        updated: 0,
        skipped: 0,
      })
    }

    // 4. 逐筆更新訂單
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const order of ordersWithoutAddress) {
      let address: string | null = null
      const debugInfo: string[] = []

      // 優先使用 user_id
      if (order.user_id) {
        address = addressMap.get(order.user_id) || null
        if (address) {
          debugInfo.push(`找到地址（user_id: ${order.user_id}）`)
        }
      }

      // 再用 email（標準化）
      if (!address && order.customer_email) {
        const emailKey = String(order.customer_email).toLowerCase().trim()
        address = addressMap.get(`email:${emailKey}`) || null
        if (address) {
          debugInfo.push(`找到地址（email: ${emailKey}）`)
        }
      }

      // 最後用訂閱者姓名（嘗試多種格式）
      if (!address && order.subscriber_name) {
        const name = String(order.subscriber_name)
        const nameNorm = normalizeName(name)
        
        // 嘗試原始姓名
        address = addressMap.get(`name:${name}`) || null
        if (address) {
          debugInfo.push(`找到地址（name: ${name}）`)
        }
        
        // 嘗試標準化姓名
        if (!address && nameNorm) {
          address = addressMap.get(`name:${nameNorm}`) || null
          if (address) {
            debugInfo.push(`找到地址（name normalized: ${nameNorm}）`)
          }
        }
        
        // 嘗試去除所有空白
        if (!address && nameNorm) {
          const nameNoSpace = nameNorm.replace(/\s+/g, '')
          address = addressMap.get(`name:${nameNoSpace}`) || null
          if (address) {
            debugInfo.push(`找到地址（name no space: ${nameNoSpace}）`)
          }
        }
      }

      if (!address) {
        // 記錄找不到地址的原因（僅在錯誤時輸出）
        const missingInfo = {
          orderId: order.id,
          subscriberName: order.subscriber_name || '無',
          customerEmail: order.customer_email || '無',
          userId: order.user_id || '無',
        }
        console.error(`無法為訂單 ${order.id} 找到地址:`, missingInfo)
        skipped++
        continue
      }

      try {
        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`,
          {
            method: 'PATCH',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              shipping_address: address,
              updated_at: new Date().toISOString(),
            }),
          }
        )

        if (updateResponse.ok) {
          updated++
        } else {
          const errorText = await updateResponse.text()
          errors.push(`訂單 ${order.id}: ${errorText}`)
          skipped++
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        errors.push(`訂單 ${order.id}: ${msg}`)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      message: `處理完成：更新了 ${updated} 個宅配訂單地址，跳過了 ${skipped} 個訂單`,
      updated,
      skipped,
      total: ordersWithoutAddress.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error filling missing addresses:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fill missing addresses',
      },
      { status: 500 }
    )
  }
}

