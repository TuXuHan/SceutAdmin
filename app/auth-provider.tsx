"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User, SupabaseClient, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

interface AuthContextType {
  supabase: SupabaseClient
  isAuthenticated: boolean
  user: User | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>
  logout: () => Promise<void>
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>
}

const AuthContext = createContext<AuthContextType>({
  supabase: createClient(),
  isAuthenticated: false,
  user: null,
  session: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  register: async () => ({ success: false }),
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseClient = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession()
        
        if (error) {
          console.error("Error getting session:", error)
        }

        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (error) {
        console.error("Error in getUser:", error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getUser()

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        console.error("Login error:", error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, error: "登入失敗" }
    }
  }

  const logout = async () => {
    try {
      await supabaseClient.auth.signOut()
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const register = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      })

      if (error) {
        console.error("Register error:", error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error("Register error:", error)
      return { success: false, error: "註冊失敗" }
    }
  }

  const value = {
    supabase: supabaseClient,
    isAuthenticated: !!user,
    user,
    session,
    loading,
    login,
    logout,
    register,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
