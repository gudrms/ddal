"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "bot";
  text: string;
  audioUrl?: string;
};

const TONE_LABELS: Record<number, string> = {
  1: "친절",
  2: "퉁명",
  3: "싸가지",
  4: "단답",
};

const QUICK_INPUTS = ["🍣 일식", "🍜 중식", "🥩 한식", "🍕 양식"];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement>>({});
  const bufferRef = useRef("");
  const ttsFiredRef = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem("turnCount") ?? "0");
    setTurnCount(saved);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    const nextTurn = turnCount + 1;
    setInput("");
    setTurnCount(nextTurn);
    localStorage.setItem("turnCount", String(nextTurn));

    const userMsgIndex = messages.length;
    const botMsgIndex = messages.length + 1;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMessage },
      { role: "bot", text: "" },
    ]);

    setIsStreaming(true);
    bufferRef.current = "";
    ttsFiredRef.current = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, turnCount: nextTurn }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const { delta } = JSON.parse(data);
            bufferRef.current += delta;

            const TTS_START = "---TTS_START---";
            const TTS_END = "---TTS_END---";
            const startIdx = bufferRef.current.indexOf(TTS_START);
            const endIdx = bufferRef.current.indexOf(TTS_END);

            const displayText =
              startIdx === -1
                ? bufferRef.current
                : bufferRef.current.slice(0, startIdx).trimEnd();

            setMessages((prev) => {
              const updated = [...prev];
              if (updated[botMsgIndex]) {
                updated[botMsgIndex] = { ...updated[botMsgIndex], text: displayText };
              }
              return updated;
            });

            // TTS_END 감지 시에만 발동 → 3줄이 완전히 완성된 후
            if (!ttsFiredRef.current && endIdx !== -1) {
              const summaryBlock = bufferRef.current
                .slice(startIdx + TTS_START.length, endIdx)
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
              if (summaryBlock.length >= 3) {
                ttsFiredRef.current = true;
                fetchTTS(summaryBlock.slice(0, 3).join("\n"), botMsgIndex);
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

  async function fetchTTS(text: string, index: number) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setMessages((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], audioUrl: url };
        }
        return updated;
      });

      setTimeout(() => {
        const audio = audioRefs.current[index];
        if (audio) {
          audio.src = url;
          audio.play();
          setPlayingIndex(index);
        }
      }, 100);
    } catch {
      // TTS 실패해도 텍스트는 유지
    }
  }

  function toggleAudio(index: number) {
    const audio = audioRefs.current[index];
    if (!audio) return;
    if (playingIndex === index && !audio.paused) {
      audio.pause();
      setPlayingIndex(null);
    } else {
      Object.values(audioRefs.current).forEach((a) => a.pause());
      audio.play();
      setPlayingIndex(index);
    }
  }

  const nextToneLabel = TONE_LABELS[Math.min(turnCount + 1, 4)];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-4 bg-[#f6f6f6]/90 backdrop-blur-xl border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-gradient flex items-center justify-center shadow">
            <span
              className="material-symbols-outlined text-white text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              restaurant
            </span>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-[#2d2f2f] leading-none">
              거짓말쟁이 메뉴봇
            </h1>
            <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
              진실 속의 거짓말
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {turnCount > 0 && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
              {nextToneLabel} 모드
            </span>
          )}
          <button
            onClick={() => {
              setMessages([]);
              setTurnCount(0);
              localStorage.setItem("turnCount", "0");
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            title="대화 초기화"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-primary-gradient flex items-center justify-center shadow-lg">
              <span
                className="material-symbols-outlined text-white text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                restaurant
              </span>
            </div>
            <div>
              <p className="font-extrabold text-on-surface text-xl">뭐 먹고 싶어?</p>
              <p className="text-on-surface-variant text-sm mt-1 leading-relaxed">
                일식, 중식, 한식 또는 재료를 입력하면<br />거짓말 가득한 맛집을 추천해줄게
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {QUICK_INPUTS.map((label) => (
                <button
                  key={label}
                  onClick={() => setInput(label.split(" ")[1])}
                  className="px-4 py-2 rounded-full bg-surface-container text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors border border-outline-variant/20"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "bot" && (
              <div className="w-8 h-8 rounded-full bg-primary-gradient flex items-center justify-center shadow flex-shrink-0 mb-1">
                <span
                  className="material-symbols-outlined text-white text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  restaurant
                </span>
              </div>
            )}

            <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%]`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-on-primary rounded-br-sm"
                    : "bg-surface-container-lowest border border-outline-variant/20 text-on-surface rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.text || (
                  <span className="flex items-center gap-1 py-0.5">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
                {msg.role === "bot" && isStreaming && i === messages.length - 1 && msg.text && (
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </div>

              {/* TTS 버튼 */}
              {msg.role === "bot" && msg.audioUrl && (
                <>
                  <button
                    onClick={() => toggleAudio(i)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold hover:opacity-90 transition-all active:scale-95"
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {playingIndex === i && audioRefs.current[i] && !audioRefs.current[i].paused
                        ? "pause"
                        : "play_arrow"}
                    </span>
                    3줄 요약 듣기
                  </button>
                  <audio
                    ref={(el) => {
                      if (el) audioRefs.current[i] = el;
                    }}
                    src={msg.audioUrl}
                    onEnded={() => setPlayingIndex(null)}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="flex-shrink-0 px-4 py-4 bg-[#f6f6f6]/90 backdrop-blur-xl border-t border-outline-variant/20">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/60 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            placeholder="뭐 먹고 싶어? (일식, 삼겹살...)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="w-11 h-11 rounded-full bg-primary-gradient flex items-center justify-center text-white shadow-lg disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          </button>
        </form>
      </footer>
    </div>
  );
}
