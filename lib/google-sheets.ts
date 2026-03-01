import { google } from "googleapis"

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/spreadsheets"
]

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!email || !privateKey) {
    throw new Error("Missing Google Sheets credentials")
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  })
}

/**
 * 處理 Google Sheets API 錯誤
 */
function handleGoogleSheetsError(error: any, spreadsheetId: string, range?: string): never {
  if (error.code === 403 || error.status === 403) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const errorMessage = 
      `❌ Google Sheets 權限錯誤 (403)\n\n` +
      `無法訪問 Google Sheet。請確認以下步驟：\n\n` +
      `1. 打開您的 Google Sheet\n` +
      `2. 點擊右上角的「共用」按鈕\n` +
      `3. 在「新增使用者和群組」欄位中輸入以下 Service Account Email：\n` +
      `   ${serviceAccountEmail}\n` +
      `4. 選擇權限為「檢視者」或「編輯者」\n` +
      `5. 點擊「完成」\n\n` +
      `Sheet ID: ${spreadsheetId}\n` +
      `Service Account Email: ${serviceAccountEmail}`
    
    console.error(errorMessage)
    throw new Error(errorMessage)
  }
  
  if (error.code === 400 || error.status === 400) {
    const errorMessage = 
      `❌ Google Sheets 範圍錯誤 (400)\n\n` +
      `無法解析範圍: ${range || '未指定'}\n\n` +
      `可能的原因：\n` +
      `1. 工作表名稱不正確\n` +
      `2. 範圍格式錯誤\n` +
      `3. 工作表不存在\n\n` +
      `Sheet ID: ${spreadsheetId}\n` +
      `嘗試的範圍: ${range || '未指定'}`
    
    console.error(errorMessage)
    throw new Error(errorMessage)
  }
  
  throw error
}

export type InventoryRow = {
  number: string
  brand: string
  product: string
  unitsLeft: number
}

type SheetRow = (string | number | null | undefined)[]

export async function fetchPerfumeInventory(range = "A:I"): Promise<InventoryRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID")
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })
  
  let data
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })
    data = response.data
  } catch (error: any) {
    handleGoogleSheetsError(error, spreadsheetId, range)
  }

  const rows = (data.values ?? []) as SheetRow[]
  if (rows.length === 0) return []

  const { headerRowIndex, header } = locateHeaderRow(rows)

  const noIdx = findColumnIndex(header, ["no.", "no", "編號", "number"])
  const brandIdx = findColumnIndex(header, ["brand name", "brand", "品牌", "品牌名稱", "brandname"])
  const productIdx = findColumnIndex(header, ["product name", "product", "產品名稱", "香水名稱", "productname"])
  const unitsIdx = findColumnIndex(header, ["units left", "units", "庫存", "庫存數量", "剩餘數量", "剩餘件數"])

  if (brandIdx < 0 || productIdx < 0 || unitsIdx < 0) {
    console.error("Sheet header parsing error", {
      header,
      noIdx,
      brandIdx,
      productIdx,
      unitsIdx,
    })
    throw new Error("Sheet header missing required columns (Brand / Product / Units)")
  }

  let lastBrand = ""

  return rows.slice(headerRowIndex + 1).flatMap((row) => {
    const cells = row.map((cell) => (cell ?? "").toString().trim())
    const number = noIdx >= 0 ? (cells[noIdx] || "") : ""
    const brand = cells[brandIdx] || lastBrand
    const product = cells[productIdx]
    const unitsCell = cells[unitsIdx]

    lastBrand = brand || lastBrand

    if (!product) {
      return []
    }

    // Units 如果为空则视为 0
    const unitsLeft = unitsCell === "" || !unitsCell ? 0 : Number(unitsCell)

    return [
      {
        number,
        brand,
        product,
        unitsLeft: Number.isFinite(unitsLeft) && unitsLeft >= 0 ? unitsLeft : 0,
      },
    ]
  })
}

export async function getInStockPerfumeNames(range?: string): Promise<Set<string>> {
  const rows = await fetchPerfumeInventory(range)
  return new Set(rows.filter((row) => row.unitsLeft > 0).map((row) => row.product.toLowerCase()))
}

