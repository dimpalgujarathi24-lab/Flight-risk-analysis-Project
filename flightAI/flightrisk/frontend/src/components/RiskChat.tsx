import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Bot, User as UserIcon } from "lucide-react";
import { api } from "../lib/api";
import type { ChatMessage } from "../types";

const SUGGESTED = [
  "Why is this rated the way it is?",
  "What would reduce the risk most?",
  "How confident is the model?",
  "Should we dispatch?",
];

interface Props {
  analysisId: number;
}

export default function RiskChat({ analysisId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
  }, [analysisId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.askAboutAnalysis(analysisId, q);
      setMessages((m) => [...m, { role: "assistant", text: res.answer, source: res.source as any }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Couldn't reach the analysis engine — try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl overflow-hidden flex flex-col" style={{ height: 420 }}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)]">
        <Sparkles className="w-4 h-4 text-[var(--color-amber)]" />
        <p className="text-xs text-[var(--color-steel)] uppercase tracking-wide">Ask about this analysis</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Bot className="w-8 h-8 text-[var(--color-steel)]" strokeWidth={1.5} />
            <p className="text-xs text-[var(--color-steel)]">
              Answers are grounded in this flight's actual SHAP factor data — ask about a specific
              factor, the confidence level, or what would help most.
            </p>
            <div className="flex flex-col gap-1.5 w-full mt-1">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs text-left px-3 py-2 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-amber)] hover:text-[var(--color-amber)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  m.role === "user" ? "bg-[var(--color-amber)]/15" : "bg-[var(--color-border)]"
                }`}
              >
                {m.role === "user" ? (
                  <UserIcon className="w-3.5 h-3.5 text-[var(--color-amber)]" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-[var(--color-steel)]" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--color-amber)]/10 text-[var(--color-ink)]"
                    : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-ink)]"
                }`}
              >
                {m.text}
                {m.role === "assistant" && m.source && (
                  <p className="text-[10px] text-[var(--color-steel)] mt-1.5 font-mono">
                    {m.source === "claude" ? "answered by Claude" : "answered by rules engine"}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-steel)] pl-8">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> thinking...
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border)]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this flight's risk..."
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-amber)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 rounded-lg bg-[var(--color-amber)] text-[var(--color-bg)] disabled:opacity-40 hover:brightness-110 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
