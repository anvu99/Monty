import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send } from 'lucide-react';
import { sendChatMessage, endConversation, fetchExtractionStatus, retryExtraction, type ExtractionStatus } from '@/api/client';
import type { ChatMessage } from '../mockData';
import PurchaseAssessmentForm from '../components/PurchaseAssessmentForm';
import type { ApiIntentionSuggestion } from '@/api/client';

interface Props {
  kidName?: string;
  kidId?: string;
}

const QUICK_QUESTIONS = [
  'Help me save',
  'What if I...',
  'Goal ideas',
  'Check my $',
];

export default function KidMonty({ kidName = 'Emma', kidId = '' }: Props) {
  const initialMessages: ChatMessage[] = [
    { id: 'c1', from: 'monty', text: `Hi ${kidName}! How can I help you today?`, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
  ];
  const storageKey = `monty_chat_${kidId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (Array.isArray(stored) && stored.length && stored.every((item) => item &&
        typeof item.id === 'string' && typeof item.text === 'string' && typeof item.timestamp === 'string' &&
        (item.from === 'kid' || item.from === 'monty'))) return stored as ChatMessage[];
    } catch { /* Browser storage may be unavailable. Keep the in-memory conversation. */ }
    return initialMessages;
  });
  const inFlight = useRef(false);
  const [conversationId, setConversationId] = useState(() => {
    try { return sessionStorage.getItem(`${storageKey}_id`) || crypto.randomUUID(); }
    catch { return crypto.randomUUID(); }
  });
  const [extraction, setExtraction] = useState<ExtractionStatus | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(`${storageKey}_ended`) || 'null'); }
    catch { return null; }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
      sessionStorage.setItem(`${storageKey}_id`, conversationId);
      sessionStorage.setItem(`${storageKey}_ended`, JSON.stringify(extraction));
    } catch { /* Keep full history in memory. */ }
  }, [messages, storageKey, conversationId, extraction]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'chat' | 'purchase'>('chat');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<ApiIntentionSuggestion | null>(null);
  useEffect(() => {
    if (!extraction || !['pending', 'processing'].includes(extraction.status)) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetchExtractionStatus(kidId, extraction.conversation_id)
        .then((result) => { if (!cancelled) { setExtraction(result); setError(''); } })
        .catch(() => { if (!cancelled) setError('Conversation is saved. Cannot check extraction status; it will resume checking while this page is open.'); });
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [kidId, extraction?.conversation_id, extraction?.status]);

  const handleEnd = async () => {
    if (inFlight.current || !kidId) return;
    inFlight.current = true; setSending(true); setError('');
    try {
      setExtraction(await endConversation(kidId, conversationId, messages.map((message) => ({
        id: message.id, role: message.from === 'kid' ? 'user' : 'assistant', content: message.text,
      }))));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save conversation. Retry End conversation.'); }
    finally { inFlight.current = false; setSending(false); }
  };

  const addMessage = (text: string, from: 'kid' | 'monty') => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      from,
      text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || inFlight.current || extraction) return;
    if (!kidId) { setError('Select a child before sending a message.'); return; }
    inFlight.current = true;
    setError(''); setSuggestion(null);
    const outgoing = addMessage(text, 'kid');
    setInput('');

    setSending(true);
    try {
      const response = await sendChatMessage(kidId, text, undefined, messages.map((message) => ({
        role: message.from === 'kid' ? 'user' : 'assistant', content: message.text,
      })));
      addMessage(response.message, 'monty');
      setSuggestion(response.suggested_intention ?? null);
    } catch (err) {
      setMessages((items) => items.filter((item) => item.id !== outgoing.id));
      setInput(text);
      setError(err instanceof Error ? err.message : 'AI unavailable. Please retry.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="mb-4 flex flex-wrap gap-2">
        <button disabled={sending || (!extraction && messages.some((m) => m.from === 'kid'))} onClick={() => {
          setMessages(initialMessages); setError(''); setSuggestion(null); setExtraction(null); setConversationId(crypto.randomUUID());
        }} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">New conversation</button>
        <button disabled={sending || !!extraction || !messages.some((m) => m.from === 'kid')} onClick={handleEnd} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">End conversation</button>
        <button onClick={() => setMode('chat')} aria-pressed={mode === 'chat'} className="rounded-full border px-4 py-2 text-sm">Chat</button>
        <button onClick={() => setMode('purchase')} aria-pressed={mode === 'purchase'} className="rounded-full border px-4 py-2 text-sm">Check a purchase</button>
      </div>
      {mode === 'purchase' ? <PurchaseAssessmentForm key={kidId} childId={kidId} /> : <>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lilac-500/10">
            <Bot className="h-4 w-4 text-lilac-500" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Chat with Monty</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
              Your money companion
            </p>
          </div>
        </div>
      </div>

      {/* Quick Questions */}
      <p className="mb-3 text-xs text-slate-500">Monty receives every message. End conversation to save this chat and extract any financial decisions for future coaching.</p>
      {extraction && <div role="status" className="mb-3 text-sm text-slate-600">
        Conversation saved. {extraction.status === 'completed' ? `${extraction.event_count} decision events recorded.` : extraction.status === 'failed' ? 'Decision extraction failed.' : 'Checking for financial decisions…'}
        {extraction.error && <p>{extraction.error}</p>}
        {extraction.status === 'failed' && <button disabled={sending} onClick={async () => {
          setSending(true);
          try { setExtraction(await retryExtraction(kidId, extraction.conversation_id)); setError(''); }
          catch (err) { setError(err instanceof Error ? err.message : 'Could not retry extraction.'); }
          finally { setSending(false); }
        }}>Retry extraction</button>}
      </div>}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={sending || !!extraction}
            className="shrink-0 rounded-full border border-lilac-300/40 bg-lilac-500/10 px-3.5 py-1.5 text-xs font-medium text-lilac-500 transition-colors hover:bg-lilac-500/20 whitespace-nowrap disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 min-h-0">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.from === 'kid' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.from === 'kid'
                    ? 'bg-lilac-500 text-white rounded-br-md'
                    : 'bg-ink text-mist rounded-bl-md'
                }`}
              >
                {msg.from === 'monty' && (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Bot className="h-3 w-3 text-lilac-300" />
                    <p className="text-[10px] uppercase tracking-[0.3em] text-lilac-300">Monty</p>
                  </div>
                )}
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.text}</p>
                <p
                  className={`text-[10px] mt-1.5 ${
                    msg.from === 'kid' ? 'text-white/60' : 'text-mist/50'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </motion.div>
          ))}
          {sending && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="rounded-2xl bg-ink px-4 py-3 rounded-bl-md">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Bot className="h-3 w-3 text-lilac-300" />
                  <p className="text-[10px] uppercase tracking-[0.3em] text-lilac-300">Monty</p>
                </div>
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-mist/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-mist/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-mist/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      {suggestion && <p className="mb-3 text-sm text-slate-600">Suggested plan (not saved): If {suggestion.trigger_situation}, then {suggestion.planned_action}.</p>}
      {error && <p role="alert" className="mb-3 text-sm text-coral-700">{error} Send again to retry.</p>}
      <div className="flex gap-2 pb-20">
        <input
          type="text"
          maxLength={2000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
          placeholder={`Ask me anything, ${kidName}...`}
          disabled={sending || !!extraction}
          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:border-lilac-300 focus:outline-none focus:ring-2 focus:ring-lilac-500/20 disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={sending || !!extraction}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lilac-500 text-white transition hover:-translate-y-0.5 hover:shadow-card disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      </>}
    </div>
  );
}
