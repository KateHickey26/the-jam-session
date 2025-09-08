// src/lib/session.ts
import { supabase } from "./supabase"

export type DBSlimSession = { id: string; name: string; created_at: string }

// Accept a name, not a "code"
/**
 * Ensure a session row exists for the given code.
 * Returns the session id.
 *
 * Creation requires an authenticated user (RLS) and will set owner_id = that user.
 * If not authenticated, we ONLY allow finding an existing session by code.
 */
export async function ensureSession(code: string) {
  // 1) Try to find an existing session by its globally-unique code
  {
    const { data, error } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (error) throw error
    if (data?.id) return data.id
  }

  // 2) Not found → try to create (must be authenticated due to RLS)
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr) throw authErr

  if (!user) {
    // Not logged in: we can’t create (RLS will reject). Be explicit:
    throw new Error("Please sign in to create a new session.")
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("sessions")
    .insert({ code, owner_id: user.id })
    .select("id")
    .single()

  if (insertErr) throw insertErr
  return inserted.id
}

/** Latest session (by created_at) owned by this user */
export async function fetchLatestSessionForUser(userId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, code, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id, name: data.code as string }
}

/** Sessions this user owns or has participated in (via the view) */
export async function fetchUserSessions(): Promise<DBSlimSession[]> {
  const { data, error } = await supabase
    .from("my_sessions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as DBSlimSession[]
}