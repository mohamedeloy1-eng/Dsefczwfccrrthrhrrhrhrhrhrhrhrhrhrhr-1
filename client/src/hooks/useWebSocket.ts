import { useEffect, useCallback, useState } from 'react';
import { wsClient } from '@/lib/websocket';

export function useWebSocket() {
  const [wsConnected, setWsConnected] = useState(wsClient.isConnected);

  useEffect(() => {
    wsClient.connect();
    
    const unsubConnection = wsClient.subscribeToConnection((connected) => {
      setWsConnected(connected);
    });

    return () => {
      unsubConnection();
    };
  }, []);

  const subscribe = useCallback((type: string, handler: (data: any) => void) => {
    return wsClient.subscribe(type, handler);
  }, []);

  return { subscribe, wsConnected };
}
