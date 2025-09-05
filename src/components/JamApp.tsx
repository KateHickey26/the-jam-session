"use client";

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
import { JAM_SEEDS, type AlbumSeed } from "@/data/jamSeeds"

/**
 * The Jam App — lightweight shared album picker (client-only MVP)
 * -------------------------------------------------------------
 * Features
 * - Create a local "session" (by name) so you and a friend can use the same list.
 * - Add albums (title, artist, optional cover URL).
 * - Each participant sets their name and casts a 0–10 vote per album.
 * - Sorts by average score; shows per-user votes.
 * - Pick from top ranked albums
 * - Import/Export JSON for quick sharing between devices (no backend yet).
 * - LocalStorage persistence keyed by session name.
 *
 * Nice-to-haves queued for later (easy backend swap):
 * - Realtime sync via Supabase Realtime or Firebase.
 * - Spotify/Apple Music lookups to auto-fill album art & metadata.
 * - Weighted random draw (roulette) by score rather than uniform.
 * - Comments per album and simple chat.
 */

// ---- Types ----
export type VoteMap = Record<string, number | undefined> // key: userId
export type Album = {
  id: string
  title: string
  artist: string
  cover?: string
  votes: VoteMap
  createdAt: number
}

// ---- Helpers ----
const STORAGE_KEY = (session: string) => `the-jam-session/${session}`

// 1 = most wanted ... 4 = least wanted
export const PREFERENCE = [
  { value: 1, label: "I'm dying to listen to this", dot: "💙", bg: "bg-jam-blueberry/10",  ring: "ring-jam-blueberry/40",  text: "text-jam-blueberry" },
  // { value: 2, label: "I would like to listen to this",  dot: "❤️",  bg: "bg-jam-strawberry/10", ring: "ring-jam-strawberry/40", text: "text-jam-strawberry" },
  { value: 2, label: "I could listen to this this week",         dot: "🍊", bg: "bg-jam-apricot/10",    ring: "ring-jam-apricot/40",    text: "text-jam-apricot" },
  { value: 3, label: "I don't fancy this this week",    dot: "😶", bg: "bg-zinc-100",         ring: "ring-zinc-300",          text: "text-zinc-500" },
] as const

function preferenceAverage(votes: VoteMap): number | null {
  const vals = Object.values(votes).filter((v): v is number => typeof v === "number")
  if (!vals.length) return null
  const sum = vals.reduce((a, b) => a + b, 0)
  return +(sum / vals.length) // lower is better
}

// sort by ascending average (1 is best). Untouched albums (null) go last.
// tie-break on createdAt (earlier first).
function rankAlbumsByPreference(albums: Album[]) {
  return [...albums].sort((a, b) => {
    const aa = preferenceAverage(a.votes)
    const bb = preferenceAverage(b.votes)
    if (aa === null && bb === null) {
      // neither has votes → alphabetical by title, then artist
      const t = a.title.localeCompare(b.title)
      return t !== 0 ? t : a.artist.localeCompare(b.artist)
    }
    if (aa === null) return 1
    if (bb === null) return -1
    if (aa !== bb) return aa - bb
    // tie-breaker: alphabetical by title, then artist
    const t = a.title.localeCompare(b.title)
    return t !== 0 ? t : a.artist.localeCompare(b.artist)
  })
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

function loadSession(session: string): Album[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(session))
    return raw ? (JSON.parse(raw) as Album[]) : []
  } catch {
    return []
  }
}

function saveSession(session: string, albums: Album[]) {
  try {
    localStorage.setItem(STORAGE_KEY(session), JSON.stringify(albums))
  } catch {
    // no-op
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

function seedsToAlbums(seeds: AlbumSeed[]): Album[] {
  const now = Date.now()
  return seeds.map((s, i) => ({
    id: uuidv4(),
    title: s.title.trim(),
    artist: s.artist.trim(),
    cover: s.cover?.trim() || undefined,
    votes: {},
    createdAt: now + i, // preserve seed order
  }))
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

// Tiny Levenshtein (good enough for short names)
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
        dp[i - 1][j] + 1,      // delete
        dp[i][j - 1] + 1,      // insert
        dp[i - 1][j - 1] + cost // replace
      )
    }
  }
  return dp[m][n]
}

// Build unique candidate lists from current albums + seeds
function buildCandidates(albums: Album[], seeds: { title: string; artist: string }[]) {
  const titles = new Set<string>()
  const artists = new Set<string>()
  for (const a of albums) { titles.add(a.title); artists.add(a.artist) }
  for (const s of seeds)  { titles.add(s.title); artists.add(s.artist) }
  return { titles: Array.from(titles), artists: Array.from(artists) }
}

// Suggest close matches (distance <= 2 by default)
function suggestClose(input: string, candidates: string[], maxDistance = 2) {
  const inp = norm(input)
  if (!inp) return []
  const scored = candidates.map(c => ({ c, d: levenshtein(inp, norm(c)) }))
  scored.sort((x, y) => x.d - y.d || x.c.localeCompare(y.c))
  return scored.filter(x => x.d <= maxDistance).slice(0, 5).map(x => x.c)
}

