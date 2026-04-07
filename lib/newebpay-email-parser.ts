import { load } from "cheerio"
import type { gmail_v1 } from "googleapis"

export type ParsedNewebPayEmail = {
  gmailMessageId: string
  historyId?: string
  subject: string
  from: string
  receivedAt?: string
  merchantOrderNo: string
  periodNo: string
  authDateText?: string
  authDateIso?: string
  nextAuthDateText?: string
  nextAuthDateIso?: string
  authCode?: string
  tradeNo?: string
  amount?: number
  nextAmount?: number
  currentPeriod?: number
  totalPeriods?: number
  resultText?: string
  bankResponseCode?: string
  isSuccess: boolean
  rawText: string
}

const EMAIL_SUBJECT_KEYWORD = "藍新金流定期定額信用卡刷卡結果通知信"
const EMAIL_FROM_KEYWORD = "info@newebpay.com"

function decodeBase64Url(input?: string | null) {
  if (!input) {
    return ""
  }
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(normalized, "base64").toString("utf8")
}

function collectMessageBodies(payload?: gmail_v1.Schema$MessagePart | null): { plainText: string[]; html: string[] } {
  if (!payload) {
    return { plainText: [], html: [] }
  }

  const mimeType = payload.mimeType || ""
  const bodyText = decodeBase64Url(payload.body?.data)

  const current = {
    plainText: mimeType === "text/plain" && bodyText ? [bodyText] : [],
    html: mimeType === "text/html" && bodyText ? [bodyText] : [],
  }

  for (const part of payload.parts || []) {
    const nested = collectMessageBodies(part)
    current.plainText.push(...nested.plainText)
    current.html.push(...nested.html)
  }

  return current
}

function htmlToText(html: string) {
  const $ = load(html)
  $("style, script, head, title, meta").remove()
  return $.text()
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || ""
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractField(text: string, label: string) {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*[：:]?\\s*([^\\n]+)`)
  return text.match(pattern)?.[1]?.trim() || ""
}

function parseTaiwanDate(dateText?: string) {
  if (!dateText) {
    return undefined
  }

  const trimmed = dateText.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00+08:00`).toISOString()
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}:00+08:00`).toISOString()
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}+08:00`).toISOString()
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function parseInteger(value?: string) {
  const parsed = Number((value || "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function isTargetNewebPayMessage(message: gmail_v1.Schema$Message) {
  const subject = getHeader(message.payload?.headers, "Subject")
  const from = getHeader(message.payload?.headers, "From")
  return subject.includes(EMAIL_SUBJECT_KEYWORD) && from.includes(EMAIL_FROM_KEYWORD)
}

export function parseNewebPayMessage(message: gmail_v1.Schema$Message): ParsedNewebPayEmail | null {
  if (!isTargetNewebPayMessage(message)) {
    return null
  }

  const headers = message.payload?.headers
  const subject = getHeader(headers, "Subject")
  const from = getHeader(headers, "From")
  const receivedAt = getHeader(headers, "Date") || undefined
  const { plainText, html } = collectMessageBodies(message.payload)
  const plainBody = normalizeText(plainText.join("\n\n"))
  const htmlBody = normalizeText(html.map((content) => htmlToText(content)).join("\n\n"))
  const preferredBody =
    plainBody &&
    plainBody !== "Your browser does not support HTML" &&
    (plainBody.includes("委託單號") || plainBody.includes("商店訂單編號"))
      ? plainBody
      : htmlBody || plainBody
  const rawText = normalizeText(preferredBody)

  const periodNo = extractField(rawText, "委託單號")
  const merchantOrderNo = extractField(rawText, "商店訂單編號")

  if (!periodNo || !merchantOrderNo) {
    return null
  }

  const authDateText = extractField(rawText, "授權日期") || undefined
  const nextAuthDateText = extractField(rawText, "下一期授權日期") || undefined
  const authCode = extractField(rawText, "授權碼") || undefined
  const tradeNo = extractField(rawText, "藍新金流交易序號") || undefined
  const resultText = extractField(rawText, "刷卡結果") || undefined
  const currentAndTotal = extractField(rawText, "本期期數 / 總期數")
  const amount = parseInteger(extractField(rawText, "本期授權金額"))
  const nextAmount = parseInteger(extractField(rawText, "下一期授權金額"))
  const bankResponseCode = rawText.match(/銀行回應碼\s*([A-Za-z0-9]+)/)?.[1]

  const [currentPeriod, totalPeriods] = currentAndTotal
    ? currentAndTotal.split("/").map((segment) => parseInteger(segment.trim()))
    : [undefined, undefined]

  const isSuccess =
    Boolean(resultText && /授權成功|成功/i.test(resultText)) ||
    authCode === "00" ||
    bankResponseCode === "00"

  return {
    gmailMessageId: message.id || "",
    historyId: message.historyId || undefined,
    subject,
    from,
    receivedAt,
    merchantOrderNo,
    periodNo,
    authDateText,
    authDateIso: parseTaiwanDate(authDateText),
    nextAuthDateText,
    nextAuthDateIso: parseTaiwanDate(nextAuthDateText),
    authCode,
    tradeNo,
    amount,
    nextAmount,
    currentPeriod,
    totalPeriods,
    resultText,
    bankResponseCode,
    isSuccess,
    rawText,
  }
}
