import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

export async function GET() {
  try {
    console.log("測試 Supabase 連接...")
    console.log("Supabase URL:", supabaseUrl)
    console.log("Supabase Key 前10個字符:", supabaseKey.substring(0, 10) + "...")
    
    // 簡單查詢測試
    const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&limit=5`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log("Supabase 回應狀態:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Supabase 連接失敗:", response.status, errorText)
      return NextResponse.json({
        success: false,
        error: "Supabase 連接失敗",
        status: response.status,
        errorText
      }, { status: 500 })
    }

    const orders = await response.json()
    console.log("成功取得訂單數量:", orders.length)
    
    // 分析訂單結構
    const orderStatuses = orders.reduce((acc: any, order: any) => {
      acc[order.order_status] = (acc[order.order_status] || 0) + 1
      return acc
    }, {})
    
    const hasShipmentNo = orders.filter((order: any) => order.shipment_no).length
    
    return NextResponse.json({
      success: true,
      message: "Supabase 連接成功",
      data: {
        totalOrders: orders.length,
        orderStatuses,
        hasShipmentNo,
        sampleOrder: orders[0] || null,
        allColumns: orders.length > 0 ? Object.keys(orders[0]) : []
      }
    })
    
  } catch (error) {
    console.error('測試連接錯誤:', error)
    return NextResponse.json({
      success: false,
      error: '連接測試失敗',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
