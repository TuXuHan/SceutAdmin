import { NextRequest, NextResponse } from 'next/server'
import { fetchPerfumeIntroduction } from '@/lib/google-sheets'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bbrnbyzjmxgxnczzymdt.supabase.co"
// 使用 SERVICE_ROLE_KEY 来绕过 RLS，让管理员可以访问所有数据
// 如果没有设置 SERVICE_ROLE_KEY，则回退到 ANON_KEY
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicm5ieXpqbXhneG5jenp5bWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwNDQ3ODcsImV4cCI6MjA2MDYyMDc4N30.S5BFoAq6idmTKLwGYa0bhxFVEoEmQ3voshyX03FVe0Y"

type PerfumeLookupItem = {
  number: string
  name: string
  brand: string
}

type PerfumeEntry = PerfumeLookupItem & {
  aliases: string[]
}

function normalizePerfumeName(value: unknown) {
  if (typeof value !== 'string') return ''

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[‐‑–—―ー]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizePerfumeAlias(value: unknown) {
  return normalizePerfumeName(value).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, '')
}

function buildPerfumeAliases(name: string, brand: string) {
  const candidates = [
    name,
    `${brand} ${name}`,
    `${brand}${name}`,
  ]

  return [...new Set(candidates.map(normalizePerfumeAlias).filter(Boolean))]
}

function buildLegacyAliases(name: string, brand: string, number: string) {
  const aliases = new Set<string>()
  const normalizedName = normalizePerfumeName(name)
  const normalizedBrand = normalizePerfumeName(brand)

  if (number === '1' || normalizedName.includes('イット')) {
    aliases.add(normalizePerfumeAlias('LovePassport-イット'))
    aliases.add(normalizePerfumeAlias('Love Passport イット'))
    aliases.add(normalizePerfumeAlias('Love Passport It'))
  }

  if (number === '9' || normalizedName.includes('さくらの香り')) {
    aliases.add(normalizePerfumeAlias('Fiancee-Sakura'))
    aliases.add(normalizePerfumeAlias('Fiancee Sakura'))
  }

  if (number === '10' || normalizedName.includes('roll-on ul')) {
    aliases.add(normalizePerfumeAlias('Fiancee parfum de Toilette Roll-on Ul'))
    aliases.add(normalizePerfumeAlias('parfum de Toilette Roll-on Ul'))
  }

  if (number === '11' || normalizedName.includes('星空の香り')) {
    aliases.add(normalizePerfumeAlias('Fiancee 星空の香り'))
    aliases.add(normalizePerfumeAlias('星空の香り'))
  }

  if ((normalizedBrand.includes('kogu') || brand === 'KOGU') && normalizedName.includes('amber')) {
    aliases.add(normalizePerfumeAlias('KOGU Amber'))
    aliases.add(normalizePerfumeAlias('Kogu—Amber'))
  }

  return [...aliases].filter(Boolean)
}

function levenshteinDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, index) =>
    Array.from({ length: b.length + 1 }, () => 0)
  )

  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  return dp[a.length][b.length]
}

async function buildPerfumeLookup() {
  const introductionData = await fetchPerfumeIntroduction()
  const perfumeLookup = new Map<string, PerfumeLookupItem>()
  const perfumeEntries: PerfumeEntry[] = []

  if (Array.isArray(introductionData)) {
    for (const table of introductionData) {
      for (const entry of table.data || []) {
        const name = entry["Product Name"]?.trim()
        if (!name) continue

        const brand = (entry["Brand Name"] || '').trim()
        const perfumeInfo = {
          number: (entry["No."] || '').trim(),
          name,
          brand,
        }

        const aliases = [
          ...buildPerfumeAliases(name, brand),
          ...buildLegacyAliases(name, brand, perfumeInfo.number),
        ]

        for (const alias of aliases) {
          perfumeLookup.set(alias, perfumeInfo)
        }

        perfumeEntries.push({
          ...perfumeInfo,
          aliases,
        })
      }
    }
  }

  return { perfumeLookup, perfumeEntries }
}

function resolvePerfumeInfo(
  perfumeName: string,
  perfumeLookup: Map<string, PerfumeLookupItem>,
  perfumeEntries: PerfumeEntry[]
) {
  const directMatch = perfumeLookup.get(normalizePerfumeAlias(perfumeName))
  if (directMatch) return directMatch

  const normalizedOrderName = normalizePerfumeAlias(perfumeName)
  if (!normalizedOrderName || normalizedOrderName.length < 6) return null

  for (const entry of perfumeEntries) {
    for (const alias of entry.aliases) {
      if (!alias) continue
      if (alias.includes(normalizedOrderName) || normalizedOrderName.includes(alias)) {
        return entry
      }
    }
  }

  let bestMatch: PerfumeEntry | null = null
  let bestScore = 0

  for (const entry of perfumeEntries) {
    for (const alias of entry.aliases) {
      if (!alias) continue

      const maxLength = Math.max(alias.length, normalizedOrderName.length)
      const distance = levenshteinDistance(normalizedOrderName, alias)
      const score = 1 - distance / maxLength

      if (score > bestScore) {
        bestScore = score
        bestMatch = entry
      }
    }
  }

  return bestScore >= 0.72 ? bestMatch : null
}

