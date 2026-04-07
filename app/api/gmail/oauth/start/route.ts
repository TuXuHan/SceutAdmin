import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createGmailAuthUrl, createOauthState, getOauthStateCookieName } from "@/lib/gmail-auth"

export async function GET() {
  const state = createOauthState()
  const cookieStore = cookies()
  cookieStore.set(getOauthStateCookieName(), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  })

  return NextResponse.redirect(createGmailAuthUrl(state))
}
