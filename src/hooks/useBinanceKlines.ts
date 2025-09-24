import { useEffect, useRef, useState } from "react";

export type TimeFrame = "1m" | "5m" | "30m" | "1h";

export interface Candle {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const timeFrameMap: Record<TimeFrame, string> = {
  "1m": "1m",
  "5m": "5m",
  "30m": "30m",
  "1h": "1h",
};

export function useBinanceKlines(symbol: string = "BTCUSDT", initialTf: TimeFrame = "1h", limit = 500) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(initialTf);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [ticker, setTicker] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  const fetchInitial = async (tf: TimeFrame) => {
    setLoading(true);
    try {
      const klineRes = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeFrameMap[tf]}&limit=${limit}`
      );
      const klineData = await klineRes.json();
      const formatted: Candle[] = klineData.map((i: any) => ({
        time: Math.floor(i[0] / 1000),
        open: parseFloat(i[1]),
        high: parseFloat(i[2]),
        low: parseFloat(i[3]),
        close: parseFloat(i[4]),
        volume: parseFloat(i[5]),
      }));
      candlesRef.current = formatted;
      setCandles(formatted);

      // Ticker
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
        .then((r) => r.json())
        .then(setTicker)
        .catch(() => {});
    } catch (e) {
      console.error("Erro ao buscar klines:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitial(timeFrame);
  }, [timeFrame]);

  // WebSocket realtime
  useEffect(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }
    const stream = `${symbol.toLowerCase()}@kline_${timeFrameMap[timeFrame]}`;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    wsRef.current = ws;
    setLive(false);

    ws.onopen = () => setLive(true);

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      const k = data.k;
      if (!k) return;
      const c: Candle = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      const arr = candlesRef.current;
      const last = arr[arr.length - 1];
      if (last && last.time === c.time) {
        // update last bar
        const next = [...arr.slice(0, -1), c];
        candlesRef.current = next;
        setCandles(next);
      } else if (!last || c.time > last.time) {
        const next = [...arr, c];
        // keep max length
        const trimmed = next.slice(-limit);
        candlesRef.current = trimmed;
        setCandles(trimmed);
      }
    };

    ws.onerror = () => setLive(false);
    ws.onclose = () => setLive(false);

    return () => {
      try { ws.close(); } catch {}
    };
  }, [symbol, timeFrame, limit]);

  const priceChangePercent = ticker ? parseFloat(ticker.priceChangePercent) : 0;

  return {
    timeFrame,
    setTimeFrame,
    candles,
    loading,
    live,
    ticker,
    priceChangePercent,
  } as const;
}
