import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 開始檢查資料庫數據...")
    
    const results: any = {
      serviceKeyConfigured: !!SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY !== 'YOUR_SERVICE_ROLE_KEY_HERE',
      tables: {}
    }

    // 使用 Service Key（如果有的話）
    const useKey = results.serviceKeyConfigured ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY
    console.log("🔑 使用的 Key:", results.serviceKeyConfigured ? "SERVICE_ROLE_KEY" : "ANON_KEY")

    // 檢查各個表
    const tables = ['subscribers', 'user_profiles', 'orders']
    
    for (const table of tables) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=count`, {
          headers: {
            'apikey': useKey!,
            'Authorization': `Bearer ${useKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact'
          }
        })

        const count = response.headers.get('content-range')
        const data = await response.json()

        results.tables[table] = {
          status: response.status,
          statusText: response.statusText,
          count: count ? parseInt(count.split('/')[1]) : 0,
          accessible: response.ok,
          error: response.ok ? null : data
        }

        console.log(`📊 ${table}: ${results.tables[table].count} 筆資料`)
      } catch (err) {
        results.tables[table] = {
          error: err instanceof Error ? err.message : String(err)
        }
      }
    }

    // 如果使用 Service Key，嘗試獲取實際的訂閱者數據
    if (results.serviceKeyConfigured) {
      try {
        const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=id,email,name,subscription_status,created_at&limit=5`, {
          headers: {
            'apikey': useKey!,
            'Authorization': `Bearer ${useKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (subscribersResponse.ok) {
          results.sampleSubscribers = await subscribersResponse.json()
        }
      } catch (err) {
        console.error("無法獲取樣本訂閱者:", err)
      }

      // 獲取 user_profiles 樣本
      try {
        const profilesResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=id,email,name,created_at&limit=5`, {
          headers: {
            'apikey': useKey!,
            'Authorization': `Bearer ${useKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (profilesResponse.ok) {
          results.sampleProfiles = await profilesResponse.json()
        }
      } catch (err) {
        console.error("無法獲取樣本用戶:", err)
      }
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error("❌ 檢查資料失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "檢查資料失敗" 
      },
      { status: 500 }
    )
  }
}

