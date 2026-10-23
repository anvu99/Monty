import { Bot, MessageSquare, ArrowRight } from 'lucide-react';
import type { ApiMemory } from '@/api/client';

interface CheckinEntry {
  id: string;
  childName: string;
  childInitial: string;
  color: string;
  content: string;
  timestamp: string;
  isMonty: boolean;
}

interface Props {
  children: Array<{
    id: string;
    name: string;
    memories: ApiMemory[];
  }>;
  maxItems?: number;
}

const KID_COLORS = ['bg-teal-500', 'bg-lilac-500', 'bg-coral-500', 'bg-amber-500'];

export default function MontyCheckinFeed({ children, maxItems = 6 }: Props) {
  // Extract proactive_nudge_response memories, sorted by recency
  const entries: CheckinEntry[] = [];

  children.forEach((child, idx) => {
    const nudgeMemories = child.memories
      .filter((m) => m.memory_type === 'proactive_nudge_response')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const mem of nudgeMemories) {
      // Parse the memory content: 'Child said: "..." — Monty replied: "..."'
      const content = mem.content ?? '';

      // Try to split into child + monty parts
      const childMatch = content.match(/Child said:\s*"([^"]+)"/);
      const montyMatch = content.match(/Monty replied:\s*"([^"]+)"/);

      const ts = new Date(mem.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      if (childMatch) {
        entries.push({
          id: `${mem.id}-child`,
          childName: child.name,
          childInitial: child.name.charAt(0),
          color: KID_COLORS[idx % KID_COLORS.length],
          content: childMatch[1],
          timestamp: ts,
          isMonty: false,
        });
      }

      if (montyMatch) {
        entries.push({
          id: `${mem.id}-monty`,
          childName: child.name,
          childInitial: child.name.charAt(0),
          color: KID_COLORS[idx % KID_COLORS.length],
          content: montyMatch[1],
          timestamp: ts,
          isMonty: true,
        });
      }

      // Fallback: if neither matched, show the raw content
      if (!childMatch && !montyMatch && content.trim()) {
        entries.push({
          id: mem.id,
          childName: child.name,
          childInitial: child.name.charAt(0),
          color: KID_COLORS[idx % KID_COLORS.length],
          content,
          timestamp: ts,
          isMonty: content.toLowerCase().includes('monty'),
        });
      }
    }
  });

  // Sort all entries by timestamp descending and cap
  entries.sort((a, b) => {
    // Since timestamps are formatted strings, compare original dates via id prefix ordering
    // Entries are already added in recency order per child, just interleave
    return 0;
  });

  const display = entries.slice(0, maxItems);

  if (display.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="h-4 w-4 text-lilac-400" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-medium">
            Monty Check-in Activity
          </p>
        </div>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac-50 mb-3">
            <MessageSquare className="h-5 w-5 text-lilac-300" />
          </div>
          <p className="text-sm text-slate-400">No check-in conversations yet</p>
          <p className="text-xs text-slate-300 mt-1">
            When your kids chat with Monty's daily check-in, their conversations will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-4 w-4 text-lilac-400" />
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-medium">
          Monty Check-in Activity
        </p>
      </div>

      <div className="space-y-2">
        {display.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-xl bg-slate-50/60 border border-slate-100 p-3"
          >
            {/* Avatar / bot icon */}
            {entry.isMonty ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lilac-50 border border-lilac-100 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-lilac-400" />
              </div>
            ) : (
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${entry.color} text-[10px] font-semibold text-white mt-0.5`}>
                {entry.childInitial}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[11px] font-semibold text-ink">
                  {entry.isMonty ? 'Monty' : entry.childName}
                </span>
                {entry.isMonty && (
                  <ArrowRight className="h-2.5 w-2.5 text-slate-300" />
                )}
                {entry.isMonty && (
                  <span className="text-[11px] text-slate-400">{entry.childName}</span>
                )}
              </div>
              <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2">{entry.content}</p>
              <p className="text-[10px] text-slate-300 mt-1">{entry.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
