import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
// 使用 SERVICE_ROLE_KEY 來繞過 RLS，讓管理員可以訪問所有數據
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// GET - 獲取訂閱者列表（僅顯示有訂閱的用戶）
export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")

    // 從 subscribers 表獲取資料，包含所有訂閱者（不限狀態）
    // 注意：Supabase 的搜索限制，我們先獲取所有資料，然後在應用層面過濾
    let query = `${supabaseUrl}/rest/v1/subscribers?select=*&order=name.asc`
    
    // 如果沒有搜索詞，直接獲取所有訂閱者
    // 如果有搜索詞，先獲取所有，然後在應用層面過濾（因為 Supabase 的 ilike 可能無法搜索 email）

    const response = await fetch(query, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    let subscribers = await response.json()

    // 只保留 active 狀態的訂閱者
    subscribers = subscribers.filter((subscriber: any) => {
      const status = subscriber.subscription_status?.toLowerCase() || ''
      return status === 'active'
    })

    // 如果有搜索詞，在應用層面進行過濾（支持 name 和 email 搜索）
    if (search) {
      const searchLower = search.toLowerCase()
      subscribers = subscribers.filter((subscriber: any) => {
        const nameMatch = subscriber.name && subscriber.name.toLowerCase().includes(searchLower)
        const emailMatch = subscriber.email && subscriber.email.toLowerCase().includes(searchLower)
        return nameMatch || emailMatch
      })
    }

    // 將 subscribers 資料轉換為與原 user_profiles 相容的格式
    // 不過濾任何訂閱者，即使沒有 name 或 email 也包含
    const users = subscribers.map((subscriber: any) => {
      // 保留原始 name（即使為空），不要用 email 替代，因為前端需要知道真實的 name
      // 如果 name 為空，前端會處理顯示
      
      return {
        id: subscriber.user_id || subscriber.id,
        name: subscriber.name || "", // 保留原始 name，即使為空
        email: subscriber.email || "",
        phone: subscriber.phone || "",
        address: subscriber.address || "",
        city: subscriber.city || "",
        postal_code: subscriber.postal_code || "",
        country: subscriber.country || "",
        "711": subscriber["711"] || "",
        delivery_method: subscriber.delivery_method || "",
        created_at: subscriber.created_at || new Date().toISOString(),
        updated_at: subscriber.updated_at || new Date().toISOString(),
        // 添加訂閱相關資訊 - 保留原始狀態，不要預設為 "active"
        subscription_status: subscriber.subscription_status || null, // 保留 null 而不是預設 "active"
        monthly_fee: subscriber.monthly_fee || "599",
        next_payment_date: subscriber.next_payment_date || null,
      }
    })

    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error("Error fetching subscribers:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch subscribers" }, { status: 500 })
  }
}
