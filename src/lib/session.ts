import { supabase } from "./supabase"

export async function ensureSession(code: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("code", code)
    .maybeSingle()

  if (error) throw error
  if (data) return data.id

  const { data: inserted, error: insertErr } = await supabase
    .from("sessions")
    .insert({ code })
    .select("id")
    .single()

  if (insertErr) throw insertErr
  return inserted.id
}