import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { decreasePerfumeUnits } from '@/lib/google-sheets'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

function sanitizeSearchTerm(value: string) {
  return value.replace(/[(),]/g, ' ').trim()
}

async function getOrderCount(search: string, statusFilter?: string) {
  const url = new URL(`${supabaseUrl}/rest/v1/orders`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('limit', '1')

  if (statusFilter) {
    url.searchParams.set('order_status', statusFilter)
  }

  if (search) {
    url.searchParams.set(
      'or',
      `(subscriber_name.ilike.*${search}*,customer_email.ilike.*${search}*,id.ilike.*${search}*,shopify_order_id.ilike.*${search}*)`
    )
  }

  const response = await fetch(url.toString(), {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact',
      'Range-Unit': 'items',
      'Range': '0-0'
    }
  })

  if (!response.ok) {
    throw new Error(`Count query failed: ${response.status}`)
  }

  const contentRange = response.headers.get('content-range') || ''
  return Number(contentRange.split('/')[1] || 0)
}

async function patchSingleOrder(id: string, updateData: Record<string, any>) {
  let shouldDecreaseInventory = false
  let perfumeNameToDecrease: string | null = null

  if (updateData.perfume_name !== undefined && updateData.perfume_name !== null && updateData.perfume_name.trim() !== '') {
    const currentOrderResponse = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${id}&select=perfume_name`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (currentOrderResponse.ok) {
      const currentOrders = await currentOrderResponse.json()
      const currentOrder = Array.isArray(currentOrders) && currentOrders.length > 0 ? currentOrders[0] : null
      const currentPerfumeName = currentOrder?.perfume_name?.trim() || ''
      const newPerfumeName = updateData.perfume_name.trim()

      if (currentPerfumeName !== newPerfumeName) {
        shouldDecreaseInventory = true
        perfumeNameToDecrease = newPerfumeName
      }
    }
  }

  const orderWithTimestamp: Record<string, any> = {
    ...updateData,
    updated_at: new Date().toISOString()
  }

  const hasShipDateField = Object.prototype.hasOwnProperty.call(updateData, 'ship_date')
  if (!hasShipDateField && typeof updateData.order_status === 'string' && updateData.order_status.toLowerCase() === 'shipped') {
    orderWithTimestamp.ship_date = new Date().toISOString()
  } else if (hasShipDateField && updateData.ship_date) {
    orderWithTimestamp.ship_date = new Date(updateData.ship_date).toISOString()
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

  if (shouldDecreaseInventory && perfumeNameToDecrease) {
    try {
      await decreasePerfumeUnits(perfumeNameToDecrease)
      console.log(`✅ 訂單 ${id} 已更新，並減少香水 "${perfumeNameToDecrease}" 的庫存`)
    } catch (inventoryError) {
      console.error(`⚠️ 訂單更新成功，但減少庫存失敗:`, inventoryError)
    }
  }

  return updatedOrder[0]
}

// GET - 獲取訂單列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '50')))
    const status = searchParams.get('status') || 'all'
    const search = sanitizeSearchTerm(searchParams.get('search') || '')
    const rangeStart = (page - 1) * pageSize
    const rangeEnd = rangeStart + pageSize - 1

    const url = new URL(`${supabaseUrl}/rest/v1/orders`)
    url.searchParams.set('select', '*')
    url.searchParams.set('order', 'created_at.desc')

    if (status && status !== 'all') {
      url.searchParams.set('order_status', `eq.${status}`)
    }

    if (search) {
      url.searchParams.set(
        'or',
        `(subscriber_name.ilike.*${search}*,customer_email.ilike.*${search}*,id.ilike.*${search}*,shopify_order_id.ilike.*${search}*)`
      )
    }

    const response = await fetch(url.toString(), {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact',
        'Range-Unit': 'items',
        'Range': `${rangeStart}-${rangeEnd}`
      }
    })

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`)
    }

    const orders = await response.json()
    const contentRange = response.headers.get('content-range') || ''
    const totalCount = Number(contentRange.split('/')[1] || orders.length || 0)
    const [pendingCount, processingCount, shippedCount, deliveredCount, cancelledCount] = await Promise.all([
      getOrderCount(search, 'in.(pending,created,confirmed)'),
      getOrderCount(search, 'eq.processing'),
      getOrderCount(search, 'in.(shipped,shippped)'),
      getOrderCount(search, 'eq.delivered'),
      getOrderCount(search, 'eq.cancelled'),
    ])

    return NextResponse.json({
      success: true,
      orders,
      summary: {
        total: totalCount,
        pending: pendingCount,
        processing: processingCount,
        shipped: shippedCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
      },
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
    })
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
  let orderData: any = null

  try {
    orderData = await request.json()
    
    // 為新訂單添加ID和時間戳，只包含orders表實際存在的欄位
    const now = new Date().toISOString()
    
    // 如果沒有提供shopify_order_id或為空，自動生成一個
    let shopifyOrderId = orderData.shopify_order_id
    if (!shopifyOrderId || shopifyOrderId.trim() === '') {
      // 生成Shopify訂單ID格式 (H + 7位數字)
      shopifyOrderId = 'H' + Math.floor(1000000 + Math.random() * 9000000).toString()
    }
    
    const orderWithTimestamps: Record<string, any> = {
      id: randomUUID(),
      shopify_order_id: shopifyOrderId,
      customer_email: orderData.customer_email,
      customer_phone: orderData.customer_phone || null,
      total_price: orderData.total_price,
      currency: orderData.currency || 'TWD',
      order_status: orderData.order_status || 'pending',
      subscriber_name: orderData.subscriber_name,
      user_id: orderData.user_id || null,
      perfume_name: orderData.perfume_name || null,
      delivery_method: orderData.delivery_method || null,
      "711": orderData["711"] || null,
      notes: orderData.notes || null,
      created_at: now,
      updated_at: now,
      last_checked: now,
      ratings: null
    }

    if (orderData.ship_date) {
      orderWithTimestamps.ship_date = new Date(orderData.ship_date).toISOString()
    } else if ((orderWithTimestamps.order_status || '').toLowerCase() === 'shipped') {
      orderWithTimestamps.ship_date = now
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
    const body = await request.json()

    if (Array.isArray(body?.orders)) {
      const updates = body.orders.filter((order: any) => order?.id)
      if (updates.length === 0) {
        return NextResponse.json(
          { success: false, error: 'At least one order update is required' },
          { status: 400 }
        )
      }

      const updatedOrders = await Promise.all(
        updates.map(({ id, ...updateData }: any) => patchSingleOrder(id, updateData))
      )

      return NextResponse.json({ success: true, orders: updatedOrders })
    }

    const { id, ...updateData } = body
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const updatedOrder = await patchSingleOrder(id, updateData)
    return NextResponse.json({ success: true, order: updatedOrder })
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
