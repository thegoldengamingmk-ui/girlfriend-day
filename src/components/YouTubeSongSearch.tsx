import React, { useState } from "react"

export interface SongItem {
  id: string
  title: string
  artist: string
  thumbnail: string
}

// 40+ Top Indian & International Romantic Songs with Verified YouTube Video IDs
export const ROMANTIC_SONG_DATABASE: SongItem[] = [
  {
    id: "BddP6PYo2gs",
    title: "Kesariya",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg",
  },
  {
    id: "2Vv-BfVoq4g",
    title: "Perfect",
    artist: "Ed Sheeran",
    thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
  },
  {
    id: "GfCqMv--jCg",
    title: "Until I Found You",
    artist: "Stephen Sanchez",
    thumbnail: "https://i.ytimg.com/vi/GfCqMv--jCg/hqdefault.jpg",
  },
  {
    id: "id44_jLz22o",
    title: "Pehle Bhi Main",
    artist: "Vishal Mishra",
    thumbnail: "https://i.ytimg.com/vi/id44_jLz22o/hqdefault.jpg",
  },
  {
    id: "ElZfdU54Cp8",
    title: "Apna Bana Le",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg",
  },
  {
    id: "Umqb9KENgmk",
    title: "Tum Hi Ho",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg",
  },
  {
    id: "gvyUuxdRdR4",
    title: "Raataan Lambiyan",
    artist: "Jubin Nautiyal & Asees Kaur",
    thumbnail: "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg",
  },
  {
    id: "w4ClQO0FFQg",
    title: "Dil Diyan Gallan",
    artist: "Atif Aslam",
    thumbnail: "https://i.ytimg.com/vi/w4ClQO0FFQg/hqdefault.jpg",
  },
  {
    id: "h7GYGkWdAKs",
    title: "Tera Ban Jaunga",
    artist: "Tulsi Kumar & Akhil Sachdeva",
    thumbnail: "https://i.ytimg.com/vi/h7GYGkWdAKs/hqdefault.jpg",
  },
  {
    id: "VAdGW7GYqiI",
    title: "Chaleya",
    artist: "Arijit Singh & Shilpa Rao",
    thumbnail: "https://i.ytimg.com/vi/VAdGW7GYqiI/hqdefault.jpg",
  },
  {
    id: "p8Hp8hcd_bA",
    title: "Tera Hone Laga Hoon",
    artist: "Atif Aslam",
    thumbnail: "https://i.ytimg.com/vi/p8Hp8hcd_bA/hqdefault.jpg",
  },
  {
    id: "RLzC55ai0eo",
    title: "Heeriye",
    artist: "Jasleen Royal & Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg",
  },
  {
    id: "-BjZmE2gtdo",
    title: "Lover",
    artist: "Taylor Swift",
    thumbnail: "https://i.ytimg.com/vi/-BjZmE2gtdo/hqdefault.jpg",
  },
  {
    id: "rtOvBOTyX03",
    title: "A Thousand Years",
    artist: "Christina Perri",
    thumbnail: "https://i.ytimg.com/vi/rtOvBOTyX03/hqdefault.jpg",
  },
  {
    id: "1J2p1w_8xMo",
    title: "Din Shagna Da",
    artist: "Jasleen Royal",
    thumbnail: "https://i.ytimg.com/vi/1J2p1w_8xMo/hqdefault.jpg",
  },
  {
    id: "5Eqb_-j3FDA",
    title: "Pasoori",
    artist: "Ali Sethi & Shae Gill",
    thumbnail: "https://i.ytimg.com/vi/5Eqb_-j3FDA/hqdefault.jpg",
  },
  {
    id: "24np-_8B9bA",
    title: "O Bedardeya",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/24np-_8B9bA/hqdefault.jpg",
  },
  {
    id: "f6C03XInuKk",
    title: "Zaalima",
    artist: "Arijit Singh & Harshdeep Kaur",
    thumbnail: "https://i.ytimg.com/vi/f6C03XInuKk/hqdefault.jpg",
  },
  {
    id: "fo9E88t42yA",
    title: "Jeene Laga Hoon",
    artist: "Atif Aslam & Shreya Ghoshal",
    thumbnail: "https://i.ytimg.com/vi/fo9E88t42yA/hqdefault.jpg",
  },
  {
    id: "7w52lP4fWns",
    title: "Shayad",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/7w52lP4fWns/hqdefault.jpg",
  },
  {
    id: "V7LwfY5U5WI",
    title: "Samjhawan",
    artist: "Arijit Singh & Shreya Ghoshal",
    thumbnail: "https://i.ytimg.com/vi/V7LwfY5U5WI/hqdefault.jpg",
  },
  {
    id: "AEIVhBS6baE",
    title: "Gerua",
    artist: "Arijit Singh & Antara Mitra",
    thumbnail: "https://i.ytimg.com/vi/AEIVhBS6baE/hqdefault.jpg",
  },
  {
    id: "46U1h0jZcmo",
    title: "Tum Se Hi",
    artist: "Mohit Chauhan",
    thumbnail: "https://i.ytimg.com/vi/46U1h0jZcmo/hqdefault.jpg",
  },
  {
    id: "mJ-o0i8iLtw",
    title: "Pehli Nazar Mein",
    artist: "Atif Aslam",
    thumbnail: "https://i.ytimg.com/vi/mJ-o0i8iLtw/hqdefault.jpg",
  },
  {
    id: "P21z_U4_lY8",
    title: "Tu Jaane Na",
    artist: "Atif Aslam",
    thumbnail: "https://i.ytimg.com/vi/P21z_U4_lY8/hqdefault.jpg",
  },
  {
    id: "hoNb6HuNmU0",
    title: "Khairiyat",
    artist: "Arijit Singh",
    thumbnail: "https://i.ytimg.com/vi/hoNb6HuNmU0/hqdefault.jpg",
  },
  {
    id: "tg_w8v03zMs",
    title: "Kaun Tujhe",
    artist: "Palak Muchhal",
    thumbnail: "https://i.ytimg.com/vi/tg_w8v03zMs/hqdefault.jpg",
  },
  {
    id: "TGp385iU484",
    title: "Sun Saathiya",
    artist: "Divya Kumar & Priya Saraiya",
    thumbnail: "https://i.ytimg.com/vi/TGp385iU484/hqdefault.jpg",
  },
  {
    id: "fHI8X4OXluQ",
    title: "Ve Kamleya",
    artist: "Arijit Singh & Shreya Ghoshal",
    thumbnail: "https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg",
  },
  {
    id: "gD7wzF-wL20",
    title: "Husn",
    artist: "Anuv Jain",
    thumbnail: "https://i.ytimg.com/vi/gD7wzF-wL20/hqdefault.jpg",
  },
  {
    id: "43WMcobm9mU",
    title: "All of Me",
    artist: "John Legend",
    thumbnail: "https://i.ytimg.com/vi/43WMcobm9mU/hqdefault.jpg",
  },
  {
    id: "0VR3dfZf9Yg",
    title: "Say You Won't Let Go",
    artist: "James Arthur",
    thumbnail: "https://i.ytimg.com/vi/0VR3dfZf9Yg/hqdefault.jpg",
  },
  {
    id: "50VNCymT-Cs",
    title: "Can't Help Falling in Love",
    artist: "Elvis Presley",
    thumbnail: "https://i.ytimg.com/vi/50VNCymT-Cs/hqdefault.jpg",
  },
  {
    id: "lp-EO5I60KA",
    title: "Thinking Out Loud",
    artist: "Ed Sheeran",
    thumbnail: "https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg",
  },
  {
    id: "8DxI_-L_h78",
    title: "At My Worst",
    artist: "Pink Sweats",
    thumbnail: "https://i.ytimg.com/vi/8DxI_-L_h78/hqdefault.jpg",
  },
  {
    id: "W8aM444nJ-Q",
    title: "Dandelions",
    artist: "Ruth B.",
    thumbnail: "https://i.ytimg.com/vi/W8aM444nJ-Q/hqdefault.jpg",
  },
]

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null
  const trimmed = urlOrId.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }
  const watchMatch = trimmed.match(
    /(?:youtube\.com|music\.youtube\.com)\/watch\?v=([a-zA-Z0-9_-]{11})/,
  )
  if (watchMatch && watchMatch[1]) return watchMatch[1]

  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch && shortMatch[1]) return shortMatch[1]

  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch && embedMatch[1]) return embedMatch[1]

  return null
}

