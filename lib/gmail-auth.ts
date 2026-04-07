import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
const STORAGE_DIR = path.join(process.cwd(), ".runtime")
const STORAGE_PATH = path.join(STORAGE_DIR, "gmail-sync.json")
const SUPABASE_STATE_TABLE = "gmail_sync_state"
const SUPABASE_STATE_KEY = "default"
const OAUTH_STATE_COOKIE = "gmail_oauth_state"
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
const PROCESSING_CACHE_LIMIT = 200

type StoredSyncFile = {
  refreshToken?: string
  lastHistoryId?: string
  processedMessageIds?: string[]
  oauthConfiguredAt?: string
  lastSuccessfulPollAt?: string
}

export type GmailSyncState = {
  lastHistoryId?: string
  processedMessageIds: string[]
  oauthConfiguredAt?: string
  lastSuccessfulPollAt?: string
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getStorageSecret() {
  return requireEnv("GMAIL_SYNC_STORAGE_SECRET")
}

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest()
}

function getSupabaseAdminClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key)
}

function encrypt(text: string, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`
}

function decrypt(payload: string, secret: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored Gmail token is malformed")
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

async function ensureStorageDir() {
  await mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 })
}

async function readStoredFile(): Promise<StoredSyncFile> {
  try {
    const raw = await readFile(STORAGE_PATH, "utf8")
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed ? parsed : {}
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return {}
    }
    throw error
  }
}

async function writeStoredFile(next: StoredSyncFile) {
  await ensureStorageDir()
  await writeFile(STORAGE_PATH, JSON.stringify(next, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  })
}

function shouldPreferSupabaseStorage() {
  return process.env.GMAIL_SYNC_USE_SUPABASE === "true" || process.env.VERCEL === "1"
}

async function readStoredStateFromSupabase(): Promise<StoredSyncFile> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from(SUPABASE_STATE_TABLE)
    .select("value")
    .eq("key", SUPABASE_STATE_KEY)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read Gmail sync state from Supabase: ${error.message}`)
  }

  return typeof data?.value === "object" && data.value ? data.value : {}
}

async function writeStoredStateToSupabase(next: StoredSyncFile) {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from(SUPABASE_STATE_TABLE)
    .upsert(
      {
        key: SUPABASE_STATE_KEY,
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )

  if (error) {
    throw new Error(`Failed to write Gmail sync state to Supabase: ${error.message}`)
  }
}

async function readStoredState(): Promise<StoredSyncFile> {
  if (shouldPreferSupabaseStorage()) {
    return readStoredStateFromSupabase()
  }
  return readStoredFile()
}

async function writeStoredState(next: StoredSyncFile) {
  if (shouldPreferSupabaseStorage()) {
    return writeStoredStateToSupabase(next)
  }
  return writeStoredFile(next)
}

export function getGmailOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_GMAIL_CLIENT_ID"),
    requireEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
    redirectUri || requireEnv("GOOGLE_GMAIL_REDIRECT_URI")
  )
}

export function createOauthState() {
  return `${Date.now()}.${randomBytes(18).toString("hex")}`
}

export function validateOauthState(state: string) {
  const [timestamp] = state.split(".")
  const createdAt = Number(timestamp)
  return Number.isFinite(createdAt) && Date.now() - createdAt <= OAUTH_STATE_TTL_MS
}

export function getOauthStateCookieName() {
  return OAUTH_STATE_COOKIE
}

export function createGmailAuthUrl(state: string) {
  const client = getGmailOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GMAIL_SCOPES,
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = getGmailOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error("Google OAuth did not return a refresh token. Please revoke consent and retry.")
  }
  return tokens
}

export async function saveRefreshToken(refreshToken: string) {
  const secret = getStorageSecret()
  const current = await readStoredState()
  await writeStoredState({
    ...current,
    refreshToken: encrypt(refreshToken, secret),
    oauthConfiguredAt: new Date().toISOString(),
  })
}

export async function getStoredRefreshToken() {
  if (process.env.GMAIL_REFRESH_TOKEN) {
    return process.env.GMAIL_REFRESH_TOKEN
  }

  const current = await readStoredState()
  if (!current.refreshToken) {
    return null
  }

  return decrypt(current.refreshToken, getStorageSecret())
}

export async function getGmailSyncState(): Promise<GmailSyncState> {
  const current = await readStoredState()
  return {
    lastHistoryId: current.lastHistoryId,
    processedMessageIds: Array.isArray(current.processedMessageIds) ? current.processedMessageIds : [],
    oauthConfiguredAt: current.oauthConfiguredAt,
    lastSuccessfulPollAt: current.lastSuccessfulPollAt,
  }
}

export async function updateGmailSyncState(update: Partial<GmailSyncState>) {
  const current = await readStoredState()
  const processedMessageIds = Array.isArray(update.processedMessageIds)
    ? update.processedMessageIds.slice(-PROCESSING_CACHE_LIMIT)
    : Array.isArray(current.processedMessageIds)
      ? current.processedMessageIds.slice(-PROCESSING_CACHE_LIMIT)
      : []

  await writeStoredState({
    ...current,
    lastHistoryId: update.lastHistoryId ?? current.lastHistoryId,
    lastSuccessfulPollAt: update.lastSuccessfulPollAt ?? current.lastSuccessfulPollAt,
    oauthConfiguredAt: update.oauthConfiguredAt ?? current.oauthConfiguredAt,
    processedMessageIds,
  })
}

export async function markMessagesProcessed(messageIds: string[], nextHistoryId?: string) {
  const current = await getGmailSyncState()
  const merged = [...new Set([...current.processedMessageIds, ...messageIds])]
  await updateGmailSyncState({
    processedMessageIds: merged.slice(-PROCESSING_CACHE_LIMIT),
    lastHistoryId: nextHistoryId ?? current.lastHistoryId,
    lastSuccessfulPollAt: new Date().toISOString(),
  })
}

export async function getAuthorizedGmailClient() {
  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) {
    throw new Error("Gmail OAuth is not configured. Complete /api/gmail/oauth/start first.")
  }

  const client = getGmailOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export async function getAuthorizedGmailApi() {
  const auth = await getAuthorizedGmailClient()
  return google.gmail({ version: "v1", auth })
}
