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

export async function fetchPerfumeInventory(range = "Inventory!A:G"): Promise<InventoryRow[]> {
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

  const header = rows[0].map((cell) => String(cell ?? "").trim())
  const brandIdx = header.indexOf("Brand Name")
  const productIdx = header.indexOf("Product Name")
  const unitsIdx = header.indexOf("Units Left")

  if (brandIdx < 0 || productIdx < 0 || unitsIdx < 0) {
    throw new Error("Sheet header missing Brand Name / Product Name / Units Left")
  }

  let lastBrand = ""

  return rows.slice(1).flatMap((row) => {
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
