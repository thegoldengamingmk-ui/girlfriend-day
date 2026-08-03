import React, { useEffect, useState, useRef } from "react"
import { extractYouTubeId } from "./YouTubeSongSearch"

interface YouTubePlayerProps {
  trackId?: string
  autoPlay?: boolean
}

export default function YouTubePlayer({
  trackId = "2Vv-BfVoq4g",
  autoPlay = true,
}: YouTubePlayerProps) {
  const videoId = extractYouTubeId(trackId) || "2Vv-BfVoq4g"
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMuted, setIsMuted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    // Screen 7: Pause ambient background music so YouTube song takes over 100%
    window.dispatchEvent(new Event("pause-bgm"))
    window.dispatchEvent(new Event("pause-uploaded-song"))
    setIsPlaying(true)
  }, [trackId])

  const sendIframeCommand = (command: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: command,
          args: args,
        }),
        "*",
      )
    }
  }

  const togglePlay = () => {
    if (isPlaying) {
      sendIframeCommand("pauseVideo")
      setIsPlaying(false)
    } else {
      sendIframeCommand("playVideo")
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    if (isMuted) {
      sendIframeCommand("unMute")
      setIsMuted(false)
    } else {
      sendIframeCommand("mute")
      setIsMuted(true)
    }
  }

  // Generate YouTube Embed URL with Autoplay and JS API enabled
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${
    isPlaying ? 1 : 0
  }&enablejsapi=1&playsinline=1&rel=0&loop=1&playlist=${videoId}&controls=1`

  return (
    <div className="w-full my-6 animate-fade-up">
      {/* Player Card Container */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl backdrop-blur-md"
        style={{
          background:
            "linear-gradient(135deg, rgba(35, 10, 60, 0.95) 0%, rgba(65, 15, 80, 0.95) 100%)",
          border: "1.5px solid rgba(255, 192, 203, 0.4)",
          boxShadow:
            "0 12px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(232, 120, 154, 0.3)",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-xl shadow-lg animate-pulse-heart">
              🎶
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-pink-300">
                  Your Romantic Song
                </span>
                {isPlaying && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-3 bg-pink-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-4 bg-pink-300 rounded-full animate-bounce delay-100" />
                    <span className="w-1.5 h-2 bg-pink-400 rounded-full animate-bounce delay-200" />
                  </span>
                )}
              </div>
              <h3
                className="text-sm sm:text-base font-bold text-white font-serif line-clamp-1"
                style={{ textShadow: "0 0 10px rgba(255,255,255,0.3)" }}
              >
                Playing Selected Song ❤️
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-all cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇 Muted" : "🔊 Sound On"}
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold text-xs shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? "⏸️ Pause" : "▶️ Play"}
            </button>
          </div>
        </div>

        {/* Embedded YouTube Iframe (Audio/Video Player) */}
        <div className="relative rounded-2xl overflow-hidden aspect-video border border-pink-400/30 bg-black shadow-inner">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="YouTube Romantic Background Track"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  )
}
