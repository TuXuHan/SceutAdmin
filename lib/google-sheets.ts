import { google } from "googleapis"

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

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

export type InventoryRow = {
  brand: string
  product: string
  unitsLeft: number
}

type SheetRow = (string | number | null | undefined)[]

export async function fetchPerfumeInventory(range = "Cost!A:G"): Promise<InventoryRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID")
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() })
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  })

  const rows = (data.values ?? []) as SheetRow[]
  if (rows.length === 0) return []

  const { headerRowIndex, header } = locateHeaderRow(rows)

  const brandIdx = findColumnIndex(header, ["brand name", "brand", "品牌", "品牌名稱", "brandname"])
  const productIdx = findColumnIndex(header, ["product name", "product", "產品名稱", "香水名稱", "productname"])
  const unitsIdx = findColumnIndex(header, ["units left", "units", "庫存", "庫存數量", "剩餘數量", "剩餘件數"])

  if (brandIdx < 0 || productIdx < 0 || unitsIdx < 0) {
    console.error("Sheet header parsing error", {
      header,
      brandIdx,
      productIdx,
      unitsIdx,
    })
    throw new Error("Sheet header missing required columns (Brand / Product / Units)")
  }

  let lastBrand = ""

  return rows.slice(headerRowIndex + 1).flatMap((row) => {
    const cells = row.map((cell) => (cell ?? "").toString().trim())
    const brand = cells[brandIdx] || lastBrand
    const product = cells[productIdx]
    const unitsCell = cells[unitsIdx]

    lastBrand = brand || lastBrand

    if (!product) {
      return []
    }

    const unitsLeft = Number(unitsCell)

    return [
      {
        brand,
        product,
        unitsLeft: Number.isFinite(unitsLeft) ? unitsLeft : 0,
      },
    ]
  })
}

export async function getInStockPerfumeNames(range?: string): Promise<Set<string>> {
  const rows = await fetchPerfumeInventory(range)
  return new Set(rows.filter((row) => row.unitsLeft > 0).map((row) => row.product.toLowerCase()))
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