// 1 = "I want to listen to this" (weight 5)
// 2 = "I could listen to this"   (weight 3)
// 3 = "I don't want this week"   (exclude — unless everything is excluded)
type PreferenceValue = 1 | 2 | 3

function hasBlock(votes: VoteMap): boolean {
  return Object.values(votes).some(v => v === 3)
}

function weightFromVotes(votes: VoteMap): number {
  let weight = 0
  for (const v of Object.values(votes)) {
    if (v === 1) weight += 5
    else if (v === 2) weight += 3
    // v === 3 handled by hasBlock (exclusion)
  }
  // No votes (and not blocked) → minimal weight 1
  return weight > 0 ? weight : 1
}

function buildChoicePool(albums: Album[]): {
  eligible: (Album & { __weight: number })[],
  totalTickets: number
} {
  const eligible: (Album & { __weight: number })[] = []

  for (const a of albums) {
    if (hasBlock(a.votes)) continue
    const w = weightFromVotes(a.votes)
    eligible.push({ ...a, __weight: w } as Album & { __weight: number })
  }

  const totalTickets = eligible.reduce((acc, a) => acc + a.__weight, 0)
  return { eligible, totalTickets }
}

function weightedPick(pool: (Album & { __weight: number })[], tickets: number): Album {
  let r = Math.floor(Math.random() * tickets) + 1
  for (const a of pool) {
    r -= a.__weight
    if (r <= 0) return a
  }
  return pool[pool.length - 1] // safety
}

