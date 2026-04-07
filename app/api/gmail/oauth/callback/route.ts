import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  exchangeCodeForTokens,
  getOauthStateCookieName,
  saveRefreshToken,
  updateGmailSyncState,
  validateOauthState,
} from "@/lib/gmail-auth"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")

    if (error) {
      return NextResponse.json({ success: false, error }, { status: 400 })
    }

    const cookieStore = cookies()
    const expectedState = cookieStore.get(getOauthStateCookieName())?.value
    cookieStore.delete(getOauthStateCookieName())

    if (!code || !state || !expectedState || expectedState !== state || !validateOauthState(state)) {
      return NextResponse.json({ success: false, error: "Invalid OAuth state or missing code" }, { status: 400 })
    }

    const tokens = await exchangeCodeForTokens(code)
    await saveRefreshToken(tokens.refresh_token!)
    await updateGmailSyncState({
      oauthConfiguredAt: new Date().toISOString(),
    })

    return new NextResponse(
      [
        "<html><body style=\"font-family: sans-serif; padding: 24px;\">",
        "<h1>Gmail OAuth configured</h1>",
        "<p>`sceut.tw@gmail.com` 的 Gmail 讀信授權已完成，現在可以執行 `/api/cron/gmail-payment-sync`。</p>",
        "</body></html>",
      ].join(""),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "OAuth callback failed",
      },
      { status: 500 }
    )
  }
}
