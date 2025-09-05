import "@/app/globals.css"
import type { ReactNode } from "react"

export const metadata = {
  title: "The Jam Session",
  description: "Pick, vote, and spin a full-album choice together.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-gradient-to-b from-rose-50 to-amber-50">
        {children}
      </body>
    </html>
  )
}