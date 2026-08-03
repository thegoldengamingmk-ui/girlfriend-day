import React, { useState } from "react"

export interface SongItem {
  id: string
  title: string
  artist: string
  thumbnail: string
}

// Popular Romantic Songs Presets with verified YouTube Video IDs
export const ROMANTIC_SONG_PRESETS: SongItem[] = [
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
]

export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId) return null
  const trimmed = urlOrId.trim().replace(/^search:/, "")
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
  if (!trackId) trackId = "BddP6PYo2gs"
  const trimmed = trackId.trim()

  const directId = extractYouTubeId(trimmed)
  if (directId) {
    return `https://www.youtube.com/embed/${directId}?autoplay=${
      autoPlay ? 1 : 0
    }&enablejsapi=1&playsinline=1&rel=0&loop=1&playlist=${directId}&controls=1`
  }

  // If search query format (e.g. "search:Dil Diyan Gallan Atif Aslam" or "Dil Diyan Gallan - Atif Aslam")
  const query = trimmed.startsWith("search:")
    ? trimmed.replace(/^search:/, "")
    : trimmed

  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
    query,
  )}&autoplay=${autoPlay ? 1 : 0}&enablejsapi=1&playsinline=1&rel=0&controls=1`
}

interface YouTubeSongSearchProps {
  selectedSongId: string
  selectedSongTitle: string
  onSelectSong: (videoIdOrSearch: string, songTitle: string) => void
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

  const embedSrc = getYouTubeEmbedSrc(selectedSongId)

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

    try {
      // 1. Search via iTunes API for song & artist details
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`,
      )
      const data = await response.json()

      if (data.results && data.results.length > 0) {
        const mappedResults: SongItem[] = data.results.map((track: any) => {
          const pMatch = ROMANTIC_SONG_PRESETS.find(
            (p) =>
              p.title.toLowerCase().includes(track.trackName.toLowerCase()) ||
              track.trackName.toLowerCase().includes(p.title.toLowerCase()),
          )
          const songId = pMatch
            ? pMatch.id
            : `search:${track.trackName} ${track.artistName}`

          return {
            id: songId,
            title: track.trackName,
            artist: track.artistName,
            thumbnail:
              track.artworkUrl100?.replace("100x100bb", "300x300bb") ||
              "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
          }
        })
        setSearchResults(mappedResults)
      } else {
        // Fallback: search within presets or custom search query
        const lowerQ = q.toLowerCase()
        const matchedPresets = ROMANTIC_SONG_PRESETS.filter(
          (p) =>
            p.title.toLowerCase().includes(lowerQ) ||
            p.artist.toLowerCase().includes(lowerQ) ||
            lowerQ.includes(p.title.toLowerCase()),
        )
        if (matchedPresets.length > 0) {
          setSearchResults(matchedPresets)
        } else {
          // Direct custom search query result
          setSearchResults([
            {
              id: `search:${q}`,
              title: q,
              artist: "YouTube Song Search",
              thumbnail:
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
            },
          ])
        }
      }
    } catch (err) {
      console.warn("YouTube song search error:", err)
      // Custom fallback search item
      setSearchResults([
        {
          id: `search:${q}`,
          title: q,
          artist: "YouTube Song Search",
          thumbnail:
            "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
        },
      ])
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
            placeholder="Search YouTube song name (e.g. Dil Diyan Gallan, Senorita, Kesariya)..."
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

      {/* Search Results Display */}
      {searchResults.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-pink-200 shadow-sm space-y-3 animate-fade-up">
          <p className="text-xs font-bold text-[#1a0035]">
            🔍 YouTube Search Results ({searchResults.length}):
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
          💖 Top Romantic Hit Songs (1-Tap Select):
        </p>
        <div className="flex flex-wrap gap-2">
          {ROMANTIC_SONG_PRESETS.map((song) => {
            const isSelected = selectedSongId === song.id
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
                {selectedSongTitle || selectedSongId || "Kesariya - Arijit Singh"}
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
            key={selectedSongId}
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
