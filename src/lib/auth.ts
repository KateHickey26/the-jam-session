import { supabase } from "./supabase"

export type MinimalUser = { id: string; email: string | null } | null

export async function getCurrentUser(): Promise<MinimalUser> {
    const { data } = await supabase.auth.getUser()
    const u = data.user
    return u ? { id: u.id, email: u.email ?? null } : null
  }

  export function onAuthChange(cb: (user: MinimalUser) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      cb(u ? { id: u.id, email: u.email ?? null } : null)
    })
    return { data: { subscription } }
  }

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({ provider: "google" })
}

export async function sendMagicLink(email: string) {
  await supabase.auth.signInWithOtp({ email })
}

export async function signOut() {
  await supabase.auth.signOut()
}