import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'
import pLimit from 'p-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// 控制同時查詢的最大筆數（避免被 7-11 擋）
const limit = pLimit(5)

interface Order {
  shopify_order_id: string
  order_status: string
}

interface UpdateResult {
  shopify_order_id: string
  statusText: string
  success: boolean
  error?: string
}

/**
 * 查詢 7-11 物流狀態
 * ⚠️ 注意：7-11 實際上會要求驗證碼，這裡只是模擬查詢
 * 之後可以整合 OCR 或人工輸入驗證碼
 */
async function fetch711Status(shipmentNo: string, captcha: string = ""): Promise<string> {
  try {
    console.log(`開始查詢 7-11 貨號: ${shipmentNo}`)
    
    const session = axios.create({
      baseURL: "https://eservice.7-11.com.tw/e-tracking",
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      },
      timeout: 15000, // 15秒超時
    })

    // 先訪問查詢頁面獲取 session 和表單信息
    console.log("訪問 7-11 查詢頁面...")
    const homeResponse = await session.get("/search.aspx")
    const $home = cheerio.load(homeResponse.data)
    
    // 檢查是否需要驗證碼
    const captchaImg = $home("img[src*='captcha']")
    const needsCaptcha = captchaImg.length > 0
    
    console.log(`是否需要驗證碼: ${needsCaptcha}`)
    
    if (needsCaptcha && !captcha) {
      console.log("檢測到驗證碼要求，但未提供驗證碼")
      return "需要驗證碼"
    }
    
    // 獲取 ViewState 和 EventValidation（ASP.NET 頁面需要）
    const viewState = $home("input[name='__VIEWSTATE']").val()
    const eventValidation = $home("input[name='__EVENTVALIDATION']").val()
    
    // 等待一下避免請求過快
    await new Promise(resolve => setTimeout(resolve, 1000))

    const formData = new URLSearchParams()
    formData.append("__VIEWSTATE", viewState || "")
    formData.append("__VIEWSTATEGENERATOR", "3E7313DB")
    formData.append("txtProductNum", shipmentNo) // 正確的產品編號字段
    if (captcha) {
      formData.append("tbChkCode", captcha) // 正確的驗證碼字段
    }
    formData.append("aaa", "查詢") // 正確的查詢按鈕
    formData.append("txtPage", "1")

    console.log("發送查詢請求...")
    const res = await session.post("/search.aspx", formData.toString(), {
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://eservice.7-11.com.tw/e-tracking/search.aspx"
      },
    })

    console.log(`7-11 回應狀態: ${res.status}`)
    
    const $ = cheerio.load(res.data)
    
    // 檢查頁面標題
    const title = $("title").text().trim()
    console.log(`頁面標題: ${title}`)
    
    // 檢查多種可能的結果
    let resultText = ""
    
    // 1. 檢查 resultTable
    resultText = $("#resultTable").text().trim()
    if (resultText) {
      console.log("從 resultTable 取得結果:", resultText.substring(0, 100))
      return resultText.substring(0, 500)
    }
    
    // 2. 檢查 body 內容
    const bodyText = $("body").text().trim()
    console.log("body 內容:", bodyText.substring(0, 200))
    
    // 3. 檢查特定的成功或錯誤訊息
    if (bodyText.includes("系統忙碌中")) {
      return "系統忙碌中，請稍後再試"
    }
    
    if (bodyText.includes("查無資料")) {
      return "查無資料"
    }
    
    if (bodyText.includes("驗證碼錯誤")) {
      return "驗證碼錯誤"
    }
    
    // 4. 檢查是否有驗證碼要求
    const newCaptchaImg = $("img[src*='captcha']")
    if (newCaptchaImg.length > 0) {
      console.log("查詢後檢測到驗證碼要求")
      return "需要驗證碼"
    }
    
    // 5. 檢查是否有物流資訊
    if (bodyText.includes("已送達") || bodyText.includes("已到店") || bodyText.includes("可取貨")) {
      return "已送達門市"
    }
    
    if (bodyText.includes("配送中") || bodyText.includes("運輸中") || bodyText.includes("處理中")) {
      return "配送中"
    }
    
    // 6. 如果有其他內容，返回前500字符
    if (bodyText && bodyText.length > 0) {
      return bodyText.substring(0, 500)
    }
    
    return "查無資料"
    
  } catch (err) {
    console.error("查詢 7-11 失敗：", shipmentNo, err instanceof Error ? err.message : String(err))
    
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        return "查詢逾時"
      }
      if (err.response?.status === 404) {
        return "查無此貨號"
      }
      if (err.response?.status === 403) {
        return "訪問被拒絕"
      }
    }
    
    return "查詢失敗"
  }
}

/**
 * 更新所有運送中的訂單狀態
 * 這個 API 會：
 * 1. 從 Supabase 撈出所有需要查的訂單（有 shopify_order_id 且狀態為 shipped）
 * 2. 並行查詢 7-11 物流狀態
 * 3. 批次更新回 Supabase
 * 
 * 請求參數：
 * - captcha: 可選的驗證碼，如果 7-11 需要驗證碼時使用
 */
