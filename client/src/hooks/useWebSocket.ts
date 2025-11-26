import { useEffect, useCallback } from 'react';
import { wsClient } from '@/lib/websocket';

export function useWebSocket() {
  useEffect(() => {
    wsClient.connect();
    return () => {
      // Don't disconnect on unmount since we want persistent connection
    };
  }, []);

  const subscribe = useCallback((type: string, handler: (data: any) => void) => {
    return wsClient.subscribe(type, handler);
  }, []);

  return { subscribe };
}
