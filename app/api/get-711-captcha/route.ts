import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import * as cheerio from 'cheerio'

/**
 * 獲取 7-11 驗證碼圖片
 * GET /api/get-711-captcha
 */
export async function GET(request: NextRequest) {
  try {
    console.log("獲取 7-11 驗證碼...")
    
    const session = axios.create({
      baseURL: "https://eservice.7-11.com.tw/e-tracking",
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        "DNT": "1",
        "Connection": "keep-alive"
      },
      timeout: 15000,
    })

    // 訪問查詢頁面
    const homeResponse = await session.get("/search.aspx")
    const $home = cheerio.load(homeResponse.data)
    
    // 獲取 ViewState
    const viewState = $home("input[name='__VIEWSTATE']").val()
    const viewStateGenerator = $home("input[name='__VIEWSTATEGENERATOR']").val()
    
    // 檢查是否有驗證碼圖片
    const captchaImg = $home("img[src*='captcha']")
    
    if (captchaImg.length === 0) {
      return NextResponse.json({
        success: false,
        message: "當前不需要驗證碼",
        needsCaptcha: false
      })
    }
    
    const captchaSrc = captchaImg.attr('src')
    const fullCaptchaUrl = `https://eservice.7-11.com.tw/e-tracking/${captchaSrc}`
    
    console.log("驗證碼圖片URL:", fullCaptchaUrl)
    
    return NextResponse.json({
      success: true,
      message: "獲取驗證碼成功",
      needsCaptcha: true,
      captchaUrl: fullCaptchaUrl,
      viewState: viewState,
      viewStateGenerator: viewStateGenerator,
      instructions: "請查看驗證碼圖片並輸入驗證碼"
    })
    
  } catch (error) {
    console.error('獲取驗證碼失敗：', error)
    return NextResponse.json({
      success: false,
      error: '獲取驗證碼失敗',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
