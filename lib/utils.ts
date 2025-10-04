import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 添加缺少的導出函數
export function getPreferenceText(preference: string, type?: string) {
  if (!preference) return "未知"

  const preferenceMap: Record<string, string> = {
    fresh: "清新",
    warm: "溫暖",
    woody: "木質",
    sophisticated: "精緻",
    playful: "活潑",
    classic: "經典",
    modern: "現代",
    intense: "濃烈",
    soft: "柔和",
    bold: "鮮明",
    subtle: "微妙",
  }

  const feelMap: Record<string, string> = {
    relaxed: "從容自在",
    confident: "自信果敢",
    sensual: "感性優雅",
    playful: "俏皮活潑",
    sexy: "性感魅力",
    sophisticated: "精緻優雅",
    adventurous: "冒險不羈",
    mysterious: "神秘迷人",
    outgoing: "外向活力",
  }

  if (type === "feel" && feelMap[preference]) {
    return feelMap[preference]
  }

  return preferenceMap[preference] || preference
}

export function getRecommendedFragrance(brand: any, quizAnswers: any) {
  // 根據品牌和用戶偏好推薦香水
  const fragranceRecommendations: Record<string, Record<string, string>> = {
    chanel: {
      feminine: "Chanel No.5",
      masculine: "Bleu de Chanel",
    },
    dior: {
      feminine: "J'adore",
      masculine: "Sauvage",
    },
    hermes: {
      feminine: "Twilly d'Hermès",
      masculine: "Terre d'Hermès",
    },
    tomford: {
      feminine: "Black Orchid",
      masculine: "Oud Wood",
    },
    creed: {
      feminine: "Aventus for Her",
      masculine: "Aventus",
    },
    guerlain: {
      feminine: "Shalimar",
      masculine: "Habit Rouge",
    },
    ysl: {
      feminine: "Black Opium",
      masculine: "La Nuit de L'Homme",
    },
  }

  const genderKey = quizAnswers.gender === "feminine" ? "feminine" : "masculine"

  if (fragranceRecommendations[brand.id] && fragranceRecommendations[brand.id][genderKey]) {
    return fragranceRecommendations[brand.id][genderKey]
  }

  return "品牌代表作品" // 備用推薦
}