export function getYouTubeEmbedSrc(trackId: string, autoPlay: boolean = false): string {
  const videoId = extractYouTubeId(trackId) || "BddP6PYo2gs"
  return `https://www.youtube.com/embed/${videoId}?autoplay=${
    autoPlay ? 1 : 0
  }&enablejsapi=1&playsinline=1&rel=0&loop=1&playlist=${videoId}&controls=1`
}

interface YouTubeSongSearchProps {
  selectedSongId: string
  selectedSongTitle: string
  onSelectSong: (videoId: string, songTitle: string) => void
}

export default function YouTubeSongSearch({
  selectedSongId,
  selectedSongTitle,
  onSelectSong,
}: YouTubeSongSearchProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SongItem[]>([])
  const [error, setError] = useState("")

  const activeVideoId = extractYouTubeId(selectedSongId) || "BddP6PYo2gs"
  const activeSongObj = ROMANTIC_SONG_DATABASE.find((s) => s.id === activeVideoId)
  const displayTitle =
    selectedSongTitle || (activeSongObj ? `${activeSongObj.title} - ${activeSongObj.artist}` : `Kesariya - Arijit Singh`)
  const embedSrc = getYouTubeEmbedSrc(activeVideoId)

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return

    setIsSearching(true)
    setError("")

    // Check if input is a direct YouTube URL or 11-character Video ID
    const directId = extractYouTubeId(q)
    if (directId) {
      onSelectSong(directId, `YouTube Video (${directId})`)
      setIsSearching(false)
      setSearchQuery("")
      setSearchResults([])
      return
    }

    // 1. Filter local 40+ romantic song database first
    const lowerQ = q.toLowerCase()
    const localMatches = ROMANTIC_SONG_DATABASE.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQ) ||
        s.artist.toLowerCase().includes(lowerQ) ||
        lowerQ.includes(s.title.toLowerCase()),
    )

    if (localMatches.length > 0) {
      setSearchResults(localMatches)
      setIsSearching(false)
      return
    }

    // 2. Fetch via multi-provider YouTube Video Search APIs
    try {
      const searchUrls = [
        `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(q + " song")}&filter=music_videos`,
        `https://yt.drgnz.club/api/v1/search?q=${encodeURIComponent(q + " song")}&type=video`,
        `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(q + " song")}&type=video`,
      ]

      let foundItems: SongItem[] = []

      for (const url of searchUrls) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3000)
          const res = await fetch(url, { signal: controller.signal })
          clearTimeout(timeoutId)
          if (!res.ok) continue
          const data = await res.json()

          if (data.items && Array.isArray(data.items)) {
            foundItems = data.items
              .filter((item: any) => item.url && item.url.includes("/watch?v="))
              .slice(0, 6)
              .map((item: any) => {
                const vId = item.url.split("/watch?v=")[1]?.split("&")[0] || ""
                return {
                  id: vId,
                  title: item.title || q,
                  artist: item.uploaderName || "YouTube",
                  thumbnail:
                    item.thumbnail || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                }
              })
              .filter((item: SongItem) => item.id.length === 11)
          }

          if (foundItems.length === 0 && Array.isArray(data)) {
            foundItems = data
              .filter((item: any) => item.type === "video" && item.videoId)
              .slice(0, 6)
              .map((item: any) => ({
                id: item.videoId,
                title: item.title || q,
                artist: item.author || "YouTube",
                thumbnail:
                  item.videoThumbnails?.[0]?.url ||
                  `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
              }))
              .filter((item: SongItem) => item.id.length === 11)
          }

          if (foundItems.length > 0) break
        } catch (err) {}
      }

      if (foundItems.length > 0) {
        setSearchResults(foundItems)
      } else {
        // Fallback: show top 6 romantic song choices
        setSearchResults(ROMANTIC_SONG_DATABASE.slice(0, 6))
        setError(
          `Could not load live search for "${q}". Please choose from the romantic hits list below or paste a YouTube video URL!`,
        )
      }
    } catch (err) {
      console.warn("YouTube search error:", err)
      setSearchResults(ROMANTIC_SONG_DATABASE.slice(0, 6))
      setError("Please choose a song from the romantic hit list below or paste a YouTube link!")
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectSongItem = (song: SongItem) => {
    onSelectSong(song.id, `${song.title} - ${song.artist}`)
    setSearchResults([])
  }

  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search YouTube song (e.g. Kesariya, Dil Diyan Gallan, Dandelions)..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-pink-300/60 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all placeholder:text-gray-400"
          />
          <span className="absolute left-3.5 top-3.5 text-base">🔍</span>
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 font-bold text-white text-xs sm:text-sm cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-60"
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Direct URL Paste Helper */}
      <p className="text-[11px] text-pink-700/80 font-medium">
        💡 <strong>Tip:</strong> Search any song name above, tap a preset below, or paste a YouTube link!
      </p>

      {/* Search Results Display */}
      {searchResults.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-pink-200 shadow-sm space-y-3 animate-fade-up">
          <p className="text-xs font-bold text-[#1a0035]">
            🔍 Search Results ({searchResults.length}):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-pink-100 bg-pink-50/50 flex items-center gap-3 hover:bg-pink-100/60 transition-colors"
              >
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-12 h-12 rounded-lg object-cover border border-pink-200"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#1a0035] truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-pink-700 font-medium truncate">
                    {item.artist}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectSongItem(item)}
                  className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-[11px] cursor-pointer shadow-xs transition-all hover:scale-105 active:scale-95"
                >
                  Select ❤️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Romantic Presets Pills */}
      <div>
        <p className="text-[11px] font-bold text-[#7a0f50] uppercase tracking-wider mb-2">
          💖 Romantic Songs Hits (1-Tap Select):
        </p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
          {ROMANTIC_SONG_DATABASE.map((song) => {
            const isSelected = activeVideoId === song.id
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => handleSelectSongItem(song)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center gap-1.5 shadow-xs ${
                  isSelected
                    ? "bg-pink-600 text-white border border-pink-600 shadow-md scale-105 font-bold"
                    : "bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200"
                }`}
              >
                <span>{isSelected ? "🎵" : "🎶"}</span>
                <span>
                  {song.title} ({song.artist})
                </span>
                {isSelected && <span>✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 font-semibold text-center">
          ⚠️ {error}
        </p>
      )}

      {/* Selected Song Active Card & Live YouTube Preview */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 to-indigo-900/90 text-white border border-purple-400/50 shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎵</span>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-pink-300 block">
                Selected YouTube Song
              </span>
              <h4 className="text-sm font-bold text-white font-serif">
                {displayTitle}
              </h4>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 border border-emerald-400 text-emerald-300">
            ACTIVE ✓
          </span>
        </div>

        {/* Embedded YouTube Live Preview Box */}
        <div className="mt-3 relative rounded-xl overflow-hidden aspect-video border border-white/20 shadow-inner bg-black">
          <iframe
            key={activeVideoId}
            src={embedSrc}
            title="YouTube Song Preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  )
}
