import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
// 使用 SERVICE_ROLE_KEY 来绕过 RLS，让管理员可以访问所有数据
// 如果没有设置 SERVICE_ROLE_KEY，则回退到 ANON_KEY
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function GET(request: NextRequest) {
  try {
    // 獲取訂閱者列表
    const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!subscribersResponse.ok) {
      const errorBody = await subscribersResponse.text()
      console.error("❌ 獲取訂閱者失敗:", subscribersResponse.status, errorBody)
      throw new Error(`獲取訂閱者資料失敗: ${subscribersResponse.status} ${subscribersResponse.statusText}`)
    }

    const subscribers = await subscribersResponse.json()

    return NextResponse.json({ 
      success: true, 
      subscribers,
      count: subscribers.length
    })

  } catch (error) {
    console.error("❌ API錯誤:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "獲取訂閱者資料失敗" 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'sync') {
      // 1. 獲取所有 user_profiles
      const profilesResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!profilesResponse.ok) {
        throw new Error(`獲取用戶資料失敗: ${profilesResponse.statusText}`)
      }

      const profiles = await profilesResponse.json()

      // 2. 獲取所有 subscribers
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

      // 3. 同步資料 - 只更新現有的subscribers，不創建新的
      let syncedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      // 只處理現有的subscribers，從user_profiles更新他們的資料
      for (const subscriber of subscribers) {
        try {
          // 找到對應的user_profile
          const profile = profiles.find((prof: any) => 
            prof.id === subscriber.user_id || prof.email === subscriber.email
          )
          
          if (!profile) {
            skippedCount++
            continue
          }

          // 更新現有的 subscriber
          const updateData: any = {}
            
          // 不同步 email 欄位
          // if (profile.email && profile.email !== subscriber.email) {
          //   updateData.email = profile.email
          // }
          if (profile.name && profile.name !== subscriber.name) {
            updateData.name = profile.name
          }
          if (profile.phone && profile.phone !== subscriber.phone) {
            updateData.phone = profile.phone
          }
          if (profile.user_id && profile.user_id !== subscriber.user_id) {
            updateData.user_id = profile.id
          }
          // 同步 quiz_answers
          if (profile.quiz_answers && JSON.stringify(profile.quiz_answers) !== JSON.stringify(subscriber.quiz_answers)) {
            updateData.quiz_answers = profile.quiz_answers
          }
          // 同步 delivery_method
          if (profile.delivery_method && profile.delivery_method !== subscriber.delivery_method) {
            updateData.delivery_method = profile.delivery_method
          }
          // 同步 711 門市資訊
          if (profile["711"] && profile["711"] !== subscriber["711"]) {
            updateData["711"] = profile["711"]
          }
          // 同步地址相關資訊
          if (profile.address && profile.address !== subscriber.address) {
            updateData.address = profile.address
          }
          if (profile.city && profile.city !== subscriber.city) {
            updateData.city = profile.city
          }
          if (profile.postal_code && profile.postal_code !== subscriber.postal_code) {
            updateData.postal_code = profile.postal_code
          }
          if (profile.country && profile.country !== subscriber.country) {
            updateData.country = profile.country
          }

          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString()

            const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${subscriber.id}`, {
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
              syncedCount++
            } else {
              const errorText = await updateResponse.text()
              errors.push(`更新 ${subscriber.email} 失敗: ${errorText}`)
            }
          }
        } catch (err) {
          errors.push(`處理 ${subscriber.email} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: `同步完成`,
        stats: {
          totalSubscribers: subscribers.length,
          synced: syncedCount,
          skipped: skippedCount,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      })
    }

    return NextResponse.json(
      { success: false, error: '無效的操作' },
      { status: 400 }
    )

  } catch (error) {
    console.error("❌ 同步失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "同步訂閱者資料失敗" 
      },
      { status: 500 }
    )
  }
}
