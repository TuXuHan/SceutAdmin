import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { jsonrepair } from 'jsonrepair'
import { fetchPerfumeInventory, type InventoryRow } from '@/lib/google-sheets'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

// 初始化 OpenAI 客户端 (仅在有API key时)
let openai: OpenAI | null = null
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

type IntroductionEntry = Record<string, any>

function normalizeKey(value: string | null | undefined): string {
  return value ? value.toString().toLowerCase().replace(/\s+/g, ' ').trim() : ''
}

function buildInventoryMap(rows: InventoryRow[]): Map<string, InventoryRow> {
  const map = new Map<string, InventoryRow>()
  rows
    .filter((row) => row.product)
    .forEach((row) => {
      const key = normalizeKey(row.product)
      if (key) {
        map.set(key, row)
      }
    })
  return map
}

function buildIntroductionContext(rawData: any, inventoryMap: Map<string, InventoryRow>) {
  const entryMap = new Map<string, IntroductionEntry>()

  if (!Array.isArray(rawData)) {
    return {
      filteredData: rawData,
      entryMap,
    }
  }

  const filteredData = rawData.map((table) => {
    if (!table || !Array.isArray(table.data)) {
      return table
    }

    const filteredRows = table.data.flatMap((item: IntroductionEntry) => {
      const productName = item?.['Product Name']
      const normalized = normalizeKey(productName)

      if (!normalized) {
        console.warn('跳過香水資料：缺少產品名稱', {
          tableIndex: table.table_index ?? null,
          brand: item?.['Brand Name'] ?? null,
        })
        return []
      }

      const inventoryRow = inventoryMap.get(normalized)
      if (inventoryRow && inventoryRow.unitsLeft <= 0) {
        console.log('篩選掉庫存為 0 的香水', {
          productName,
          brand: item?.['Brand Name'] ?? null,
          unitsLeft: inventoryRow.unitsLeft,
        })
        return []
      }

      const updated: IntroductionEntry = { ...item }

      if (inventoryRow) {
        updated['Units'] = String(inventoryRow.unitsLeft)
        updated['Units Left'] = inventoryRow.unitsLeft
      }

      entryMap.set(normalized, updated)
      return [updated]
    })

    return {
      ...table,
      data: filteredRows,
    }
  })

  return {
    filteredData,
    entryMap,
  }
}

function attachInventoryMetadata(recommendations: any, inventoryMap: Map<string, InventoryRow>) {
  if (!recommendations || inventoryMap.size === 0) {
    return recommendations
  }

  const result = { ...recommendations }
  ;['primary', 'secondary', 'alternative'].forEach((key) => {
    const recommendation = result[key]
    if (!recommendation) {
      return
    }

    const inventoryRow = inventoryMap.get(normalizeKey(recommendation.name))
    if (inventoryRow) {
      result[key] = {
        ...recommendation,
        unitsLeft: inventoryRow.unitsLeft,
      }
    }
  })

  return result
}

function getInventoryFallbackRecommendations(inventoryRows: InventoryRow[]) {
  const available = inventoryRows.filter((row) => row.unitsLeft > 0)
  if (available.length === 0) {
    return null
  }

  const pick = available.slice(0, 3)
  const confidences = [88, 74, 65]

  const makeRecommendation = (row: InventoryRow, index: number) => ({
    name: row.product,
    number: '',
    brand: row.brand || '精選香水',
    description: `${row.product} 目前庫存剩餘 ${row.unitsLeft} 件，適合作為即時推薦。`,
    confidence: confidences[index] ?? 60,
    reasons: [
      '庫存充足，可立即提供體驗。',
      '香水資料庫中含有詳細介紹，可作為安全推薦。',
      '符合近期庫存策略，避免推薦缺貨品項。',
    ],
  })

  return {
    primary: makeRecommendation(pick[0], 0),
    secondary: pick[1] ? makeRecommendation(pick[1], 1) : null,
    alternative: pick[2] ? makeRecommendation(pick[2], 2) : null,
  }
}

/**
 * 使用 OpenAI 生成香水推薦
 */
