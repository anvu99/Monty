import { useEffect, useState } from 'react';
import { fetchLiveFeed } from '@/api/client';
import type { ApiLiveFeed } from '@/api/client';

export function useRealtimeUpdates(childId: string, enabled: boolean = true) {
  const [liveFeed, setLiveFeed] = useState<ApiLiveFeed | null>(null);
  const [lastPollTime, setLastPollTime] = useState<string>(new Date().toISOString());

  useEffect(() => {
    if (!enabled || !childId) return;

    // Initial fetch
    fetchLiveFeed(childId, lastPollTime)
      .then((feed) => {
        setLiveFeed(feed);
        setLastPollTime(new Date().toISOString());
      })
      .catch(() => {});

    // Poll every 30 seconds
    const pollInterval = setInterval(() => {
      fetchLiveFeed(childId, lastPollTime)
        .then((feed) => {
          setLiveFeed(feed);
          setLastPollTime(new Date().toISOString());
        })
        .catch(() => {});
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [childId, enabled]);

  return liveFeed;
}
