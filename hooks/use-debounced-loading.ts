import { useState, useCallback, useRef } from 'react'

interface UseDebouncedLoadingOptions {
  debounceMs?: number
  maxRetries?: number
}

export function useDebouncedLoading(options: UseDebouncedLoadingOptions = {}) {
  const { debounceMs = 1000, maxRetries = 1 } = options
  const [loading, setLoading] = useState(true)
  const [lastLoadTime, setLastLoadTime] = useState(0)
  const retryCount = useRef(0)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const shouldSkipLoad = useCallback((forceReload: boolean = false): boolean => {
    const now = Date.now()
    
    // 如果是强制重新加载，直接允许加载，不进行防抖
    if (forceReload) {
      console.log("🔄 強制重新載入：跳過防抖檢查")
      retryCount.current = 0 // 重置重试计数
      return false // 不跳过，允许加载
    }
    
    // 普通加载的防抖逻辑
    if (lastLoadTime > 0 && now - lastLoadTime < debounceMs) {
      console.log("⏳ 防抖：跳過頻繁重新載入")
      return true
    }
    
    return false
  }, [lastLoadTime, debounceMs, maxRetries])

  const startLoading = useCallback(() => {
    setLoading(true)
    setLastLoadTime(Date.now())
    
    // 设置超时保护，防止加载状态卡住
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log("⚠️ 載入超時，自動重置載入狀態")
      setLoading(false)
    }, 3000) // 3秒超时
  }, [])

  const stopLoading = useCallback(() => {
    setLoading(false)
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  const resetRetryCount = useCallback(() => {
    retryCount.current = 0
  }, [])

  const resetLoadingState = useCallback(() => {
    retryCount.current = 0
    setLastLoadTime(0)
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }
  }, [])

  return {
    loading,
    setLoading,
    startLoading,
    stopLoading,
    shouldSkipLoad,
    resetRetryCount,
    resetLoadingState,
    lastLoadTime,
    setLastLoadTime
  }
}
