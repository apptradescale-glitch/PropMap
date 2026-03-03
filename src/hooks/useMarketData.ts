import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type Quote = {
  contractId: string;
  symbolName: string;
  lastPrice: number;
  change: number;
  changePercent: number;
};

export function useMarketData() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: Socket = io('https://api.tradescale.app');

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('quote', ({ contractId, data }: any) => {
      setQuotes((prev) => ({ ...prev, [data.symbolName]: data }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getQuote = (symbol: string): Quote | undefined => {
    return quotes[symbol];
  };

  return { quotes, connected, getQuote };
}
