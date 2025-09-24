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

// Mapeamento dos símbolos da Exness no TradingView
const EXNESS_SYMBOLS = {
  "exness-bitcoin": "EXNESS:BITCOIN",
  "exness-btcusd": "EXNESS:BTCUSD",
};

const timeFrameMap: Record<TimeFrame, string> = {
  "1m": "1",
  "5m": "5", 
  "30m": "30",
  "1h": "60",
};

export function useTradingViewData(symbol: string, initialTf: TimeFrame = "5m", limit = 500) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>(initialTf);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [ticker, setTicker] = useState<any>(null);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  // Função para buscar dados históricos do TradingView
  const fetchHistoricalData = async (tf: TimeFrame) => {
    setLoading(true);
    try {
      // Usar proxy do TradingView para dados históricos
      const response = await fetch(`https://scanner.tradingview.com/crypto/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: [{
            left: "name",
            operation: "match",
            right: symbol
          }],
          columns: ["name", "close", "change", "change_abs", "volume"],
          sort: { sortBy: "volume", sortOrder: "desc" },
          range: [0, 1]
        })
      });

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const marketData = data.data[0].d;
        const currentPrice = marketData[1]; // close
        const change = marketData[2]; // change
        const changeAbs = marketData[3]; // change_abs
        const volume = marketData[4]; // volume

        setTicker({
          lastPrice: currentPrice,
          priceChangePercent: change,
          priceChange: changeAbs,
          volume: volume
        });

        setPriceChangePercent(change);

        // Para dados históricos, vamos usar uma simulação baseada no preço atual
        // Em produção, você usaria a API completa do TradingView
        const now = Math.floor(Date.now() / 1000);
        const interval = parseInt(timeFrameMap[tf]) * 60; // converter para segundos
        
        const simulatedCandles: Candle[] = [];
        for (let i = limit - 1; i >= 0; i--) {
          const time = now - (i * interval);
          const basePrice = currentPrice;
          const variation = (Math.random() - 0.5) * basePrice * 0.02; // ±1% de variação
          const open = basePrice + variation;
          const close = basePrice + (Math.random() - 0.5) * basePrice * 0.02;
          const high = Math.max(open, close) + Math.random() * basePrice * 0.01;
          const low = Math.min(open, close) - Math.random() * basePrice * 0.01;
          
          simulatedCandles.push({
            time,
            open,
            high,
            low,
            close,
            volume: volume * (0.5 + Math.random() * 0.5) // variação de volume
          });
        }

        candlesRef.current = simulatedCandles;
        setCandles(simulatedCandles);
      }
    } catch (error) {
      console.error("Erro ao buscar dados do TradingView:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData(timeFrame);
  }, [timeFrame, symbol]);

  // WebSocket para dados em tempo real (simulado)
  useEffect(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
    }

    // Simular conexão WebSocket
    setLive(true);
    
    // Simular atualizações em tempo real
    const interval = setInterval(() => {
      if (candlesRef.current.length > 0) {
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = parseInt(timeFrameMap[timeFrame]) * 60;
        
        if (now - lastCandle.time >= intervalSeconds) {
          // Nova vela
          const newCandle: Candle = {
            time: now,
            open: lastCandle.close,
            close: lastCandle.close * (1 + (Math.random() - 0.5) * 0.01),
            high: lastCandle.close * (1 + Math.random() * 0.01),
            low: lastCandle.close * (1 - Math.random() * 0.01),
            volume: lastCandle.volume * (0.8 + Math.random() * 0.4)
          };
          
          const updated = [...candlesRef.current.slice(-limit + 1), newCandle];
          candlesRef.current = updated;
          setCandles(updated);
        } else {
          // Atualizar vela atual
          const updated = [...candlesRef.current];
          const last = updated[updated.length - 1];
          last.close = last.close * (1 + (Math.random() - 0.5) * 0.001);
          last.high = Math.max(last.high, last.close);
          last.low = Math.min(last.low, last.close);
          
          candlesRef.current = updated;
          setCandles(updated);
        }
      }
    }, 5000); // Atualizar a cada 5 segundos

    return () => {
      clearInterval(interval);
      setLive(false);
    };
  }, [symbol, timeFrame, limit]);

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
