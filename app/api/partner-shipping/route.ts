import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// GET - 搜尋用戶
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    
    if (!search || search.trim() === '') {
      return NextResponse.json({ 
        success: true, 
        users: [] 
      })
    }

    // 從 user_profiles 表搜尋用戶
    let query = `${SUPABASE_URL}/rest/v1/user_profiles?select=*&order=name.asc`
    
    // 使用 ilike 進行模糊搜尋（不區分大小寫）
    query += `&name=ilike.%25${encodeURIComponent(search.trim())}%25`
    
    const response = await fetch(query, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("搜尋用戶失敗:", response.status, errorText)
      throw new Error(`搜尋用戶資料失敗: ${response.status} ${response.statusText}`)
    }

    const users = await response.json()
    
    return NextResponse.json({ 
      success: true, 
      users: Array.isArray(users) ? users : [],
      count: Array.isArray(users) ? users.length : 0
    })

  } catch (error) {
    console.error("❌ API錯誤:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "搜尋用戶資料失敗" 
      },
      { status: 500 }
    )
  }
}

// POST - 加入互惠對象名單（將用戶加入 subscribers 表）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId } = body

    if (action === 'add-to-subscribers') {
      if (!userId) {
        return NextResponse.json(
          { success: false, error: '缺少必要參數：userId' },
          { status: 400 }
        )
      }

      // 1. 獲取 user_profile
      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!profileResponse.ok) {
        throw new Error(`獲取用戶資料失敗: ${profileResponse.statusText}`)
      }

      const profiles = await profileResponse.json()
      if (!profiles || profiles.length === 0) {
        return NextResponse.json(
          { success: false, error: '找不到該用戶資料' },
          { status: 404 }
        )
      }

      const profile = profiles[0]

      // 2. 檢查是否已經存在於 partner_list 表
      // 先檢查 user_id
      const checkByUserIdResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/partner_list?select=id&user_id=eq.${userId}`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )

      let existingPartners: any[] = []
      if (checkByUserIdResponse.ok) {
        const byUserId = await checkByUserIdResponse.json()
        if (byUserId && byUserId.length > 0) {
          existingPartners = byUserId
        }
      }

      // 如果沒找到，再檢查 email
      if (existingPartners.length === 0 && profile.email) {
        const checkByEmailResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/partner_list?select=id&email=eq.${encodeURIComponent(profile.email)}`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (checkByEmailResponse.ok) {
          const byEmail = await checkByEmailResponse.json()
          if (byEmail && byEmail.length > 0) {
            existingPartners = byEmail
          }
        }
      }

      if (existingPartners && existingPartners.length > 0) {
        // 如果已存在，更新資料
        const partnerId = existingPartners[0].id
        const updateData: any = {
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || null,
          user_id: profile.id,
          delivery_method: profile.delivery_method || null,
          "711": profile["711"] || null,
          address: profile.address || null, // 允許 NULL
          city: profile.city || null,
          postal_code: profile.postal_code || null,
          country: profile.country || '台灣',
          quiz_answers: profile.quiz_answers || null,
          updated_at: new Date().toISOString()
        }

        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/partner_list?id=eq.${partnerId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        })

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text()
          throw new Error(`更新互惠對象資料失敗: ${errorText}`)
        }

        const updatedPartner = await updateResponse.json()
        return NextResponse.json({
          success: true,
          message: '用戶已更新到互惠對象名單',
          partner: Array.isArray(updatedPartner) ? updatedPartner[0] : updatedPartner
        })
      } else {
        // 如果不存在，創建新的互惠對象
        // 注意：id 欄位是 SERIAL 類型，由數據庫自動生成，不需要手動設置
        const now = new Date().toISOString()
        const newPartner: any = {
          // 不設置 id，讓數據庫自動生成 SERIAL ID
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || null,
          user_id: profile.id, // UUID 類型
          delivery_method: profile.delivery_method || null,
          "711": profile["711"] || null,
          address: profile.address || null, // 允許 NULL，不會違反約束
          city: profile.city || null,
          postal_code: profile.postal_code || null,
          country: profile.country || '台灣',
          quiz_answers: profile.quiz_answers || null,
          subscription_status: 'active', // 預設為活躍狀態
          monthly_fee: 599, // 預設月費（數字類型）
          payment_method: 'CREDIT',
          created_at: now,
          updated_at: now
        }

        const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/partner_list`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(newPartner)
        })

        if (!createResponse.ok) {
          const errorText = await createResponse.text()
          throw new Error(`創建互惠對象資料失敗: ${errorText}`)
        }

        const createdPartner = await createResponse.json()
        return NextResponse.json({
          success: true,
          message: '用戶已加入互惠對象名單',
          partner: Array.isArray(createdPartner) ? createdPartner[0] : createdPartner
        })
      }
    }

    return NextResponse.json(
      { success: false, error: '無效的操作' },
      { status: 400 }
    )

  } catch (error) {
    console.error("❌ 加入互惠對象名單失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "加入互惠對象名單失敗" 
      },
      { status: 500 }
    )
  }
}

// PUT - 更新用戶資料
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phone, delivery_method, quiz_answers } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數：userId' },
        { status: 400 }
      )
    }

    // 構建更新資料
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (phone !== undefined) {
      updateData.phone = phone
    }

    if (delivery_method !== undefined) {
      updateData.delivery_method = delivery_method
    }

    if (quiz_answers !== undefined) {
      // 確保 quiz_answers 是 JSON 格式
      updateData.quiz_answers = typeof quiz_answers === 'string' 
        ? quiz_answers 
        : JSON.stringify(quiz_answers)
    }

    // 更新 user_profiles 表
    const response = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("更新用戶資料失敗:", response.status, errorText)
      throw new Error(`更新用戶資料失敗: ${response.status} ${response.statusText}`)
    }

    const updatedUser = await response.json()
    
    return NextResponse.json({
      success: true,
      user: Array.isArray(updatedUser) ? updatedUser[0] : updatedUser,
      message: "用戶資料更新成功"
    })

  } catch (error) {
    console.error("❌ 更新失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "更新用戶資料失敗" 
      },
      { status: 500 }
    )
  }
}
