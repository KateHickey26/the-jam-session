import { supabase } from "./supabase"

export type DBAlbum = {
  id: string
  session_id: string
  title: string
  artist: string
  cover: string | null
  created_at: string // timestamp as ISO string
}

export type NewAlbumInput = { 
  title: string; 
  artist: string; 
  cover?: string | null 
};


export async function fetchAlbums(sessionId: string) {
  const { data, error } = await supabase
    .from("albums")
    .select("*")
    .eq("session_id", sessionId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as DBAlbum[];
}

export function subscribeAlbums(sessionId: string, onChange: () => void) {
  const channel = supabase
    .channel(`albums:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',          // insert | update | delete
        schema: 'public',
        table: 'albums',
        filter: `session_id=eq.${sessionId}`, // only this session's rows
      },
      // () => onChange()
      // Handy trace so can see it firing, can remove this later
      (payload) => {
        console.log('[albums realtime]', payload.eventType, payload.new || payload.old)
        onChange()
      }
    )
    //.subscribe()
    // can remove console log later
    .subscribe((status) => {
      console.log('[albums channel]', status) // 'SUBSCRIBED' once ready
    })

  // return an unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

export async function addAlbumRow(sessionId: string, title: string, artist: string, cover?: string) {
  const { error } = await supabase
    .from("albums")
    .insert({ session_id: sessionId, title, artist, cover: cover ?? null })
  if (error) throw error
}

export async function deleteAlbumRow(id: string) {
  const { error } = await supabase.from("albums").delete().eq("id", id)
  if (error) throw error
}

export async function fetchPantry(sessionId: string) {
  const { data, error } = await supabase
    .from("albums")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as DBAlbum[];
}

export async function archiveAlbumRow(albumId: string) {
  const { error } = await supabase
    .from("albums")
    .update({ is_active: false })
    .eq("id", albumId);
  if (error) throw error;
}

export async function restoreAlbumRow(albumId: string) {
  const { error } = await supabase
    .from("albums")
    .update({ is_active: true })
    .eq("id", albumId);
  if (error) throw error;
}

export async function bulkAddAlbums(sessionId: string, items: NewAlbumInput[]): Promise<DBAlbum[]> {
  if (!items.length) return [];

  const rows = items
    .map(a => ({
      session_id: sessionId,
      title: a.title?.trim(),
      artist: a.artist?.trim(),
      cover: a.cover ?? null,
    }))
    .filter(a => a.title && a.artist);

  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = `${r.title.toLowerCase()}::${r.artist.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const chunkSize = 50;
  const inserted: DBAlbum[] = [];

  for (let i = 0; i < unique.length; i += chunkSize) {
    const slice = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("albums")
      .insert(slice)
      .select();
    if (error) throw error;
    if (data) inserted.push(...(data as DBAlbum[]));
  }

  return inserted;
}