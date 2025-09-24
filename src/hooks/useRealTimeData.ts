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

// Mapeamento de símbolos para diferentes APIs
const SYMBOL_MAP = {
  "binance-btcusdt": {
    yahoo: "BTC-USD",
    alpha: "BTCUSD",
    display: "BTC/USDT",
    provider: "Binance"
  },
  "exness-bitcoin": {
    yahoo: "BTC-USD", // Usar BTC-USD como proxy
    alpha: "BTCUSD",
    display: "BITCOIN",
    provider: "Exness"
  },
  "exness-btcusd": {
    yahoo: "BTC-USD",
    alpha: "BTCUSD", 
    display: "BTC/USD",
    provider: "Exness"
  }
};

const timeFrameMap: Record<TimeFrame, string> = {
  "1m": "1m",
  "5m": "5m",
  "30m": "30m",
  "1h": "1h",
};

export function useRealTimeData(symbol: string, initialTf: TimeFrame = "5m", limit = 500) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(initialTf);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [ticker, setTicker] = useState<any>(null);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  // Função para buscar dados do Yahoo Finance (gratuito)
  const fetchYahooData = async (tf: TimeFrame) => {
    try {
      const symbolConfig = SYMBOL_MAP[symbol as keyof typeof SYMBOL_MAP];
      if (!symbolConfig) return;

      // Usar proxy para evitar CORS
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbolConfig.yahoo}?interval=${timeFrameMap[tf]}&range=1d`
      )}`;

      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (data.chart?.result?.[0]) {
        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];
        
        const formattedCandles: Candle[] = timestamps.map((timestamp: number, index: number) => ({
          time: timestamp,
          open: quotes.open[index] || 0,
          high: quotes.high[index] || 0,
          low: quotes.low[index] || 0,
          close: quotes.close[index] || 0,
          volume: quotes.volume[index] || 0
        }));

        // Pegar os últimos candles
        const recentCandles = formattedCandles.slice(-limit);
        candlesRef.current = recentCandles;
        setCandles(recentCandles);

        // Atualizar ticker
        const lastCandle = recentCandles[recentCandles.length - 1];
        if (lastCandle) {
          const firstCandle = recentCandles[0];
          const change = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
          
          setTicker({
            lastPrice: lastCandle.close,
            priceChangePercent: change,
            volume: recentCandles.reduce((sum, c) => sum + c.volume, 0)
          });
          setPriceChangePercent(change);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dados do Yahoo:", error);
    }
  };

  // Função para buscar dados da Binance (fallback)
  const fetchBinanceData = async (tf: TimeFrame) => {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeFrameMap[tf]}&limit=${limit}`
      );
      const data = await response.json();
      
      const formattedCandles: Candle[] = data.map((kline: any) => ({
        time: Math.floor(kline[0] / 1000),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));

      candlesRef.current = formattedCandles;
      setCandles(formattedCandles);

      // Ticker
      const lastCandle = formattedCandles[formattedCandles.length - 1];
      const firstCandle = formattedCandles[0];
      const change = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
      
      setTicker({
        lastPrice: lastCandle.close,
        priceChangePercent: change,
        volume: formattedCandles.reduce((sum, c) => sum + c.volume, 0)
      });
      setPriceChangePercent(change);
    } catch (error) {
      console.error("Erro ao buscar dados da Binance:", error);
    }
  };

  // Buscar dados iniciais
  useEffect(() => {
    setLoading(true);
    
    // Tentar Yahoo primeiro, Binance como fallback
    fetchYahooData(timeFrame)
      .then(() => {
        if (candlesRef.current.length === 0) {
          return fetchBinanceData(timeFrame);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [timeFrame, symbol]);

  // WebSocket para dados em tempo real (Binance)
  useEffect(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${timeFrameMap[timeFrame]}`);
    wsRef.current = ws;
    setLive(false);

    ws.onopen = () => setLive(true);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const kline = data.k;
      
      if (kline) {
        const newCandle: Candle = {
          time: Math.floor(kline.t / 1000),
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v)
        };

        const currentCandles = candlesRef.current;
        const lastCandle = currentCandles[currentCandles.length - 1];

        if (lastCandle && lastCandle.time === newCandle.time) {
          // Atualizar última vela
          const updated = [...currentCandles.slice(0, -1), newCandle];
          candlesRef.current = updated;
          setCandles(updated);
        } else if (!lastCandle || newCandle.time > lastCandle.time) {
          // Nova vela
          const updated = [...currentCandles, newCandle].slice(-limit);
          candlesRef.current = updated;
          setCandles(updated);
        }
      }
    };

    ws.onerror = () => setLive(false);
    ws.onclose = () => setLive(false);

    return () => {
      try { ws.close(); } catch {}
    };
  }, [timeFrame, limit]);

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
