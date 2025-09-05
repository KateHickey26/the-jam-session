import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ------------------
// Album helpers
// ------------------

export async function insertAlbum(sessionId: string, title: string, artist: string, cover?: string) {
  const { data, error } = await supabase
    .from("albums")
    .insert([{ session_id: sessionId, title, artist, cover }])
    .select()

  if (error) throw error
  return data
}

export async function deleteAlbum(albumId: string) {
  const { error } = await supabase.from("albums").delete().eq("id", albumId)
  if (error) throw error
}

// ------------------
// Vote helpers
// ------------------

export async function upsertVote(albumId: string, userId: string, value: number) {
  const { error } = await supabase
    .from("votes")
    .upsert(
      [{ album_id: albumId, user_id: userId, value }], // array of rows
      { onConflict: "album_id,user_id" }               // string, not array
    )

  if (error) throw error
}

export async function deleteVote(albumId: string, userId: string) {
  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("album_id", albumId)
    .eq("user_id", userId)

  if (error) throw error
}

// ---------- Types used by helpers ----------
// 1 = "I want to listen to this" (weight 5)
// 2 = "I could listen to this"   (weight 3)
// 3 = "I don't want this week"   (exclude — unless everything is excluded)
export type PreferenceValue = 1 | 2 | 3

export type StatRow = {
  album_id: string
  count_1: number
  count_2: number
  count_3: number
}

// ---------- Read my votes for a session ----------
export async function fetchMyVotes(sessionId: string, userId: string) {
  // We still use the join to filter by session, but we only TYPE the fields we read.
  const { data, error } = await supabase
    .from("votes")
    .select("album_id, value, albums!inner(session_id)")
    .eq("user_id", userId)
    .eq("albums.session_id", sessionId)

  if (error) throw error

  const rows = (data ?? []) as { album_id: string; value: PreferenceValue }[]
  const map: Record<string, PreferenceValue> = {}
  for (const row of rows) {
    map[row.album_id] = row.value
  }
  return map
}

// ---------- Read aggregated stats for a session ----------
// Return already in the compact { c1, c2, c3 } shape so the component
// doesn’t have to transform and introduce `any`.
export async function fetchStats(sessionId: string) {
  const { data, error } = await supabase
    .from("album_stats")
    .select("album_id, count_1, count_2, count_3, albums!inner(session_id)")
    .eq("albums.session_id", sessionId)

  if (error) throw error

  const rows = (data ?? []) as {
    album_id: string
    count_1: number
    count_2: number
    count_3: number
  }[]

  const map: Record<string, { c1: number; c2: number; c3: number }> = {}
  for (const r of rows) {
    map[r.album_id] = { c1: r.count_1 ?? 0, c2: r.count_2 ?? 0, c3: r.count_3 ?? 0 }
  }
  return map
}

// ---------- Subscribe to votes; call cb on any change ----------
export function subscribeVotes(onChange: () => void) {
  const channel = supabase
    .channel("votes-listener")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes" },
      () => onChange()
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

// ---------- Clear all my votes in the current session ----------
export async function clearVotesForUserInSession(sessionId: string, userId: string) {
  // get album ids for this session, then delete my votes for those
  const { data: albums, error: albumsErr } = await supabase
    .from("albums")
    .select("id")
    .eq("session_id", sessionId)

  if (albumsErr) throw albumsErr
  const ids = (albums || []).map(a => a.id)
  if (ids.length === 0) return

  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("user_id", userId)
    .in("album_id", ids)

  if (error) throw error
}