import { NextRequest, NextResponse } from "next/server"
import type { gmail_v1 } from "googleapis"
import {
  getAuthorizedGmailApi,
  getGmailSyncState,
  markMessagesProcessed,
  updateGmailSyncState,
} from "@/lib/gmail-auth"
import { isTargetNewebPayMessage, parseNewebPayMessage } from "@/lib/newebpay-email-parser"
import { syncPaymentEmail } from "@/lib/payment-sync"

const DEFAULT_GMAIL_QUERY =
  'from:info@newebpay.com subject:"藍新金流定期定額信用卡刷卡結果通知信" newer_than:30d'

function getCronSecret() {
  return process.env.GMAIL_SYNC_CRON_SECRET || process.env.CRON_SECRET || ""
}

function getMaxResults() {
  const parsed = Number(process.env.GMAIL_SYNC_MAX_RESULTS || "20")
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20
}

function getGmailQuery() {
  return process.env.GMAIL_SYNC_QUERY || DEFAULT_GMAIL_QUERY
}

function getDryRun(request: NextRequest) {
  const value = new URL(request.url).searchParams.get("dryRun")
  return value === "1" || value === "true"
}

function getBootstrapMode(request: NextRequest) {
  const value = new URL(request.url).searchParams.get("bootstrap")
  return value === "1" || value === "true"
}

function getSecretFromQuery(request: NextRequest) {
  return new URL(request.url).searchParams.get("secret") || ""
}

function highestHistoryId(current: string | undefined, next: string | undefined) {
  if (!current) return next
  if (!next) return current
  try {
    return BigInt(next) > BigInt(current) ? next : current
  } catch {
    return next
  }
}

async function getRecentMessageIds(gmail: gmail_v1.Gmail) {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: getGmailQuery(),
    maxResults: getMaxResults(),
    includeSpamTrash: false,
  })

  return {
    ids: (response.data.messages || []).map((message) => message.id || "").filter(Boolean),
    historyId: undefined as string | undefined,
  }
}

async function getMessageIdsFromHistory(gmail: gmail_v1.Gmail, startHistoryId: string) {
  const messageIds = new Set<string>()
  let nextPageToken: string | undefined
  let newestHistoryId: string | undefined

  do {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken: nextPageToken,
      maxResults: 100,
    })

    nextPageToken = response.data.nextPageToken || undefined
    newestHistoryId = highestHistoryId(newestHistoryId, response.data.historyId || undefined)

    for (const item of response.data.history || []) {
      newestHistoryId = highestHistoryId(newestHistoryId, item.id || undefined)
      for (const added of item.messagesAdded || []) {
        if (added.message?.id) {
          messageIds.add(added.message.id)
        }
      }
    }
  } while (nextPageToken)

  return {
    ids: [...messageIds],
    historyId: newestHistoryId,
  }
}

async function collectCandidateMessageIds(
  gmail: gmail_v1.Gmail,
  state: Awaited<ReturnType<typeof getGmailSyncState>>,
  bootstrapMode: boolean
) {
  if (bootstrapMode || !state.lastHistoryId) {
    return getRecentMessageIds(gmail)
  }

  try {
    return await getMessageIdsFromHistory(gmail, state.lastHistoryId)
  } catch (error: any) {
    if (error?.code === 404 || error?.response?.status === 404) {
      return getRecentMessageIds(gmail)
    }
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = getCronSecret()
    if (cronSecret) {
      const authHeader = request.headers.get("authorization")
      const querySecret = getSecretFromQuery(request)
      const headerMatches = authHeader === `Bearer ${cronSecret}`
      const queryMatches = querySecret === cronSecret

      if (!headerMatches && !queryMatches) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }
    }

    const dryRun = getDryRun(request)
    const bootstrapMode = getBootstrapMode(request)
    const gmail = await getAuthorizedGmailApi()
    const state = await getGmailSyncState()
    const candidateBatch = await collectCandidateMessageIds(gmail, state, bootstrapMode)
    const candidateIds = candidateBatch.ids.filter((id) => !state.processedMessageIds.includes(id))

    const processedIds: string[] = []
    const results: Array<Record<string, any>> = []
    let newestHistoryId = candidateBatch.historyId

    for (const messageId of candidateIds) {
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      })

      const message = messageResponse.data
      newestHistoryId = highestHistoryId(newestHistoryId, message.historyId || undefined)

      if (!isTargetNewebPayMessage(message)) {
        processedIds.push(messageId)
        continue
      }

      const parsed = parseNewebPayMessage(message)
      if (!parsed) {
        results.push({ messageId, status: "parse_failed" })
        continue
      }

      const syncResult = await syncPaymentEmail(parsed, { dryRun })
      results.push({
        messageId,
        subject: parsed.subject,
        merchantOrderNo: parsed.merchantOrderNo,
        periodNo: parsed.periodNo,
        resultText: parsed.resultText,
        sync: syncResult,
      })
      processedIds.push(messageId)
    }

    if (!dryRun && processedIds.length > 0) {
      await markMessagesProcessed(processedIds, newestHistoryId)
    } else if (!dryRun && newestHistoryId) {
      await updateGmailSyncState({
        lastHistoryId: newestHistoryId,
        lastSuccessfulPollAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      dryRun,
      bootstrapMode,
      query: getGmailQuery(),
      inspected: candidateIds.length,
      processed: processedIds.length,
      newestHistoryId: newestHistoryId || null,
      results,
    })
  } catch (error) {
    console.error("gmail-payment-sync failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "gmail-payment-sync failed",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