async function generatePerfumeRecommendations(quizAnswers: any, excludePerfumes: string[] = []) {
  let inventoryRows: InventoryRow[] = []
  let inventoryMap = new Map<string, InventoryRow>()
  const excludeSet = new Set(excludePerfumes.map(normalizeKey).filter(Boolean))

  try {
    inventoryRows = await fetchPerfumeInventory()
    inventoryMap = buildInventoryMap(inventoryRows)
    console.log('成功載入 Google Sheet 庫存資料，筆數:', inventoryRows.length)
  } catch (inventoryError) {
    console.error('讀取 Google Sheet 庫存資料失敗:', inventoryError)
  }

  // 如果沒有 OpenAI API key，直接返回備用推薦
  if (!openai) {
    console.log('未設置 OpenAI API key，使用備用推薦')
    return getFallbackRecommendations(inventoryRows)
  }

  try {
    // 讀取香水資料庫
    let perfumeDatabase = '香水資料庫暫時不可用'
    try {
      const fs = require('fs')
      const path = require('path')
      const jsonPath = path.join(process.cwd(), 'introduction.json')
      const jsonData = fs.readFileSync(jsonPath, 'utf8')
      perfumeDatabase = jsonData

      try {
        const repairedIntroduction = jsonrepair(jsonData)
        const parsedIntroduction = JSON.parse(repairedIntroduction)
        const { filteredData } = buildIntroductionContext(parsedIntroduction, inventoryMap)

        if (Array.isArray(filteredData)) {
          const totalEntries = filteredData.reduce((count: number, table: any) => {
            if (!table || !Array.isArray(table.data)) {
              return count
            }
            return count + table.data.length
          }, 0)

          if (totalEntries === 0) {
            console.warn('香水資料庫中沒有可用庫存的品項，改用備用推薦')
            return getFallbackRecommendations(inventoryRows)
          }
        }

        perfumeDatabase = JSON.stringify(filteredData, null, 2)
      } catch (parseError) {
        console.error('解析香水資料庫 JSON 失敗，改用原始內容:', parseError)
      }
    } catch (error) {
      console.log('無法讀取香水資料庫檔案:', error)
      perfumeDatabase = '香水資料庫暫時不可用'
    }

    const avoidList = excludePerfumes.filter(Boolean)
    const prompt = `作為一位專業的香水顧問，請根據以下用戶的測驗答案和香水資料庫，為他們推薦3款香水。

用戶測驗答案：
${JSON.stringify(quizAnswers, null, 2)}

香水資料庫：
${perfumeDatabase}

請完全避開曾經已經給過用戶的香水：${avoidList.length ? avoidList.join('、') : '無'}。

請根據用戶的測驗答案，從香水資料庫中選擇最適合的香水進行推薦。加入 10–20% 的隨機性，讓每次結果不同，但不能違反使用者的核心偏好。請提供以下格式的推薦：
1. 主要推薦 (最符合用戶偏好，85-95%匹配度)
2. 次要推薦 (不同風格但仍適合，70-84%匹配度)  
3. 替代推薦 (額外選擇，60-75%匹配度)

對於每個推薦，請包含：
- 香水名稱及編號 (使用資料庫中的 Product Name 和 No.)
- 匹配度百分比
- 3個具體的推薦理由 (基於香調組成和用戶測驗答案)

請以JSON格式回應，結構如下：
{
  "primary": {
    "name": "香水名稱",
    "number": "編號",
    "brand": "品牌名稱", 
    "description": "詳細描述",
    "confidence": 匹配度數字,
    "reasons": ["理由1", "理由2", "理由3"]
  },
  "secondary": { ... },
  "alternative": { ... }
}

請確保推薦的香水來自提供的資料庫，並根據用戶的測驗答案進行個性化分析。`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "你是一位專業的香水顧問，擁有豐富的香水知識和個性化推薦經驗。請根據用戶的測驗答案提供專業、準確的香水推薦。"
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.7,
    })

    const responseContent = completion.choices[0].message.content
    if (!responseContent) {
      throw new Error('OpenAI 沒有返回有效的回應')
    }

    // 嘗試解析 JSON 回應
    // OpenAI 可能會在回應中包裹 markdown 代碼塊，需要先清理
    function extractJsonFromResponse(content: string): string {
      let cleaned = content.trim()
      // 移除開頭和結尾的 markdown 代碼塊標記
      cleaned = cleaned.replace(/^```json\s*\n?/i, '')
      cleaned = cleaned.replace(/^```\s*\n?/i, '')
      cleaned = cleaned.replace(/\n?```\s*$/i, '')
      return cleaned
    }

    try {
      const cleanedContent = extractJsonFromResponse(responseContent)
      const recommendations = JSON.parse(cleanedContent)
      const withInventory = attachInventoryMetadata(recommendations, inventoryMap)
      const filtered = filterOutUsedPerfumes(withInventory, excludeSet, inventoryRows)
      return filtered
    } catch (parseError) {
      console.error('解析 OpenAI 回應失敗:', parseError)
      console.log('原始回應:', responseContent)
      
      // 如果解析失敗，返回備用推薦
      return getFallbackRecommendations(inventoryRows)
    }

  } catch (error) {
    console.error('OpenAI API 調用失敗:', error)
    // 返回備用推薦
    return getFallbackRecommendations(inventoryRows)
  }
}

/**
 * 備用推薦 (當 OpenAI API 失敗時使用)
 */
function getFallbackRecommendations(inventoryRows: InventoryRow[] = []) {
  const inventoryFallback = getInventoryFallbackRecommendations(inventoryRows)
  if (inventoryFallback) {
    return inventoryFallback
  }

  return {
    primary: {
      name: "假清新柑橘調香水",
      number: "No. 001",
      brand: "Le Labo",
      description: "根據您的測驗結果，這款清新柑橘調香水非常適合您的個性和偏好。",
      confidence: 85,
      reasons: [
        "符合您對清新香調的偏好",
        "適合日常使用場合",
        "持久度適中，不會過於濃烈"
      ]
    },
    secondary: {
      name: "假木質調中性香水", 
      number: "No. 002",
      brand: "Aesop",
      description: "如果您想嘗試不同風格，這款木質調香水會帶來溫暖沉穩的感覺。",
      confidence: 72,
      reasons: [
        "木質調增添成熟魅力",
        "適合正式場合使用", 
        "中性香調適合各種性格"
      ]
    },
    alternative: {
      name: "假花香調香水",
      number: "No. 003",
      brand: "Diptyque", 
      description: "溫柔的花香調，為您增添優雅氣質。",
      confidence: 68,
      reasons: [
        "花香調帶來溫柔感覺",
        "適合特殊場合使用",
        "經典香調永不過時"
      ]
    }
  }
}

function filterOutUsedPerfumes(recommendations: any, excludeSet: Set<string>, inventoryRows: InventoryRow[]) {
  if (!recommendations || excludeSet.size === 0) return recommendations

  const filtered: Record<string, any> = { ...recommendations }
  const keys: Array<'primary' | 'secondary' | 'alternative'> = ['primary', 'secondary', 'alternative']

  keys.forEach((key) => {
    const rec = filtered[key]
    if (rec && excludeSet.has(normalizeKey(rec.name))) {
      console.log(`排除已給過的香水: ${rec.name}`)
      filtered[key] = null
    }
  })

  const hasRemaining = keys.some((key) => !!filtered[key])
  if (hasRemaining) return filtered

  const available = inventoryRows.filter(
    (row) => row.unitsLeft > 0 && !excludeSet.has(normalizeKey(row.product)),
  )
  const fallback = getInventoryFallbackRecommendations(available)
  return fallback || filtered
}

/**
 * 生成推薦
 * POST /api/generate-recommendations
 * 請求參數: { userId: string, quizAnswers: any }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, quizAnswers } = await request.json()

    if (!userId || !quizAnswers) {
      return NextResponse.json({
        success: false,
        error: '缺少必要參數：userId 和 quizAnswers'
      }, { status: 400 })
    }

    console.log(`為用戶 ${userId} 生成推薦...`)

    // 取得此用戶已出過的香水，避免重複推薦
    let usedPerfumes: string[] = []
    try {
      const historyResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=perfume_name&user_id=eq.${userId}&perfume_name=not.is.null`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (historyResponse.ok) {
        const history = await historyResponse.json()
        usedPerfumes = (history || [])
          .map((item: any) => item?.perfume_name)
          .filter(Boolean)
      } else {
        console.warn('讀取歷史香水失敗，仍繼續生成推薦')
      }
    } catch (historyError) {
      console.warn('讀取歷史香水時發生錯誤，仍繼續生成推薦', historyError)
    }

    // 使用 OpenAI 生成個人化推薦
    const recommendations = await generatePerfumeRecommendations(quizAnswers, usedPerfumes)

    return NextResponse.json({
      success: true,
      recommendations: recommendations,
      generatedAt: new Date().toISOString(),
      message: "推薦生成成功"
    })

  } catch (error) {
    console.error('生成推薦失敗:', error)
    return NextResponse.json({
      success: false,
      error: '生成推薦失敗',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
