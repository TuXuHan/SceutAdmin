"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.push("/orders")
  }, [router])

  return (
    <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">重定向到訂單管理...</p>
      </div>
    </div>
  )
}
