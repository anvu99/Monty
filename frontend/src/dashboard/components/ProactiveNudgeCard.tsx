import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, PiggyBank, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import { fetchProactiveNudge, sendChatMessage } from '@/api/client';
import type { ApiProactiveNudge } from '@/api/client';

interface ChatMessage {
  id: string;
  role: 'monty' | 'child';
  text: string;
}

interface Props {
  childId: string;
  childName: string;
}

export default function ProactiveNudgeCard({ childId, childName }: Props) {
  const [nudge, setNudge] = useState<ApiProactiveNudge | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch proactive nudge on mount (guarded against StrictMode double-fire)
  useEffect(() => {
    if (!childId) { setLoading(false); return; }
    let cancelled = false;
    fetchProactiveNudge(childId)
      .then((data) => {
        if (cancelled) return;
        if (data.has_nudge && data.message) {
          setNudge(data);
          setMessages([{ id: 'nudge-0', role: 'monty', text: data.message }]);
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [childId]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus input when chat expanded
  useEffect(() => {
    if (chatExpanded) setTimeout(() => inputRef.current?.focus(), 250);
  }, [chatExpanded]);

  const doSend = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    const childMsg: ChatMessage = { id: `c-${Date.now()}`, role: 'child', text: text.trim() };
    setMessages((p) => [...p, childMsg]);
    setInput('');
    setSending(true);
    setChatExpanded(true);

    try {
      const res = await sendChatMessage(childId, text.trim(), 'proactive_nudge');
      setMessages((p) => [...p, { id: `m-${Date.now()}`, role: 'monty', text: res.message }]);
    } catch {
      setMessages((p) => [...p, { id: `e-${Date.now()}`, role: 'monty', text: `Oops, my brain glitched! Try again? 🐧` }]);
    } finally {
      setSending(false);
    }
  }, [sending, childId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(input); }
  };

  const quickReplies = [
    "Yeah, I might!",
    "Nope, I'll save today",
    "How much would I save?",
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-lilac-200/40 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-lilac-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-lilac-100" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!nudge || !nudge.has_nudge) return null;

  const hasReplied = messages.length > 1;
  const lastMontyMsg = messages.filter(m => m.role === 'monty').at(-1)?.text ?? '';

  /* ───────── Minimized state ───────── */
  if (minimized) {
    return (
      <motion.button
        layout
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setMinimized(false)}
        className="w-full flex items-center gap-3 rounded-2xl border border-lilac-200/50 bg-white px-4 py-3 shadow-card
          hover:border-lilac-300/60 hover:shadow-md transition-all group cursor-pointer text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lilac-500 to-lilac-400 shadow-sm">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-lilac-400">
            Monty's Daily Check-in
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {hasReplied ? lastMontyMsg : 'Tap to expand'}
          </p>
        </div>
        {nudge.prediction && (
          <div className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 shrink-0">
            <PiggyBank className="h-2.5 w-2.5 text-slate-400" />
            <span className="text-[9px] font-mono font-medium text-slate-500">
              ~${nudge.prediction.amount.toFixed(0)}
            </span>
          </div>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-lilac-400 transition-colors shrink-0" />
      </motion.button>
    );
  }

  /* ───────── Full card ───────── */
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="rounded-2xl border border-lilac-200/50 bg-white shadow-card overflow-hidden"
    >
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-1">
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lilac-500 to-lilac-400 shadow-sm"
        >
          <Bot className="h-[18px] w-[18px] text-white" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-lilac-400">
            Monty's Daily Check-in
          </p>
        </div>

        {/* Prediction pill */}
        {nudge.prediction && (
          <div className="flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1">
            <PiggyBank className="h-3 w-3 text-slate-400" />
            <span className="text-[10px] font-mono font-medium text-slate-500">
              ~${nudge.prediction.amount.toFixed(0)}
            </span>
          </div>
        )}

        {/* Minimize button */}
        <button
          onClick={() => setMinimized(true)}
          title="Minimize"
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-300 hover:text-lilac-500 hover:bg-lilac-50 transition-all"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Messages ────────────────────────────────── */}
      <div
        ref={scrollRef}
        className={`px-5 pt-2 pb-1 space-y-3 transition-all duration-300 ${
          chatExpanded ? 'max-h-72 overflow-y-auto' : 'max-h-40 overflow-hidden'
        }`}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i === 0 ? 0.15 : 0 }}
              className={`flex ${msg.role === 'child' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'monty' && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lilac-50 mr-2 mt-1">
                  <Bot className="h-3 w-3 text-lilac-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.55] ${
                  msg.role === 'monty'
                    ? 'bg-slate-50 text-slate-700 rounded-tl-md'
                    : 'bg-lilac-500 text-white rounded-tr-md shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing dots */}
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lilac-50">
              <Bot className="h-3 w-3 text-lilac-400" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-slate-50 px-4 py-2.5 inline-flex gap-[5px]">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-[5px] w-[5px] rounded-full bg-slate-300"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.55, repeat: Infinity, delay: d * 0.12, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Saving tip ──────────────────────────────── */}
      {nudge.saving_tip && !hasReplied && (
        <div className="mx-5 mb-2 mt-1">
          <div className="flex items-center gap-2 rounded-xl bg-teal-50/70 border border-teal-100/60 px-3 py-2">
            <PiggyBank className="h-3.5 w-3.5 text-teal-500 shrink-0" />
            <p className="text-[11px] text-teal-700 leading-snug">{nudge.saving_tip}</p>
          </div>
        </div>
      )}

      {/* ── Quick replies ───────────────────────────── */}
      {!hasReplied && !sending && (
        <div className="px-5 pb-3 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((text) => (
              <button
                key={text}
                onClick={() => doSend(text)}
                className="rounded-full border border-lilac-200/60 bg-white px-3 py-[6px] text-[11px] font-medium text-lilac-600
                  hover:bg-lilac-50 hover:border-lilac-300/60 active:scale-[0.97] transition-all"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Expand toggle when collapsed with many messages ── */}
      {!chatExpanded && messages.length > 2 && (
        <button
          onClick={() => setChatExpanded(true)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-lilac-400 hover:text-lilac-600 transition-colors"
        >
          <ChevronDown className="h-3 w-3" /> Show full conversation
        </button>
      )}

      {/* ── Collapse toggle when expanded ── */}
      {chatExpanded && messages.length > 3 && (
        <button
          onClick={() => setChatExpanded(false)}
          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-medium text-lilac-400 hover:text-lilac-600 transition-colors"
        >
          <ChevronUp className="h-3 w-3" /> Collapse
        </button>
      )}

      {/* ── Chat input ──────────────────────────────── */}
      {hasReplied && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="border-t border-slate-100"
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to Monty…"
              disabled={sending}
              className="flex-1 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-300 outline-none"
            />
            <button
              onClick={() => doSend(input)}
              disabled={!input.trim() || sending}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-lilac-500 text-white shadow-sm
                disabled:opacity-30 disabled:shadow-none hover:bg-lilac-600 active:scale-95 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
