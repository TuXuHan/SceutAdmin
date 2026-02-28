import { NextRequest, NextResponse } from 'next/server'
import { fetchPerfumeIntroduction } from '@/lib/google-sheets'

/**
 * GET - 獲取所有香水列表（從 Google Sheets）
 * 返回格式：{ success: true, perfumes: [{ number: string, name: string, brand: string }] }
 */
export async function GET(request: NextRequest) {
  try {
    const introductionData = await fetchPerfumeIntroduction()
    
    // 從 introductionData 中提取香水列表
    const perfumes: Array<{ number: string; name: string; brand: string }> = []
    
    if (introductionData && introductionData.length > 0) {
      const allEntries = introductionData.flatMap(table => table.data || [])
      
      allEntries.forEach((entry) => {
        const number = entry["No."] || ""
        const name = entry["Product Name"] || ""
        const brand = entry["Brand Name"] || ""
        
        if (name) {
          perfumes.push({
            number: number.trim(),
            name: name.trim(),
            brand: brand.trim(),
          })
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      perfumes,
      count: perfumes.length,
    })
  } catch (error) {
    console.error('獲取香水列表失敗:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch perfumes',
        perfumes: [],
      },
      { status: 500 }
    )
  }
}
