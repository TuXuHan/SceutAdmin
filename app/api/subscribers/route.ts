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

      // 3. 同步資料
      let syncedCount = 0
      let createdCount = 0
      const errors: string[] = []

      for (const profile of profiles) {
        try {
          // 檢查是否已存在對應的 subscriber
          const existingSubscriber = subscribers.find((sub: any) => 
            sub.user_id === profile.id || sub.email === profile.email
          )

          if (existingSubscriber) {
            // 更新現有的 subscriber
            const updateData: any = {}
            
            if (profile.email && profile.email !== existingSubscriber.email) {
              updateData.email = profile.email
            }
            if (profile.name && profile.name !== existingSubscriber.name) {
              updateData.name = profile.name
            }
            if (profile.phone && profile.phone !== existingSubscriber.phone) {
              updateData.phone = profile.phone
            }
            if (profile.user_id && profile.user_id !== existingSubscriber.user_id) {
              updateData.user_id = profile.id
            }
            // 同步 quiz_answers
            if (profile.quiz_answers && JSON.stringify(profile.quiz_answers) !== JSON.stringify(existingSubscriber.quiz_answers)) {
              updateData.quiz_answers = profile.quiz_answers
            }

            if (Object.keys(updateData).length > 0) {
              updateData.updated_at = new Date().toISOString()

              const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${existingSubscriber.id}`, {
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
                errors.push(`更新 ${profile.email} 失敗: ${errorText}`)
              }
            }
          } else {
            // 創建新的 subscriber
            const newSubscriber = {
              user_id: profile.id,
              email: profile.email,
              name: profile.name,
              phone: profile.phone,
              quiz_answers: profile.quiz_answers,
              subscription_status: 'inactive', // 默認為未啟用，需要實際訂閱才改為 active
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }

            const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(newSubscriber)
            })

            if (createResponse.ok) {
              createdCount++
            } else {
              const errorText = await createResponse.text()
              errors.push(`創建 ${profile.email} 失敗: ${errorText}`)
            }
          }
        } catch (err) {
          errors.push(`處理 ${profile.email} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: `同步完成`,
        stats: {
          totalProfiles: profiles.length,
          synced: syncedCount,
          created: createdCount,
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
