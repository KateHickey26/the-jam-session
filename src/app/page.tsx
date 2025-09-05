import Link from "next/link"

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8 text-center">
      <h1 className="text-4xl font-bold">The Jam Session</h1>
      <p className="mt-2 text-sm text-neutral-600">
        A cosy place to rate albums with friends, then let chance pick from your shortlist.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/vote" className="rounded-xl border px-4 py-2 hover:bg-white">
          Long Play, Shortlist
        </Link>
        <Link href="/pantry" className="rounded-xl border px-4 py-2 hover:bg-white">
          The Pantry (all albums)
        </Link>
      </div>
    </main>
  )
}