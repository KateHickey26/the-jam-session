"use client";

import Image from "next/image"
import React, { useEffect, useMemo, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Copy, Dice1, Download, LinkIcon, Plus, Trash2, Upload, Users, Wand2 } from "lucide-react"
import { ensureSession } from "@/lib/session"
import {
  fetchAlbums,
  subscribeAlbums,
  addAlbumRow,
  deleteAlbumRow,
  type DBAlbum,
} from "@/lib/albums"
import {
  upsertVote,
  deleteVote,
  fetchMyVotes,
  fetchStats,
  subscribeVotes,
  clearVotesForUserInSession,
  type PreferenceValue,
} from "@/lib/supabase"

// ---- Types ----
export type Album = {
  id: string
  title: string
  artist: string
  cover?: string
  createdAt: number
}

// 1 = most wanted ... 3 = not this week
export const PREFERENCE = [
  { value: 1, label: "I'm dying to listen to this", dot: "💙", bg: "bg-jam-blueberry/10",  ring: "ring-jam-blueberry/40",  text: "text-jam-blueberry" },
  { value: 2, label: "I could listen to this this week", dot: "🍊", bg: "bg-jam-apricot/10", ring: "ring-jam-apricot/40", text: "text-jam-apricot" },
  { value: 3, label: "I don't fancy this this week", dot: "😶", bg: "bg-zinc-100", ring: "ring-zinc-300", text: "text-zinc-500" },
] as const

function dbToAlbum(row: DBAlbum): Album {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    cover: row.cover ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  }
}

