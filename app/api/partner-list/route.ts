import { type NextRequest, NextResponse } from "next/server"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// GET - 獲取互惠對象名單
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")

    // 從 partner_list 表獲取資料
    let query = `${SUPABASE_URL}/rest/v1/partner_list?select=*&order=created_at.desc`

    if (search) {
      query += `&name=ilike.%25${encodeURIComponent(search)}%25`
    }

    const response = await fetch(query, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("獲取互惠對象名單失敗:", response.status, errorText)
      throw new Error(`獲取互惠對象名單失敗: ${response.status} ${response.statusText}`)
    }

    const partners = await response.json()

    return NextResponse.json({
      success: true,
      partners: Array.isArray(partners) ? partners : [],
      count: Array.isArray(partners) ? partners.length : 0,
    })
  } catch (error) {
    console.error("❌ API錯誤:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "獲取互惠對象名單失敗",
      },
      { status: 500 },
    )
  }
}