// ---- Main Component ----
export default function JamApp() {
  const [session, setSession] = useState<string>(() => new URLSearchParams(location.search).get("session") || "demo session")
  const [albums, setAlbums] = useState<Album[]>(() => loadSession(session))
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
  // computed ranks
  const ranked = useMemo(() => rankAlbumsByPreference(albums), [albums])

  // update suggestions as user types to add an album
  useEffect(() => {
    const { titles, artists } = buildCandidates(albums, JAM_SEEDS)
    setTitleSuggestions(suggestClose(newAlbumTitle, titles))
    setArtistSuggestions(suggestClose(newAlbumArtist, artists))
  }, [newAlbumTitle, newAlbumArtist, albums])

  // mark seeds loaded per session so we don't repeat
  function seedFlag(session: string) {
    return `the-jam-session/${session}/seeded`
  }

  useEffect(() => {
    const alreadySeeded = localStorage.getItem(seedFlag(session)) === "1"
    if (!alreadySeeded && albums.length === 0) {
      const seeded = seedsToAlbums(JAM_SEEDS)
      setAlbums(seeded)
      localStorage.setItem(seedFlag(session), "1")
    }
    // run only on first render for this session state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist on changes
  useEffect(() => {
    saveSession(session, albums)
  }, [session, albums])

  // switch session
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    params.set("session", session)
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`)
    setAlbums(loadSession(session))
  }, [session])

  function addAlbum() {
    const t = newAlbumTitle.trim()
    const a = newAlbumArtist.trim()
    if (!t || !a) return
  
    // normalised key (case-insensitive)
    const key = `${t.toLowerCase()}::${a.toLowerCase()}`
    const existsExact = albums.some(al => `${al.title.toLowerCase()}::${al.artist.toLowerCase()}` === key)
    if (existsExact) {
      alert("That album is already on the list!")
      return
    }

    // soft-block near duplicates
    const nearTitle = suggestClose(t, albums.map(x => x.title))[0]
    const nearArtist = suggestClose(a, albums.map(x => x.artist))[0]
    if (nearTitle && nearArtist) {
      const proceed = confirm(`Looks close to “${nearTitle} — ${nearArtist}”. Add anyway?`)
      if (!proceed) return
    }
  
    const newAlbum: Album = {
      id: uuidv4(),
      title: t,
      artist: a,
      cover: cover.trim() || undefined,
      votes: {},
      createdAt: Date.now(),
    }
    setAlbums(prev => [newAlbum, ...prev])
    setNewAlbumTitle("")
    setNewAlbumArtist("")
    setCover("")
  }

  function removeAlbum(id: string) {
    setAlbums((prev) => prev.filter((x) => x.id !== id))
  }

  function clearMyVotes() {
    setAlbums((prev) => prev.map((al) => {
      const { [userId]: _, ...rest } = al.votes
      return { ...al, votes: rest }
    }))
  }

function pickByRules() {
  // Build pool excluding any album with a rank-3 from anyone.
  const { eligible, totalTickets } = buildChoicePool(albums)

  if (eligible.length === 0) {
    // Fallback: every album has at least one 3 → pick any album purely at random
    if (albums.length === 0) return
    const choice = albums[Math.floor(Math.random() * albums.length)]
    setPicked(choice)
    return
  }

  const choice = weightedPick(eligible, totalTickets)
  setPicked(choice)
}

  function exportJson() {
    download(`${session}-albums.json`, JSON.stringify({ session, albums }, null, 2))
  }

  function importJson(text: string) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed.albums)) {
        setAlbums(parsed.albums as Album[])
      }
    } catch {
      // ignore parse errors in MVP
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
            <h1 className="text-3xl font-bold tracking-tight">The Jam Session</h1>
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
                  <DialogTitle>Import JSON</DialogTitle>
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
              </div>
              <datalist id={titleListId}>
                  {titleSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
                <datalist id={artistListId}>
                  {artistSuggestions.map(s => <option key={s} value={s} />)}
                </datalist>
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
                    <DropdownMenuItem
                      onClick={() => {
                        setAlbums(prev => {
                          const existing = new Set(
                            prev.map(a => `${a.title.toLowerCase()}::${a.artist.toLowerCase()}`)
                          )
                          const fresh = JAM_SEEDS.filter(
                            s => !existing.has(`${s.title.toLowerCase()}::${s.artist.toLowerCase()}`)
                          )
                          return [...seedsToAlbums(fresh), ...prev]
                        })
                      }}
                    >
                      Load starter list
                    </DropdownMenuItem>
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
              {/* Rank albums button */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setAlbums(prev => rankAlbumsByPreference(prev))}>
                    Sort into order
                  </Button>
                  <Button variant="secondary" onClick={pickByRules}>
                    <Dice1 className="mr-2 h-4 w-4" /> Spread the Pick
                  </Button>
                  <Button variant="ghost" onClick={() => setAlbums(prev => [...prev].sort((a,b) => a.createdAt - b.createdAt))}>
                    Reset order
                  </Button>
                </div>
              </div>

            <Separator className="mb-4"/>
            
            {/* Albums tab */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {albums.map((al) => {
                const my = al.votes[userId]
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

                          {/* Your vote label */}
                          <div className="mt-1 text-xs">
                            <span className="text-muted-foreground">Your vote: </span>
                            <span className={`font-medium ${colors.badge}`}>
                              {typeof my === "number" ? PREFERENCE.find(p => p.value === my)?.label : "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <CardContent>
                        {/* Preference buttons */}
                        <div className="flex flex-wrap gap-2">
                          {PREFERENCE.map(p => (
                            <Button
                              key={p.value}
                              type="button"
                              variant={my === p.value ? "default" : "outline"}
                              className={my === p.value ? "" : "bg-white"}
                              onClick={() =>
                                setAlbums(prev =>
                                  prev.map(x =>
                                    x.id === al.id ? { ...x, votes: { ...x.votes, [userId]: p.value } } : x
                                  )
                                )
                              }
                              title={p.label}
                            >
                              <span className="mr-1">{p.dot}</span> {p.value}
                            </Button>
                          ))}

                          {/* Clear my vote */}
                          {typeof my === "number" && (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setAlbums(prev =>
                                  prev.map(x => {
                                    if (x.id !== al.id) return x
                                    const { [userId]: _, ...rest } = x.votes
                                    return { ...x, votes: rest }
                                  })
                                )
                              }
                            >
                              Clear
                            </Button>
                          )}
                        </div>

                     {/*<div className="mt-3 text-xs text-muted-foreground">
                          {typeof my === "number"
                            ? `You voted: ${PREFERENCE.find(p => p.value === my)?.label}`
                            : "You haven’t voted yet"}
                        </div> */}

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
                      <div className="mt-2 text-sm">
                       {/* check this leaning / weighted ave data when two people vote */}
                        Leaning (avg): {preferenceAverage(picked.votes)?.toFixed(2) ?? "—"}
                      </div>
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
                  This is a client-only prototype. Create a <em>session</em> name, add albums, and share the link so your friend can use the same session name on their device. For true realtime sync you’ll want a small backend; see below.
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Data is stored in your browser’s LocalStorage per session name.</li>
                  <li>Import/Export lets you merge or share lists manually.</li>
                  <li>Random pick follows the club rules: “don’t fancy” albums are excluded, “dying to listen” votes count most, “could listen” votes count less, and unvoted albums still get a small chance.</li>
                </ul>
                <Separator />
                <div>
                  <h4 className="mb-1 font-medium">Next steps for realtime</h4>
                  <ol className="list-inside list-decimal space-y-1">
                    <li>Add Supabase (Postgres + Row Level Security). Tables: <code>sessions</code>, <code>albums</code>, <code>votes</code>.</li>
                    <li>Use Supabase Realtime on <code>albums</code>/<code>votes</code> to broadcast changes.</li>
                    <li>Auth: anonymous magic-link or per-session PIN; scope RLS by <code>session_id</code>.</li>
                    <li>Optional: Spotify search API to prefill album metadata & cover art.</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}