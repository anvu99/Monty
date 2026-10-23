import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send } from 'lucide-react';
import { sendChatMessage } from '@/api/client';
import type { ChatMessage } from '../mockData';

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'c1', from: 'monty', text: `Hi ${kidName}! How can I help you today?`, timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

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
    if (!text.trim() || sending) return;
    addMessage(text, 'kid');
    setInput('');

    if (!kidId) {
      // Fallback if no kidId
      setTimeout(() => addMessage("I'm having trouble connecting. Try again later!", 'monty'), 500);
      return;
    }

    setSending(true);
    try {
      const response = await sendChatMessage(kidId, text);
      addMessage(response.message, 'monty');
    } catch {
      addMessage("Hmm, I'm having a moment. Can you try that again?", 'monty');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
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
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            disabled={sending}
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
      <div className="flex gap-2 pb-20">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
          placeholder={`Ask me anything, ${kidName}...`}
          disabled={sending}
          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-slate-400 focus:border-lilac-300 focus:outline-none focus:ring-2 focus:ring-lilac-500/20 disabled:opacity-50"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lilac-500 text-white transition hover:-translate-y-0.5 hover:shadow-card disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