function myVoteColorClasses(my?: number) {
  if (typeof my !== "number") return { card: "", badge: "" }
  const opt = PREFERENCE.find(p => p.value === my)
  if (!opt) return { card: "", badge: "" }
  return {
    card: `${opt.bg} ring-1 ${opt.ring}`,
    badge: `${opt.text}`,
  }
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

// Tiny Levenshtein (for suggestions)
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

// Build unique candidate lists from current albums
function buildCandidates(albums: Album[]) {
  const titles = new Set<string>()
  const artists = new Set<string>()
  for (const a of albums) { titles.add(a.title); artists.add(a.artist) }
  return { titles: Array.from(titles), artists: Array.from(artists) }
}

function suggestClose(input: string, candidates: string[], maxDistance = 2) {
  const inp = norm(input)
  if (!inp) return []
  const scored = candidates.map(c => ({ c, d: levenshtein(inp, norm(c)) }))
  scored.sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
  return scored.filter(x => x.d <= maxDistance).slice(0, 5).map(x => x.c)
}

// sorting based on users votes
function rankAlbumsByMyVote(
  albums: Album[],
  myVotes: Record<string, PreferenceValue | undefined>
) {
  // Order: 1 (yes) → 2 (could) → 3 (no) → unvoted
  return [...albums].sort((a, b) => {
    const va = myVotes[a.id] ?? 99
    const vb = myVotes[b.id] ?? 99
    if (va !== vb) return va - vb
    // tie-breaker: alphabetical
    const t = a.title.localeCompare(b.title)
    return t !== 0 ? t : a.artist.localeCompare(b.artist)
  })
}

// ---- Main Component ----
export default function JamApp() {
  const [session, setSession] = useState<string>(() => new URLSearchParams(location.search).get("session") || "demo session")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [albums, setAlbums] = useState<Album[]>([])
  const [newAlbumTitle, setNewAlbumTitle] = useState("")
  const [newAlbumArtist, setNewAlbumArtist] = useState("")
  const [cover, setCover] = useState("")
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])
  const [artistSuggestions, setArtistSuggestions] = useState<string[]>([])
  const titleListId = "jam-title-list"
  const artistListId = "jam-artist-list"
  const [userName, setUserName] = useState<string>(() => localStorage.getItem("the-jam-session/userName") || "")
  const [picked, setPicked] = useState<Album | null>(null)

  // user identity (ephemeral; not stored server-side)
  const [userId] = useState<string>(() => {
    const k = "the-jam-session/userId"
    const cached = localStorage.getItem(k)
    if (cached) return cached
    const id = uuidv4()
    localStorage.setItem(k, id)
    return id
  })

  // my vote per album (albumId -> 1|2|3)
  const [myVotes, setMyVotes] = useState<Record<string, PreferenceValue | undefined>>({})
  // group stats per album (albumId -> counts)
  const [stats, setStats] = useState<Record<string, { c1: number; c2: number; c3: number }>>({})

  useEffect(() => {
    let unsubAlbums: (() => void) | null = null
    let unsubVotes: (() => void) | null = null
    let alive = true

    ;(async () => {
      const id = await ensureSession(session)
      if (!alive) return
      setSessionId(id)

      // initial albums
      const rows = await fetchAlbums(id)
      if (!alive) return
      setAlbums(rows.map(dbToAlbum))

      // initial my votes + stats
      const [mv, st] = await Promise.all([fetchMyVotes(id, userId), fetchStats(id)])
      if (!alive) return
      setMyVotes(mv)
      setStats(st)

      // realtime: albums table (insert/delete)
      unsubAlbums = subscribeAlbums(id, async () => {
        const latest = await fetchAlbums(id)
        if (!alive) return
        setAlbums(latest.map(dbToAlbum))
      })

      // realtime: votes table (any change → refresh myVotes + stats)
      unsubVotes = subscribeVotes(async () => {
        const [mv2, st2] = await Promise.all([fetchMyVotes(id, userId), fetchStats(id)])
        if (!alive) return
        setMyVotes(mv2)
        setStats(st2)
      })
    })()

    return () => {
      alive = false
      if (unsubAlbums) unsubAlbums()
      if (unsubVotes) unsubVotes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userId])

  // update suggestions as user types to add an album (from current albums only)
  useEffect(() => {
    const { titles, artists } = buildCandidates(albums)
    setTitleSuggestions(suggestClose(newAlbumTitle, titles))
    setArtistSuggestions(suggestClose(newAlbumArtist, artists))
  }, [newAlbumTitle, newAlbumArtist, albums])

  async function addAlbum() {
    const t = newAlbumTitle.trim()
    const a = newAlbumArtist.trim()
    const c = cover.trim()
    if (!t || !a) return
    if (!sessionId) {
      alert("Session not ready yet. Try again in a moment.")
      return
    }

    // exact duplicate check (case-insensitive)
    const key = `${t.toLowerCase()}::${a.toLowerCase()}`
    const existsExact = albums.some(
      (al) => `${al.title.toLowerCase()}::${al.artist.toLowerCase()}` === key
    )
    if (existsExact) {
      alert("That album is already on the list!")
      return
    }

    // soft near-duplicate nudge (optional)
    const nearTitle = suggestClose(t, albums.map((x) => x.title))[0]
    const nearArtist = suggestClose(a, albums.map((x) => x.artist))[0]
    if (nearTitle && nearArtist) {
      const proceed = confirm(`Looks close to “${nearTitle} — ${nearArtist}”. Add anyway?`)
      if (!proceed) return
    }

    try {
      await addAlbumRow(sessionId, t, a, c || undefined)
      setNewAlbumTitle("")
      setNewAlbumArtist("")
      setCover("")
    } catch (err) {
      console.error(err)
      alert("Could not add album. Please try again.")
    }
  }

  async function removeAlbum(id: string) {
    try {
      await deleteAlbumRow(id)
    } catch (err) {
      console.error(err)
      alert("Could not remove album. Please try again.")
    }
  }

  async function clearMyVotes() {
    if (!sessionId) return
    try {
      await clearVotesForUserInSession(sessionId, userId)
      // will refresh via realtime
    } catch (err) {
      console.error(err)
      alert("Could not clear your votes.")
    }
  }

  function hasBlockFromStats(s?: { c1: number; c2: number; c3: number }) {
    return !!s && s.c3 > 0
  }

  function weightFromStats(s?: { c1: number; c2: number; c3: number }) {
    if (!s) return 1
    if (s.c3 > 0) return 0
    const w = s.c1 * 5 + s.c2 * 3
    return w > 0 ? w : 1
  }

  function pickByRules() {
    const pool = albums
      .map(a => {
        const s = stats[a.id]
        return { album: a, weight: weightFromStats(s), blocked: hasBlockFromStats(s) }
      })
      .filter(x => !x.blocked)

    if (pool.length === 0) {
      if (albums.length === 0) return
      const choice = albums[Math.floor(Math.random() * albums.length)]
      setPicked(choice)
      return
    }

    const totalTickets = pool.reduce((acc, x) => acc + x.weight, 0)
    let r = Math.floor(Math.random() * totalTickets) + 1
    for (const x of pool) {
      r -= x.weight
      if (r <= 0) {
        setPicked(x.album)
        return
      }
    }
    setPicked(pool[pool.length - 1].album)
  }

  function exportJson() {
    download(`${session}-albums.json`, JSON.stringify({ session, albums }, null, 2))
  }

  function importJson(text: string) {
    // NOTE: this now only changes local UI state; the source of truth is Supabase.
    // We can wire this to bulk-insert later if you want.
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed.albums)) {
        setAlbums(parsed.albums as Album[])
      }
    } catch {
      // ignore for MVP
    }
  }

  function shareUrl() {
    return `${location.origin}${location.pathname}?session=${encodeURIComponent(session)}`
  }

  useEffect(() => {
    if (userName) localStorage.setItem("the-jam-session/userName", userName)
  }, [userName])

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-emerald-50 p-4 md:p-10">
      <div className="mx-auto max-w-6xl">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Image 
              src="/jam-session-logo-sbs-transparent.png" 
              alt="The Jam Session logo" 
              width={320}
              height={80}
              priority
            />
            <p className="text-sm text-muted-foreground">Vote on your Jams, then let chance decide from the top picks.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={session} onChange={(e) => setSession(e.target.value)} placeholder="Session name" className="w-44" />
            <Button variant="secondary" onClick={() => copyToClipboard(shareUrl())} title="Copy share link"><LinkIcon className="mr-2 h-4 w-4"/>Share</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline"><Upload className="mr-2 h-4 w-4"/>Import</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import JSON (local preview only)</DialogTitle>
                </DialogHeader>
                <Textarea placeholder="Paste JSON here" className="min-h-[160px]" onChange={(e) => importJson(e.target.value)} />
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={exportJson}><Download className="mr-2 h-4 w-4"/>Export</Button>
          </div>
        </motion.header>

        <div className="mb-6 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>Add album</span>
                <Badge variant="secondary" className="ml-2">Session: {session}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Input 
                  placeholder="Album title" 
                  value={newAlbumTitle} 
                  onChange={(e) => setNewAlbumTitle(e.target.value)} 
                  list={titleListId}
                />
                {newAlbumTitle && titleSuggestions.length > 0 && titleSuggestions[0].toLowerCase() !== newAlbumTitle.toLowerCase() && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Did you mean{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 text-jam-raspberry"
                      onClick={() => setNewAlbumTitle(titleSuggestions[0])}
                    >
                      {titleSuggestions[0]}
                    </button>
                    ?
                  </div>
                )}
                <Input 
                  placeholder="Artist" 
                  value={newAlbumArtist} 
                  onChange={(e) => setNewAlbumArtist(e.target.value)}
                  list={artistListId}
                />
                {newAlbumArtist && artistSuggestions.length > 0 && artistSuggestions[0].toLowerCase() !== newAlbumArtist.toLowerCase() && (
                  <div className="text-xs text-muted-foreground">
                    Did you mean{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 text-jam-raspberry"
                      onClick={() => setNewAlbumArtist(artistSuggestions[0])}
                    >
                      {artistSuggestions[0]}
                    </button>
                    ?
                  </div>
                )}
                <Input 
                  placeholder="Cover URL (optional)" 
                  value={cover} 
                  onChange={(e) => setCover(e.target.value)} 
                />
                <Button onClick={addAlbum}><Plus className="mr-2 h-4 w-4"/>Add</Button>

                <datalist id={titleListId}>
                  {titleSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
                <datalist id={artistListId}>
                  {artistSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>Your profile</span>
                <Users className="h-4 w-4"/>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Input placeholder="Your name (optional)" value={userName} onChange={(e) => setUserName(e.target.value)} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline"><Wand2 className="mr-2 h-4 w-4"/>Actions</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Voting</DropdownMenuLabel>
                    <DropdownMenuItem onClick={clearMyVotes}>Clear my votes</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Share</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => copyToClipboard(shareUrl())}><Copy className="mr-2 h-4 w-4"/>Copy link</DropdownMenuItem>
                    {/* Starter list removed (we're Supabase-first now) */}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="list" className="mb-6">
          <TabsList>
            <TabsTrigger value="list">Albums</TabsTrigger>
            <TabsTrigger value="pick">Pick</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAlbums(prev => rankAlbumsByMyVote(prev, myVotes))}
              >
                Sort jams
              </Button>
                <Button variant="secondary" onClick={pickByRules}>
                  <Dice1 className="mr-2 h-4 w-4" /> Spread the Pick
                </Button>
                <Button variant="ghost" onClick={() => setAlbums([...albums].sort((a,b) => a.createdAt - b.createdAt))}>
                  Reset order
                </Button>
              </div>
            </div>

            <Separator className="mb-4"/>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {albums.map((al) => {
                const my = myVotes[al.id]
                const colors = myVoteColorClasses(my)
                return (
                  <motion.div key={al.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className={`overflow-hidden ${colors.card}`}>
                      <div className="flex gap-4 p-4">
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                          {al.cover ? (
                            <img src={al.cover} alt={`${al.title} cover`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No cover</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="truncate text-base font-semibold">{al.title}</div>
                              <div className="truncate text-sm text-muted-foreground">{al.artist}</div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => removeAlbum(al.id)} title="Remove">
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          </div>

                          <div className="mt-1 text-xs">
                            <span className="text-muted-foreground">Your vote: </span>
                            <span className={`font-medium ${colors.badge}`}>
                              {typeof my === "number" ? PREFERENCE.find(p => p.value === my)?.label : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {PREFERENCE.map(p => (
                            <Button
                              key={p.value}
                              type="button"
                              variant={my === p.value ? "default" : "outline"}
                              className={my === p.value ? "" : "bg-white"}
                              onClick={async () => {
                                try {
                                  await upsertVote(al.id, userId, p.value)
                                } catch {
                                  alert("Could not save your vote.")
                                }
                              }}
                              title={p.label}
                            >
                              <span className="mr-1">{p.dot}</span> {p.value}
                            </Button>
                          ))}

                          {typeof my === "number" && (
                            <Button
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  await deleteVote(al.id, userId)
                                } catch {
                                  alert("Could not clear your vote.")
                                }
                              }}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="pick" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pick Our Weekly Jam</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Button onClick={pickByRules}>
                    <Dice1 className="mr-2 h-4 w-4" /> Pick now
                  </Button>
                </div>
                {picked ? (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid gap-4 md:grid-cols-[160px_1fr]">
                    <div className="h-40 w-40 overflow-hidden rounded-2xl bg-zinc-100">
                      {picked.cover ? (
                        <img src={picked.cover} alt={`${picked.title} cover`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No cover</div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold">{picked.title}</h3>
                      {/* <div className="mt-2 text-sm"> */}
                       {/* check this leaning / weighted ave data when two people vote */}
                        {/* Leaning (avg): {preferenceAverage(picked.votes)?.toFixed(2) ?? "—"} */}
                      {/* </div> */}
                    </div>
                  </motion.div>
                ) : (
                  <p className="text-sm text-muted-foreground">No pick yet. Press Pick now to choose.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>How this MVP works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Sessions are stored in Supabase. Share the session link so your friend joins the same room.
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Votes are private per user; group stats drive the random pick.</li>
                  <li>Random pick rules: “don’t fancy” excludes, “dying to listen” weighs most, “could listen” weighs less, and unvoted albums still get a small chance.</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}