export async function POST(request: NextRequest) {
  try {
    console.log("開始更新 7-11 物流狀態...")
    
    // 獲取請求參數
    const body = await request.json().catch(() => ({}))
    const captcha = body.captcha || ""
    
    if (captcha) {
      console.log("使用提供的驗證碼進行查詢")
    }
    
    // 1️⃣ 從 Supabase 撈出所有需要查的貨號
    // 查詢條件：使用 shopify_order_id 作為貨號，狀態為 shipped（已出貨）
    const queryUrl = `${supabaseUrl}/rest/v1/orders?select=shopify_order_id,order_status&order_status=eq.shipped&shopify_order_id=not.is.null`
    console.log("查詢 URL:", queryUrl)
    
    const response = await fetch(queryUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log("Supabase 回應狀態:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Supabase 查詢失敗:", response.status, errorText)
      throw new Error(`Supabase query failed: ${response.status} - ${errorText}`)
    }

    const orders: Order[] = await response.json()
    console.log("查詢到的訂單數量:", orders.length)
    console.log("訂單詳情:", orders)
    
    if (orders.length === 0) {
      // 讓我們檢查為什麼沒有訂單
      console.log("沒有找到符合條件的訂單，讓我們檢查一下...")
      
      // 檢查所有訂單狀態
      const allOrdersResponse = await fetch(`${supabaseUrl}/rest/v1/orders?select=shopify_order_id,order_status`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      let debugInfo = {
        queryUrl,
        totalOrders: 0,
        statusDistribution: {}
      }
      
      if (allOrdersResponse.ok) {
        const allOrders = await allOrdersResponse.json()
        debugInfo.totalOrders = allOrders.length
        
        debugInfo.statusDistribution = allOrders.reduce((acc: any, order: any) => {
          acc[order.order_status] = (acc[order.order_status] || 0) + 1
          return acc
        }, {})
        
        console.log("所有訂單狀態分布:", debugInfo.statusDistribution)
        console.log("有 shipment_no 的訂單:", 
          allOrders.filter((order: any) => order.shipment_no).length
        )
      }
      
      return NextResponse.json({
        success: true,
        message: "沒有需要查詢的訂單",
        updatedCount: 0,
        details: [],
        debug: debugInfo
      })
    }

    console.log(`共需查詢筆數：${orders.length}`)

    // 2️⃣ 並行查詢 7-11 物流狀態
    const results: UpdateResult[] = await Promise.all(
      orders.map((order) =>
        limit(async () => {
          try {
            // 使用 shopify_order_id 作為貨號進行查詢，並傳入驗證碼
            const statusText = await fetch711Status(order.shopify_order_id, captcha)
            return {
              shopify_order_id: order.shopify_order_id,
              statusText,
              success: true
            }
          } catch (err) {
            return {
              shopify_order_id: order.shopify_order_id,
              statusText: "查詢異常",
              success: false,
              error: err instanceof Error ? err.message : String(err)
            }
          }
        })
      )
    )

    // 3️⃣ 批次更新 Supabase
    const updatePromises = results.map(async (result) => {
      try {
        // 根據查詢結果決定是否更新訂單狀態
        const updateData: any = {
          status_info: result.statusText,
          last_checked: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // 如果查詢到包裹已送達，更新訂單狀態為 delivered
        if (result.statusText.includes("已送達") || result.statusText.includes("已到店") || result.statusText.includes("可取貨")) {
          updateData.order_status = "delivered"
          console.log(`訂單 ${result.shopify_order_id} 已送達，更新狀態為 delivered`)
        }

        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/orders?shopify_order_id=eq.${result.shopify_order_id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
          }
        )

        if (!updateResponse.ok) {
          console.error(`更新訂單 ${result.shopify_order_id} 失敗：`, updateResponse.status)
          return { ...result, updated: false }
        }

        return { ...result, updated: true }
      } catch (err) {
        console.error(`更新訂單 ${result.shopify_order_id} 異常：`, err)
        return { ...result, updated: false }
      }
    })

    const updateResults = await Promise.all(updatePromises)
    const successCount = updateResults.filter(r => r.updated).length

    console.log(`✅ 批次更新完成，成功 ${successCount}/${orders.length} 筆`)

    return NextResponse.json({
      success: true,
      message: `成功更新 ${successCount}/${orders.length} 筆訂單`,
      updatedCount: successCount,
      totalCount: orders.length,
      details: updateResults
    })

  } catch (error) {
    console.error('更新 7-11 物流狀態失敗：', error)
    return NextResponse.json(
      {
        success: false,
        error: '更新失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * GET 方法：查詢單一訂單的 7-11 狀態
 * 使用方式：/api/update-711-status?shipment_no=XXX
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shipmentNo = searchParams.get('shipment_no')

    if (!shipmentNo) {
      return NextResponse.json(
        {
          success: false,
          error: '請提供貨號 (shipment_no)'
        },
        { status: 400 }
      )
    }

    const statusText = await fetch711Status(shipmentNo)

    return NextResponse.json({
      success: true,
      shipment_no: shipmentNo,
      status: statusText
    })
  } catch (error) {
    console.error('查詢 7-11 物流狀態失敗：', error)
    return NextResponse.json(
      {
        success: false,
        error: '查詢失敗',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
