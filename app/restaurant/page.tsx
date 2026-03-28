"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BottomNav from "../components/BottomNav";

export default function RestaurantPage() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const turn = Number(params.get("turn") ?? "1");

  const [displayText, setDisplayText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const bufferRef = useRef("");
  const ttsFiredRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!q) return;
    startStream();
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [q]);

  async function startStream() {
    setIsStreaming(true);
    setDisplayText("");
    setAudioUrl(null);
    bufferRef.current = "";
    ttsFiredRef.current = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, turnCount: turn }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = decoder.decode(value);
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const { delta } = JSON.parse(data);
            bufferRef.current += delta;

            // Display text: hide TTS_SUMMARY section
            const ttsIdx = bufferRef.current.indexOf("TTS_SUMMARY:");
            setDisplayText(
              ttsIdx === -1
                ? bufferRef.current
                : bufferRef.current.slice(0, ttsIdx).trimEnd()
            );

            // Parallel TTS trigger: fire as soon as 3 summary lines are ready
            if (!ttsFiredRef.current && ttsIdx !== -1) {
              const afterMarker = bufferRef.current.slice(ttsIdx + "TTS_SUMMARY:".length);
              const summaryLines = afterMarker
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              if (summaryLines.length >= 3) {
                ttsFiredRef.current = true;
                fetchTTS(summaryLines.slice(0, 3).join("\n"));
              }
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } finally {
      setIsStreaming(false);
    }
  }

  async function fetchTTS(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      // TTS 실패해도 텍스트는 그대로 표시
    }
  }

  function toggleAudio() {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  // Parse restaurant name from first non-empty line
  const firstLine = displayText.split("\n").find((l) => l.trim()) ?? "";
  const restaurantName = firstLine.replace(/^[\d.]+\s*/, "").trim() || (isStreaming ? "추천 중..." : "Liar Foodie Pick");

  return (
    <div className="bg-background text-on-surface">
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* TopAppBar */}
      <header className="fixed top-0 w-full flex justify-between items-center px-6 py-4 bg-[#f6f6f6]/80 backdrop-blur-xl z-50 shadow-[0_8px_24px_rgba(45,47,47,0.06)]">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined text-on-surface">arrow_back</span>
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-[#2d2f2f]">Liar Foodie</h1>
        </div>
        <button className="text-[#5a5c5c] hover:opacity-80 transition-opacity active:scale-95">
          <span className="material-symbols-outlined">search</span>
        </button>
      </header>

      <main className="pt-20 pb-28 min-h-screen">
        {/* Map Section */}
        <section className="relative h-[300px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-surface-container-high">
            <img
              className="w-full h-full object-cover grayscale-[0.2] contrast-[0.9]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDln6Lei2edz4szctlk-uvW8MJQhJCRzCfhuBzK-Qw9WcJY7nMzZ2VAZZnCh2MpTRlyjRy2_K2JHGaX-60f0le9DNmOb5QCR6GCtMng7Vej-KJHSyyRP1WP7b3sk1diFP44LGLSD8criPqrnAFHnsLATS6ya8VgPW_qQZR1rcolFaWK15JZuAVhe2yXtDcG5kHH8jstGWwbixs4yfGTLIeM6fFM7sE-OJElRF-gQEilBkU9pv6qULivY9ZfXfKQofHNSExVcBuCOy8"
              alt="Seoul map"
            />
          </div>
          {/* Map Pin */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="bg-primary p-3 rounded-full shadow-lg border-2 border-surface-container-lowest flex items-center justify-center animate-pulse">
                <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass-panel px-4 py-2 rounded-xl shadow-xl border border-outline-variant/15 whitespace-nowrap max-w-[200px] truncate">
                <span className="text-on-surface font-bold text-sm">{restaurantName}</span>
              </div>
            </div>
          </div>
          {/* Map Controls */}
          <div className="absolute right-4 bottom-4 flex flex-col gap-2">
            <button className="w-10 h-10 glass-panel rounded-full flex items-center justify-center shadow-md text-on-surface">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button className="w-10 h-10 glass-panel rounded-full flex items-center justify-center shadow-md text-on-surface">
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
        </section>

        {/* Content Card */}
        <article className="max-w-2xl mx-auto -mt-8 relative z-10 px-4">
          <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_8px_48px_rgba(45,47,47,0.08)] overflow-hidden">
            {/* Hero Image */}
            <div className="relative h-72 overflow-hidden bg-gradient-to-br from-primary-container/30 to-secondary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary/30 text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                restaurant
              </span>
              <div className="absolute top-4 right-4 bg-tertiary-container text-on-tertiary-container font-bold px-3 py-1 rounded-full text-xs uppercase tracking-widest shadow-sm">
                Liar&apos;s Special
              </div>
            </div>

            <div className="p-8">
              {/* Title */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1 pr-4">
                  <h2 className="text-2xl font-extrabold text-on-surface leading-tight mb-2">
                    {isStreaming && !displayText ? (
                      <span className="inline-block w-48 h-7 bg-surface-container-high rounded animate-pulse" />
                    ) : (
                      restaurantName
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="flex text-tertiary-container">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      ))}
                    </div>
                    <span className="text-on-surface-variant text-sm font-medium">5.0 (거짓말)</span>
                  </div>
                </div>
                {/* TTS Play Button */}
                {audioUrl && (
                  <button
                    onClick={toggleAudio}
                    className="w-12 h-12 rounded-full bg-primary-gradient flex items-center justify-center text-white shadow-lg flex-shrink-0 active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isPlaying ? "pause" : "play_arrow"}
                    </span>
                  </button>
                )}
                {isStreaming && !audioUrl && ttsFiredRef.current && (
                  <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-on-surface-variant text-xl animate-spin">progress_activity</span>
                  </div>
                )}
              </div>

              {/* Trust Meter */}
              <div className="bg-surface-container-low p-6 rounded-2xl mb-8 border border-outline-variant/10">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-on-surface font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    Liar Foodie Trust Level
                  </span>
                  <span className="text-secondary font-black">100% Verified</span>
                </div>
                <div className="w-full bg-surface-container-high h-3 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-secondary to-secondary-container w-full" />
                </div>
              </div>

              {/* Streamed Description */}
              <div className="mb-10 min-h-[120px]">
                {isStreaming && !displayText ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-4 bg-surface-container-high rounded animate-pulse ${i === 3 ? "w-2/3" : "w-full"}`} />
                    ))}
                  </div>
                ) : (
                  <div className="text-on-surface-variant leading-relaxed whitespace-pre-wrap text-sm">
                    {displayText}
                    {isStreaming && (
                      <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse rounded-sm" />
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold py-4 px-6 rounded-full shadow-lg hover:opacity-90 transition-all active:scale-95">
                  <span className="material-symbols-outlined">shopping_bag</span>
                  Order Now (Fake)
                </button>
                <Link
                  href="/share"
                  className="flex items-center justify-center gap-2 bg-secondary-container text-on-secondary-container font-bold py-4 px-6 rounded-full hover:bg-secondary-fixed-dim transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">share</span>
                  Share the Lie
                </Link>
              </div>
            </div>
          </div>

          {/* Bento Info Grid */}
          <div className="grid grid-cols-2 gap-4 mt-8 pb-12">
            <div className="bg-surface-container p-6 rounded-3xl flex flex-col gap-4">
              <span className="material-symbols-outlined text-primary scale-125">schedule</span>
              <div>
                <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest">Wait Time</p>
                <p className="text-on-surface font-bold text-lg">0.4 Seconds</p>
              </div>
            </div>
            <div className="bg-surface-container-high p-6 rounded-3xl flex flex-col gap-4">
              <span className="material-symbols-outlined text-secondary scale-125">eco</span>
              <div>
                <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest">Emissions</p>
                <p className="text-on-surface font-bold text-lg">-15% CO2</p>
              </div>
            </div>
          </div>
        </article>
      </main>

      <BottomNav active="picks" />
    </div>
  );
}
