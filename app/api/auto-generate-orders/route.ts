import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { generatePerfumeRecommendations } from "@/app/api/generate-recommendations/route"
import { buildRecommendedPerfumes, parseOrderMetadata, serializeOrderMetadata } from "@/lib/order-metadata"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"
const TARGET_DAYS_BEFORE_PAYMENT = 3

function createHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

function parseJsonSafely(value: unknown) {
  if (typeof value !== "string") {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDaysUntil(targetDateString?: string | null) {
  if (!targetDateString) {
    return null
  }

  const target = new Date(targetDateString)
  if (Number.isNaN(target.getTime())) {
    return null
  }

  const today = normalizeDate(new Date())
  const targetDay = normalizeDate(target)
  const diffMs = targetDay.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function getPaymentData(subscription: any) {
  const paymentData = subscription?.payment_data
  if (!paymentData) {
    return {}
  }

  return typeof paymentData === "string" ? parseJsonSafely(paymentData) || {} : paymentData
}

function resolveMerchantOrderNo(subscription: any): string | null {
  const paymentData = getPaymentData(subscription)

  const candidates = [
    subscription?.period_no,
    paymentData?.MerchantOrderNo,
    paymentData?.MerOrderNo,
    paymentData?.merchantOrderNo,
    paymentData?.merchant_order_no,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function resolvePaidPeriods(subscription: any): number {
  const paymentData = getPaymentData(subscription)
  const candidates = [
    paymentData?.already_times,
    paymentData?.AlreadyTimes,
    paymentData?.auth_times,
    paymentData?.AuthTimes,
  ]

  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return 0
}

function resolveTotalPeriods(subscription: any): number | null {
  const paymentData = getPaymentData(subscription)
  const candidates = [
    paymentData?.total_times,
    paymentData?.TotalTimes,
    paymentData?.period_times,
    paymentData?.PeriodTimes,
    paymentData?.auth_times,
    paymentData?.AuthTimes,
  ]

  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function resolveOrderAmount(subscription: any): number {
  const paymentData = getPaymentData(subscription)
  const candidates = [
    subscription?.monthly_fee,
    paymentData?.PeriodAmt,
    paymentData?.period_amt,
    paymentData?.AlterAmt,
  ]

  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 599
}

function buildShippingAddress(subscription: any): string | null {
  if (subscription?.delivery_method !== "home") {
    return null
  }

  if (typeof subscription?.address === "string" && subscription.address.trim()) {
    const parts = [subscription.postal_code, subscription.city, subscription.address, subscription.country]
      .filter((part) => typeof part === "string" && part.trim())
      .map((part) => part.trim())

    return parts.join(" ")
  }

  return null
}

function buildAutoOrderNumber(merchantOrderNo: string, targetPeriodNo: number, targetPaymentDate: string | null) {
  const dateSeed = targetPaymentDate
    ? targetPaymentDate.slice(2, 10).replace(/-/g, "")
    : new Date().toISOString().slice(2, 10).replace(/-/g, "")
  const merchantSuffix = merchantOrderNo.replace(/[^a-zA-Z0-9]/g, "").slice(-4) || "AUTO"
  return `PRE${dateSeed}${String(targetPeriodNo).padStart(2, "0")}${merchantSuffix}`
}

async function fetchOrdersForSubscription(subscription: any) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/orders`)
  url.searchParams.set("select", "id,order_status,notes,created_at")
  url.searchParams.set("order", "created_at.desc")
  url.searchParams.set("limit", "30")

  if (subscription?.user_id) {
    url.searchParams.set("user_id", `eq.${subscription.user_id}`)
  } else if (subscription?.email) {
    url.searchParams.set("customer_email", `eq.${subscription.email}`)
  } else {
    return []
  }

  const response = await fetch(url.toString(), {
    headers: createHeaders(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`讀取既有訂單失敗: ${response.status} - ${errorText}`)
  }

  const orders = await response.json()
  return Array.isArray(orders) ? orders : []
}

async function fetchUsedPerfumes(userId?: string | null): Promise<string[]> {
  if (!userId) {
    return []
  }

  const url = new URL(`${SUPABASE_URL}/rest/v1/orders`)
  url.searchParams.set("select", "perfume_name")
  url.searchParams.set("user_id", `eq.${userId}`)
  url.searchParams.set("perfume_name", "not.is.null")
  url.searchParams.set("order_status", "in.(shipped,shippped,delivered)")

  const response = await fetch(url.toString(), {
    headers: createHeaders(),
  })

  if (!response.ok) {
    return []
  }

  const history = await response.json()
  return [...new Set((history || []).map((item: any) => item?.perfume_name).filter(Boolean))]
}

function hasExistingGeneratedOrder(existingOrders: any[], merchantOrderNo: string, targetPeriodNo: number) {
  return existingOrders.some((order) => {
    const metadata = parseOrderMetadata(order?.notes)
    const matchesMerchantOrderNo = metadata.payment?.merchantOrderNo === merchantOrderNo
    const matchesPeriodNo =
      metadata.autoGenerated?.targetPeriodNo === String(targetPeriodNo) ||
      metadata.payment?.periodNo === String(targetPeriodNo)
    const status = typeof order?.order_status === "string" ? order.order_status.toLowerCase() : ""

    return matchesMerchantOrderNo && matchesPeriodNo && status !== "cancelled"
  })
}

export async function POST() {
  try {
    const subscribersResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?select=*&subscription_status=in.(active,paid)&order=next_payment_date.asc`,
      {
        headers: createHeaders(),
      },
    )

    if (!subscribersResponse.ok) {
      const errorText = await subscribersResponse.text()
      throw new Error(`讀取訂閱資料失敗: ${subscribersResponse.status} - ${errorText}`)
    }

    const subscribers = await subscribersResponse.json()
    const results = {
      totalSubscribers: Array.isArray(subscribers) ? subscribers.length : 0,
      dueSoonSubscribers: 0,
      generatedOrders: 0,
      skippedOrders: 0,
      skippedMissingMerchantOrderNo: 0,
      skippedMissingProfile: 0,
      errors: [] as string[],
    }

    for (const subscription of Array.isArray(subscribers) ? subscribers : []) {
      const daysUntilPayment = getDaysUntil(subscription?.next_payment_date)
      if (daysUntilPayment !== TARGET_DAYS_BEFORE_PAYMENT) {
        continue
      }

      results.dueSoonSubscribers++

      const merchantOrderNo = resolveMerchantOrderNo(subscription)
      if (!merchantOrderNo) {
        results.skippedOrders++
        results.skippedMissingMerchantOrderNo++
        continue
      }

      if (!subscription?.name || !subscription?.email) {
        results.skippedOrders++
        results.skippedMissingProfile++
        continue
      }

      const targetPeriodNo = resolvePaidPeriods(subscription) + 1
      const totalPeriods = resolveTotalPeriods(subscription)

      try {
        const existingOrders = await fetchOrdersForSubscription(subscription)
        if (hasExistingGeneratedOrder(existingOrders, merchantOrderNo, targetPeriodNo)) {
          results.skippedOrders++
          continue
        }

        const quizAnswers = parseJsonSafely(subscription?.quiz_answers)
        const usedPerfumes = await fetchUsedPerfumes(subscription?.user_id)
        const recommendations = quizAnswers
          ? await generatePerfumeRecommendations(quizAnswers, usedPerfumes)
          : null

        const recommendedPerfumes = buildRecommendedPerfumes(recommendations)
        const now = new Date().toISOString()
        const orderPayload: Record<string, any> = {
          id: randomUUID(),
          shopify_order_id: buildAutoOrderNumber(merchantOrderNo, targetPeriodNo, subscription?.next_payment_date || null),
          customer_email: subscription.email,
          customer_phone: subscription.phone || null,
          total_price: resolveOrderAmount(subscription),
          currency: "TWD",
          order_status: "created",
          subscriber_name: subscription.name,
          user_id: subscription.user_id || null,
          perfume_name: null,
          delivery_method: subscription.delivery_method || null,
          "711": subscription["711"] || null,
          notes: serializeOrderMetadata(null, {
            recommendedPerfumes,
            payment: {
              merchantOrderNo,
              periodNo: String(targetPeriodNo),
              status: "awaiting_charge_confirmation",
            },
            autoGenerated: {
              source: "subscription_prebilling",
              subscriptionId: String(subscription.id),
              userId: subscription.user_id || "",
              targetPeriodNo: String(targetPeriodNo),
              totalPeriods,
              targetPaymentDate: subscription.next_payment_date || "",
              generatedAt: now,
            },
          }),
          created_at: now,
          updated_at: now,
          last_checked: now,
          ratings: null,
        }

        const shippingAddress = buildShippingAddress(subscription)
        if (shippingAddress) {
          orderPayload.shipping_address = shippingAddress
        }

        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
          method: "POST",
          headers: createHeaders({
            Prefer: "return=representation",
          }),
          body: JSON.stringify(orderPayload),
        })

        if (!insertResponse.ok) {
          const errorText = await insertResponse.text()
          throw new Error(`建立訂單失敗: ${insertResponse.status} - ${errorText}`)
        }

        results.generatedOrders++
      } catch (error) {
        results.errors.push(
          `${subscription?.email || subscription?.id || "unknown"}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return NextResponse.json({
      success: true,
      message:
        results.generatedOrders > 0
          ? `已為 ${results.generatedOrders} 位訂閱者建立扣款前三天的預生成訂單`
          : "沒有符合條件且需要建立的新訂單",
      ...results,
    })
  } catch (error) {
    console.error("auto-generate-orders error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "自動生成訂單失敗",
      },
      { status: 500 },
    )
  }
}
