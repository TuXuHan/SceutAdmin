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

    // 從 subscribers 表獲取資料，只顯示有訂閱的用戶
    let query = `${supabaseUrl}/rest/v1/subscribers?select=*&order=name.asc`

    if (search) {
      query += `&name=ilike.%25${encodeURIComponent(search)}%25`
    }

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

    const subscribers = await response.json()

    // 將 subscribers 資料轉換為與原 user_profiles 相容的格式
    const users = subscribers.map((subscriber: any) => ({
      id: subscriber.user_id || subscriber.id,
      name: subscriber.name || "",
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
      // 添加訂閱相關資訊
      subscription_status: subscriber.subscription_status || "inactive",
      monthly_fee: subscriber.monthly_fee || "599",
      next_payment_date: subscriber.next_payment_date || null,
    }))

    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error("Error fetching subscribers:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch subscribers" }, { status: 500 })
  }
}
