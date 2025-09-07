# 🍯🍓🍇 The Jam Session

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can edit the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

### Tech stack
NextJS, TypeScript, CSS, HTML, Supabase (database), SQL, Vercel (deployment)

### Rules for album being picked
	•	Disqualify if any user voted 3 (“not this week”).
	•	Weight 1-votes double; 2-votes single. (Album “tickets” = 2 × #1s + 1 × #2s.)
	•	If every album has at least one 3, fall back to a pure random pick among all albums.
	Edge cases:
	•	Albums with no votes and no 3s: give them a tiny chance (e.g. weight 1) so brand-new items aren’t impossible to draw.
	•	If no albums at all, do nothing.
	•	If only one album is eligible, pick it outright.

### Future improvements
 
 - Add validation drop-down to 'Add Album' feature
    •	Add a debounced search to a server action that queries Spotify Search API (requires client id/secret; we’ll proxy server-side).
	•	Return a compact list: {title, artist, cover}; show as a dropdown under the inputs; selecting one fills the fields.
	•	Benefits: canonical names/artwork + avoids typos.
- Colour co-ordinate the albums for the number you've picked
- Email log in
- Submit your votes and then get emailed the pick when everyone's voted
- In Vercel → Project → Settings → Environment Variables
    Add the same two keys:
	•	NEXT_PUBLIC_SUPABASE_URL
	•	NEXT_PUBLIC_SUPABASE_ANON_KEY
	•	Redeploy. (Locally you’re already using .env.local.)
- Add aI emails with info about the album or band of the fortnight
