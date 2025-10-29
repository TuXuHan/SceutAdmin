import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// GET - 獲取訂單列表
export async function GET() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/orders?select=*&order=updated_at.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const orders = await response.json()
    return NextResponse.json({ success: true, orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// POST - 創建新訂單
export async function POST(request: NextRequest) {
  try {
    const orderData = await request.json()
    
    // 為新訂單添加ID和時間戳，只包含orders表實際存在的欄位
    const now = new Date().toISOString()
    
    // 如果沒有提供shopify_order_id或為空，自動生成一個
    let shopifyOrderId = orderData.shopify_order_id
    if (!shopifyOrderId || shopifyOrderId.trim() === '') {
      // 生成Shopify訂單ID格式 (H + 7位數字)
      shopifyOrderId = 'H' + Math.floor(1000000 + Math.random() * 9000000).toString()
    }
    
    const orderWithTimestamps: any = {
      id: randomUUID(),
      shopify_order_id: shopifyOrderId,
      customer_email: orderData.customer_email,
      total_price: orderData.total_price,
      currency: orderData.currency || 'TWD',
      order_status: orderData.order_status || 'pending',
      subscriber_name: orderData.subscriber_name,
      user_id: orderData.user_id || null,
      perfume_name: orderData.perfume_name || null,
      delivery_method: orderData.delivery_method || null,
      "711": orderData["711"] || null,
      created_at: now,
      updated_at: now,
      last_checked: now,
      ratings: null
    }

    // 只有當配送方式是宅配時才添加shipping_address
    if (orderData.delivery_method === 'home' && orderData.shipping_address) {
      orderWithTimestamps.shipping_address = orderData.shipping_address
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderWithTimestamps)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Supabase insert error:', errorText)
      throw new Error(`Supabase insert failed: ${response.status} - ${errorText}`)
    }

    const newOrder = await response.json()
    return NextResponse.json({ success: true, order: newOrder[0] })
  } catch (error) {
    console.error('Error creating order:', error)
    console.error('Order data received:', orderData)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create order',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// PUT - 更新訂單
export async function PUT(request: NextRequest) {
  try {
    const { id, ...updateData } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // 為更新添加 updated_at 時間戳
    const orderWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString()
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderWithTimestamp)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Supabase update failed: ${response.status} - ${errorText}`)
    }

    const updatedOrder = await response.json()
    return NextResponse.json({ success: true, order: updatedOrder[0] })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

// DELETE - 刪除訂單
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Supabase delete failed: ${response.status} - ${errorText}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}