export type IntroductionEntry = {
  "No.": string
  "Brand Name": string
  "Product Name": string
  "Units": string
  "Top": string
  "Middle": string
  "Base": string
  "香水介紹": string
  "品牌介紹": string
}

/**
 * 從 Google Sheet 讀取香水介紹資料，返回與 introduction.json 兼容的格式
 */
export async function fetchPerfumeIntroduction(range = "A:I"): Promise<Array<{ table_index: number; data: IntroductionEntry[] }>> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID")
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })
  
  let data
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })
    data = response.data
  } catch (error: any) {
    handleGoogleSheetsError(error, spreadsheetId, range)
  }

  const rows = (data.values ?? []) as SheetRow[]
  if (rows.length === 0) return []

  const { headerRowIndex, header } = locateHeaderRow(rows)

  // 尋找所有需要的欄位索引
  const noIdx = findColumnIndex(header, ["no.", "no", "編號", "number"])
  const brandIdx = findColumnIndex(header, ["brand name", "brand", "品牌", "品牌名稱", "brandname"])
  const productIdx = findColumnIndex(header, ["product name", "product", "產品名稱", "香水名稱", "productname"])
  const unitsIdx = findColumnIndex(header, ["units left", "units", "庫存", "庫存數量", "剩餘數量", "剩餘件數"])
  const topIdx = findColumnIndex(header, ["top", "前調", "前味"])
  const middleIdx = findColumnIndex(header, ["middle", "中調", "中味"])
  const baseIdx = findColumnIndex(header, ["base", "後調", "後味", "base note"])
  const introIdx = findColumnIndex(header, ["香水介紹", "介紹", "introduction", "description", "產品介紹"])
  const brandIntroIdx = findColumnIndex(header, ["品牌介紹", "brand introduction", "brand description"])

  if (brandIdx < 0 || productIdx < 0) {
    console.error("Sheet header parsing error", {
      header,
      brandIdx,
      productIdx,
    })
    throw new Error("Sheet header missing required columns (Brand / Product)")
  }

  let lastBrand = ""
  const entries: IntroductionEntry[] = []

  rows.slice(headerRowIndex + 1).forEach((row) => {
    const cells = row.map((cell) => (cell ?? "").toString().trim())
    const brand = cells[brandIdx] || lastBrand
    const product = cells[productIdx]

    lastBrand = brand || lastBrand

    if (!product) {
      return
    }

    // Units 如果为空则视为 0
    const unitsCell = cells[unitsIdx] || ""
    const units = unitsCell === "" || !unitsCell ? "0" : String(unitsCell)

    const entry: IntroductionEntry = {
      "No.": noIdx >= 0 ? (cells[noIdx] || "") : "",
      "Brand Name": brand,
      "Product Name": product,
      "Units": units,
      "Top": topIdx >= 0 ? (cells[topIdx] || "") : "",
      "Middle": middleIdx >= 0 ? (cells[middleIdx] || "") : "",
      "Base": baseIdx >= 0 ? (cells[baseIdx] || "") : "",
      "香水介紹": introIdx >= 0 ? (cells[introIdx] || "") : "",
      "品牌介紹": brandIntroIdx >= 0 ? (cells[brandIntroIdx] || "") : "",
    }

    entries.push(entry)
  })

  // 返回與 introduction.json 兼容的格式
  return [
    {
      table_index: 0,
      data: entries,
    },
  ]
}

