// Minimal shape for a seed (no ids/votes yet)
export type AlbumSeed = {
    title: string
    artist: string
    cover?: string
  }
  
  // (Covers are optional; can add URLs later or wire Spotify search.)
  export const JAM_SEEDS: AlbumSeed[] = [
    { title: "Blue", artist: "Joni Mitchell" },
    { title: "Rumours", artist: "Fleetwood Mac" },
    { title: "What’s Going On", artist: "Marvin Gaye" },
    { title: "OK Computer", artist: "Radiohead" },
    { title: "Pet Sounds", artist: "The Beach Boys" },
    { title: "To Pimp a Butterfly", artist: "Kendrick Lamar" },
    { title: "In Rainbows", artist: "Radiohead" },
    { title: "Back to Black", artist: "Amy Winehouse" },
    { title: "Hounds of Love", artist: "Kate Bush" },
    { title: "The Miseducation of Lauryn Hill", artist: "Lauryn Hill" },
    { title: "Abbey Road", artist: "The Beatles" },
    { title: "Nevermind", artist: "Nirvana" },
    { title: "A Love Supreme", artist: "John Coltrane" },
    { title: "Kind of Blue", artist: "Miles Davis" },
    { title: "Modern Vampires of the City", artist: "Vampire Weekend" },
  ]