export async function GET(request: NextRequest) {
  try {
    // 獲取訂閱者列表
    const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!subscribersResponse.ok) {
      const errorBody = await subscribersResponse.text()
      console.error("❌ 獲取訂閱者失敗:", subscribersResponse.status, errorBody)
      throw new Error(`獲取訂閱者資料失敗: ${subscribersResponse.status} ${subscribersResponse.statusText}`)
    }

    const subscribers = await subscribersResponse.json()
    const filteredSubscribers = Array.isArray(subscribers)
      ? subscribers.filter((subscriber: any) => {
          const status = typeof subscriber?.subscription_status === 'string'
            ? subscriber.subscription_status.toLowerCase()
            : ''
          return status !== 'terminate' && status !== 'terminated'
        })
      : []

    const [ordersResponse, perfumeData] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=user_id,customer_email,subscriber_name,perfume_name,order_status,created_at&perfume_name=not.is.null&order_status=in.(shipped,shippped,delivered)&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }),
      buildPerfumeLookup(),
    ])

    const orders = ordersResponse.ok ? await ordersResponse.json() : []
    const { perfumeLookup, perfumeEntries } = perfumeData

    const shippedPerfumesBySubscriber = new Map<string, Array<{ number: string; name: string }>>()

    for (const subscriber of filteredSubscribers) {
      const matchedOrders = (Array.isArray(orders) ? orders : []).filter((order: any) => {
        const sameUserId = subscriber.user_id && order.user_id && subscriber.user_id === order.user_id
        const sameEmail = subscriber.email && order.customer_email && subscriber.email === order.customer_email
        const sameName = subscriber.name && order.subscriber_name && subscriber.name === order.subscriber_name
        return sameUserId || sameEmail || sameName
      })

      const uniquePerfumes = new Map<string, { number: string; name: string }>()

      for (const order of matchedOrders) {
        const perfumeName = typeof order.perfume_name === 'string' ? order.perfume_name.trim() : ''
        if (!perfumeName) continue

        const perfumeInfo = resolvePerfumeInfo(perfumeName, perfumeLookup, perfumeEntries)
        uniquePerfumes.set(normalizePerfumeAlias(perfumeName), {
          number: perfumeInfo?.number || '',
          name: perfumeInfo?.name || perfumeName,
        })
      }

      shippedPerfumesBySubscriber.set(String(subscriber.id), [...uniquePerfumes.values()])
    }

    const enrichedSubscribers = filteredSubscribers.map((subscriber: any) => ({
      ...subscriber,
      shipped_perfumes: shippedPerfumesBySubscriber.get(String(subscriber.id)) || [],
    }))

    return NextResponse.json({ 
      success: true, 
      subscribers: enrichedSubscribers,
      count: enrichedSubscribers.length
    })

  } catch (error) {
    console.error("❌ API錯誤:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "獲取訂閱者資料失敗" 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'sync') {
      // 1. 獲取所有 user_profiles
      const profilesResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!profilesResponse.ok) {
        throw new Error(`獲取用戶資料失敗: ${profilesResponse.statusText}`)
      }

      const profiles = await profilesResponse.json()

      // 2. 獲取所有 subscribers
      const subscribersResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (!subscribersResponse.ok) {
        throw new Error(`獲取訂閱者資料失敗: ${subscribersResponse.statusText}`)
      }

      const subscribers = await subscribersResponse.json()

      // 3. 同步資料 - 只更新現有的subscribers，不創建新的
      let syncedCount = 0
      let skippedCount = 0
      const errors: string[] = []

      // 只處理現有的subscribers，從user_profiles更新他們的資料
      for (const subscriber of subscribers) {
        try {
          // 找到對應的user_profile
          const profile = profiles.find((prof: any) => 
            prof.id === subscriber.user_id || prof.email === subscriber.email
          )
          
          if (!profile) {
            skippedCount++
            continue
          }

          // 更新現有的 subscriber
          const updateData: any = {}
            
          // 不同步 email 欄位
          // if (profile.email && profile.email !== subscriber.email) {
          //   updateData.email = profile.email
          // }
          if (profile.name && profile.name !== subscriber.name) {
            updateData.name = profile.name
          }
          if (profile.phone && profile.phone !== subscriber.phone) {
            updateData.phone = profile.phone
          }
          if (profile.user_id && profile.user_id !== subscriber.user_id) {
            updateData.user_id = profile.id
          }
          // 同步 quiz_answers
          if (profile.quiz_answers && JSON.stringify(profile.quiz_answers) !== JSON.stringify(subscriber.quiz_answers)) {
            updateData.quiz_answers = profile.quiz_answers
          }
          // 同步 delivery_method
          if (profile.delivery_method && profile.delivery_method !== subscriber.delivery_method) {
            updateData.delivery_method = profile.delivery_method
          }
          // 同步 711 門市資訊
          if (profile["711"] && profile["711"] !== subscriber["711"]) {
            updateData["711"] = profile["711"]
          }
          // 同步地址相關資訊
          if (profile.address && profile.address !== subscriber.address) {
            updateData.address = profile.address
          }
          if (profile.city && profile.city !== subscriber.city) {
            updateData.city = profile.city
          }
          if (profile.postal_code && profile.postal_code !== subscriber.postal_code) {
            updateData.postal_code = profile.postal_code
          }
          if (profile.country && profile.country !== subscriber.country) {
            updateData.country = profile.country
          }

          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString()

            const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${subscriber.id}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(updateData)
            })

            if (updateResponse.ok) {
              syncedCount++
            } else {
              const errorText = await updateResponse.text()
              errors.push(`更新 ${subscriber.email} 失敗: ${errorText}`)
            }
          }
        } catch (err) {
          errors.push(`處理 ${subscriber.email} 時發生錯誤: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return NextResponse.json({
        success: true,
        message: `同步完成`,
        stats: {
          totalSubscribers: subscribers.length,
          synced: syncedCount,
          skipped: skippedCount,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      })
    }

    return NextResponse.json(
      { success: false, error: '無效的操作' },
      { status: 400 }
    )

  } catch (error) {
    console.error("❌ 同步失敗:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "同步訂閱者資料失敗" 
      },
      { status: 500 }
    )
  }
}
