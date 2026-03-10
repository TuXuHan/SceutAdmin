import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

const SHIPPED_DAYS_THRESHOLD = 5

/**
 * POST - 將「出貨時間超過 5 天」的已出貨訂單狀態改為「已送達」，
 * 且 updated_at 維持為出貨時間（ship_date），不改成當前時間。
 */
export async function POST() {
  try {
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - SHIPPED_DAYS_THRESHOLD)
    const fiveDaysAgoIso = fiveDaysAgo.toISOString()

    // 查詢：order_status 為 shipped/shippped 且有 ship_date，且 ship_date <= 5天前
    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=id,ship_date,order_status&order_status=in.(shipped,shippped)&ship_date=not.is.null&ship_date=lte.${fiveDaysAgoIso}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`查詢訂單失敗: ${response.status} - ${errorText}`)
    }

    const orders = await response.json()
    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '沒有需要改為已送達的訂單',
        updated: 0
      })
    }

    let updated = 0
    for (const order of orders) {
      const shipDate = order.ship_date
      if (!shipDate) continue

      const patchBody = {
        order_status: 'delivered',
        updated_at: new Date(shipDate).toISOString()
      }

      const patchRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(patchBody)
      })

      if (patchRes.ok) {
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      message: updated > 0 ? `已將 ${updated} 筆訂單狀態改為已送達（更新日期維持為出貨時間）` : '沒有需要改為已送達的訂單',
      updated
    })
  } catch (error) {
    console.error('auto-mark-delivered 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '自動標記已送達失敗'
      },
      { status: 500 }
    )
  }
}