function locateHeaderRow(rows: SheetRow[]) {
  for (let index = 0; index < rows.length; index++) {
    const rawRow = rows[index]
    const normalizedRow = rawRow.map((cell) => normalizeHeader(String(cell ?? "")))

    if (normalizedRow.every((value) => value === "")) {
      continue
    }

    const hasBrandCandidate = normalizedRow.some((value) => ["brand", "brand name", "brandname", "品牌", "品牌名稱"].includes(value))
    const hasProductCandidate = normalizedRow.some((value) => ["product", "product name", "productname", "產品", "產品名稱", "香水名稱"].includes(value))
    const hasUnitsCandidate = normalizedRow.some((value) => ["units", "units left", "庫存", "剩餘件數", "剩餘數量", "庫存數量"].includes(value))

    if (hasProductCandidate && (hasBrandCandidate || hasUnitsCandidate)) {
      return {
        headerRowIndex: index,
        header: rawRow.map((cell) => String(cell ?? "").trim()),
      }
    }
  }

  console.error("locateHeaderRow: 無法找到標題列，請確認試算表格式。預設使用第一列", {
    firstRow: rows[0]?.map((cell) => String(cell ?? "").trim()) ?? [],
  })

  return {
    headerRowIndex: 0,
    header: rows[0]?.map((cell) => String(cell ?? "").trim()) ?? [],
  }
}

function findColumnIndex(header: string[], candidates: string[]): number {
  const normalizedHeader = header.map((value) => normalizeHeader(value))
  for (const candidate of candidates) {
    const idx = normalizedHeader.indexOf(normalizeHeader(candidate))
    if (idx >= 0) {
      return idx
    }
  }
  return -1
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * 減少指定香水的庫存數量（units - 1）
 * @param perfumeName 香水名稱（Product Name）
 * @param range Google Sheet 範圍，預設為 "A:I"
 * @returns 是否成功更新
 */
export async function decreasePerfumeUnits(perfumeName: string, range = "A:I"): Promise<boolean> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID")
  }

  if (!perfumeName || !perfumeName.trim()) {
    throw new Error("Missing perfume name")
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })

  try {
    // 1. 先讀取整個範圍來找到對應的行
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })

    const rows = (response.data.values ?? []) as SheetRow[]
    if (rows.length === 0) {
      throw new Error("Sheet is empty")
    }

    // 2. 找到標題列
    const { headerRowIndex, header } = locateHeaderRow(rows)
    const productIdx = findColumnIndex(header, ["product name", "product", "產品名稱", "香水名稱", "productname"])
    const unitsIdx = findColumnIndex(header, ["units left", "units", "庫存", "庫存數量", "剩餘數量", "剩餘件數"])

    if (productIdx < 0) {
      throw new Error("Sheet header missing Product column")
    }
    if (unitsIdx < 0) {
      throw new Error("Sheet header missing Units column")
    }

    // 3. 找到對應的香水行（不區分大小寫）
    const normalizedPerfumeName = perfumeName.trim().toLowerCase()
    let targetRowIndex = -1
    let currentUnits = 0

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const cells = row.map((cell) => (cell ?? "").toString().trim())
      const productName = cells[productIdx]?.toLowerCase() || ""

      if (productName === normalizedPerfumeName) {
        targetRowIndex = i
        const unitsCell = cells[unitsIdx] || ""
        currentUnits = unitsCell === "" || !unitsCell ? 0 : Number(unitsCell)
        break
      }
    }

    if (targetRowIndex < 0) {
      console.warn(`找不到香水: ${perfumeName}`)
      return false
    }

    // 4. 計算新的庫存數量（不能小於 0）
    const newUnits = Math.max(0, currentUnits - 1)

    // 5. 更新 Google Sheet（需要轉換為 A1 格式）
    // 行號從 1 開始，列號從 A=1 開始
    const rowNumber = targetRowIndex + 1 // Google Sheets 行號從 1 開始
    
    // 將列索引轉換為字母（A=0, B=1, ..., Z=25, AA=26, ...）
    const getColumnLetter = (colIndex: number): string => {
      let result = ''
      while (colIndex >= 0) {
        result = String.fromCharCode(65 + (colIndex % 26)) + result
        colIndex = Math.floor(colIndex / 26) - 1
      }
      return result
    }
    
    const columnLetter = getColumnLetter(unitsIdx)
    const cellRange = `${columnLetter}${rowNumber}`

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[newUnits]],
      },
    })

    console.log(`✅ 已更新香水 "${perfumeName}" 的庫存: ${currentUnits} -> ${newUnits}`)
    return true
  } catch (error: any) {
    console.error(`更新香水庫存失敗 (${perfumeName}):`, error)
    handleGoogleSheetsError(error, spreadsheetId, range)
    return false
  }
}
