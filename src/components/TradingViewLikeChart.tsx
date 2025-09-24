import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBinanceKlines, TimeFrame } from "@/hooks/useBinanceKlines";
import { useRealTimeData } from "@/hooks/useRealTimeData";
import { createChart, Time, CandlestickSeries, LineSeries, HistogramSeries } from "lightweight-charts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function hslVar(name: string, alpha = 1) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${name}`)
    .trim();
  if (!v) return `hsla(0,0%,100%,${alpha})`;
  return `hsl(${v} / ${alpha})`;
}

// Simple RSI
function calcRSI(closes: number[], period = 14) {
  if (closes.length < period + 1) return [] as { time: Time; value: number }[];
  const out: { time: Time; value: number }[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch; else loss += -ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(ch, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-ch, 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / (avgLoss || 1e-10);
    const rsi = 100 - 100 / (1 + rs);
    out.push({ time: (i as unknown as Time), value: rsi });
  }
  return out;
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function calcMACD(closes: number[], times: number[]) {
  if (closes.length < 35) return { macd: [], signal: [], hist: [] } as any;
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const offset = e12.length - e26.length;
  const macdArr = e26.map((v, i) => e12[i + offset] - v);
  const signalArr = ema(macdArr, 9);
  const histArr = macdArr.slice(-signalArr.length).map((v, i) => v - signalArr[i]);
  const startIndex = closes.length - macdArr.length;
  const t = times.slice(startIndex);
  const macd = macdArr.map((v, i) => ({ time: (t[i] as unknown as Time), value: v }));
  const sigStart = macdArr.length - signalArr.length;
  const signal = signalArr.map((v, i) => ({ time: (t[i + sigStart] as unknown as Time), value: v }));
  const histTimes = t.slice(-histArr.length);
  const hist = histTimes.map((tt, i) => ({ time: (tt as unknown as Time), value: histArr[i] }));
  return { macd, signal, hist };
}

function calcStochRSI(closes: number[], times: number[], rsiPeriod = 14, stochPeriod = 14, smoothK = 3, smoothD = 3) {
  const rsi = calcRSI(closes, rsiPeriod);
  if (rsi.length < stochPeriod) return { k: [], d: [] } as any;
  const rsiVals = rsi.map(d => d.value);
  const rsiTimes = rsi.map((_, idx) => times[idx + rsiPeriod + 1]);
  const stoch: number[] = [];
  for (let i = stochPeriod - 1; i < rsiVals.length; i++) {
    const win = rsiVals.slice(i - stochPeriod + 1, i + 1);
    const min = Math.min(...win);
    const max = Math.max(...win);
    stoch.push(max - min === 0 ? 0 : ((rsiVals[i] - min) / (max - min)) * 100);
  }
  const sma = (arr: number[], p: number) => arr.map((_, i) => {
    const s = Math.max(0, i - p + 1);
    const slice = arr.slice(s, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  const k = sma(stoch, smoothK);
  const d = sma(k, smoothD);
  const t = rsiTimes.slice(-(stoch.length));
  const toLine = (arr: number[]) => arr.map((v, i) => ({ time: (t[i] as unknown as Time), value: v }));
  return { k: toLine(k), d: toLine(d) };
}

type MarketId = "binance-btcusdt" | "exness-bitcoin" | "exness-btcusd";

const MARKET_OPTIONS: Record<MarketId, { 
  binanceSymbol: string; 
  tradingViewSymbol: string;
  displaySymbol: string; 
  providerLabel: string;
  useTradingView: boolean;
}> = {
  "binance-btcusdt": { 
    binanceSymbol: "BTCUSDT", 
    tradingViewSymbol: "BINANCE:BTCUSDT",
    displaySymbol: "BTC/USDT", 
    providerLabel: "Binance",
    useTradingView: false
  },
  "exness-bitcoin": { 
    binanceSymbol: "BTCUSDT", 
    tradingViewSymbol: "EXNESS:BITCOIN",
    displaySymbol: "BITCOIN", 
    providerLabel: "Exness",
    useTradingView: true
  },
  "exness-btcusd": { 
    binanceSymbol: "BTCUSDT", 
    tradingViewSymbol: "EXNESS:BTCUSD",
    displaySymbol: "BTC/USD", 
    providerLabel: "Exness",
    useTradingView: true
  },
};

export function TradingViewLikeChart() {
  const [market, setMarket] = useState<MarketId>("binance-btcusdt");
  const [key, setKey] = useState(0); // Key para forçar recriação dos hooks
  const marketCfg = MARKET_OPTIONS[market];

  // Forçar recriação dos hooks quando o mercado muda
  useEffect(() => {
    setKey(prev => prev + 1);
  }, [market]);

  // Usar dados reais de múltiplas fontes
  const realTimeData = useRealTimeData(
    market,
    "5m",
    500
  );

  // Fallback para Binance se necessário
  const binanceData = useBinanceKlines(
    marketCfg.binanceSymbol,
    "5m",
    500
  );

  // Usar dados reais se disponíveis, senão Binance
  const source = realTimeData.candles.length > 0 ? realTimeData : binanceData;
  
  // Garantir que sempre temos dados válidos
  const candles = source.candles || [];
  const timeFrame = source.timeFrame || "5m";
  const setTimeFrame = source.setTimeFrame || (() => {});
  const loading = source.loading || false;
  const live = source.live || false;
  const priceChangePercent = source.priceChangePercent || 0;

  // Debug: Log quando o mercado muda
  useEffect(() => {
    console.log('Mercado atual:', market, 'Candles:', candles.length);
  }, [market, candles.length]);

  // Refs for containers
  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);
  const stochRef = useRef<HTMLDivElement | null>(null);

  // Chart refs (typed as any for compatibility across lightweight-charts versions)
  const mainChart = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const volSeries = useRef<any>(null);
  const rsiChart = useRef<any>(null);
  const rsiSeries = useRef<any>(null);
  const macdChart = useRef<any>(null);
  const macdLine = useRef<any>(null);
  const macdSignal = useRef<any>(null);
  const macdHist = useRef<any>(null);
  const stochChart = useRef<any>(null);
  const stochK = useRef<any>(null);
  const stochD = useRef<any>(null);

  // Build charts once
  useEffect(() => {
    console.log('Building charts - market:', market);
    const gridColor = hslVar("border", 0.4);
    const textColor = hslVar("muted-foreground", 1);
    const bg = `hsl(${getComputedStyle(document.documentElement).getPropertyValue("--card").trim()})`;

    // Limpar gráficos existentes
    if (mainChart.current) {
      mainChart.current.remove();
      mainChart.current = null;
      candleSeries.current = null;
      volSeries.current = null;
    }
    if (rsiChart.current) {
      rsiChart.current.remove();
      rsiChart.current = null;
      rsiSeries.current = null;
    }
    if (macdChart.current) {
      macdChart.current.remove();
      macdChart.current = null;
      macdLine.current = null;
      macdSignal.current = null;
      macdHist.current = null;
    }
    if (stochChart.current) {
      stochChart.current.remove();
      stochChart.current = null;
      stochK.current = null;
      stochD.current = null;
    }

    if (mainRef.current) {
      const chart = createChart(mainRef.current, {
        autoSize: true,
        layout: { background: { color: bg } as any, textColor },
        grid: { horzLines: { color: gridColor }, vertLines: { color: gridColor } },
      } as any);
      
      // Use string-based series type for compatibility
      const series = chart.addSeries(CandlestickSeries, { 
        upColor: hslVar("success"), 
        downColor: hslVar("destructive"), 
        borderUpColor: hslVar("success"), 
        borderDownColor: hslVar("destructive"), 
        wickUpColor: hslVar("success"), 
        wickDownColor: hslVar("destructive") 
      });
      
      mainChart.current = chart;
      candleSeries.current = series;
    }

    if (rsiRef.current && !rsiChart.current) {
      const chart = createChart(rsiRef.current, {
        autoSize: true,
        layout: { background: { color: bg } as any, textColor },
        grid: { horzLines: { color: gridColor }, vertLines: { color: gridColor } },
        rightPriceScale: { scaleMargins: { top: 0.2, bottom: 0.2 } },
      } as any);
      
      const series = chart.addSeries(LineSeries, { color: hslVar("primary"), lineWidth: 2 });
      rsiChart.current = chart;
      rsiSeries.current = series;
    }

    if (macdRef.current && !macdChart.current) {
      const chart = createChart(macdRef.current, {
        autoSize: true,
        layout: { background: { color: bg } as any, textColor },
        grid: { horzLines: { color: gridColor }, vertLines: { color: gridColor } },
      } as any);
      
      macdChart.current = chart;
      macdLine.current = chart.addSeries(LineSeries, { color: hslVar("success"), lineWidth: 2 });
      macdSignal.current = chart.addSeries(LineSeries, { color: hslVar("warning"), lineWidth: 2 });
      macdHist.current = chart.addSeries(HistogramSeries, { color: hslVar("destructive") });
    }

    if (stochRef.current && !stochChart.current) {
      const chart = createChart(stochRef.current, {
        autoSize: true,
        layout: { background: { color: bg } as any, textColor },
        grid: { horzLines: { color: gridColor }, vertLines: { color: gridColor } },
      } as any);
      
      stochChart.current = chart;
      stochK.current = chart.addSeries(LineSeries, { color: hslVar("primary"), lineWidth: 2 });
      stochD.current = chart.addSeries(LineSeries, { color: hslVar("destructive"), lineWidth: 2 });
    }

    return () => {
      mainChart.current?.remove?.();
      rsiChart.current?.remove?.();
      macdChart.current?.remove?.();
      stochChart.current?.remove?.();
      mainChart.current = null;
      rsiChart.current = null;
      macdChart.current = null;
      stochChart.current = null;
      candleSeries.current = null;
      rsiSeries.current = null;
      macdLine.current = null;
      macdSignal.current = null;
      macdHist.current = null;
      stochK.current = null;
      stochD.current = null;
    };
  }, [market]); // Recriar quando o mercado muda

  // Feed data
  useEffect(() => {
    console.log('Feed data effect - candles:', candles.length, 'candleSeries:', !!candleSeries.current);
    if (!candles.length || !candleSeries.current) {
      console.log('Skipping data feed - no candles or series');
      return;
    }
    const data = candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close }));
    console.log('Setting candle data:', data.length, 'points');
    candleSeries.current.setData?.(data);

    if (!volSeries.current && mainChart.current) {
      volSeries.current = mainChart.current.addSeries(HistogramSeries, { 
        priceScaleId: "", 
        priceFormat: { type: "volume" }, 
        color: hslVar("muted-foreground", 0.4) 
      });
    }
    if (volSeries.current) {
      volSeries.current.setData?.(
        candles.map((c) => ({ time: c.time as Time, value: c.volume, color: c.close >= c.open ? hslVar("success", 0.6) : hslVar("destructive", 0.6) }))
      );
    }

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => c.time);

    if (rsiSeries.current) {
      const rsi = calcRSI(closes, 14);
      const aligned = rsi.map((r, i) => ({ time: (times[i + 15] as unknown as Time) || r.time, value: r.value }));
      rsiSeries.current.setData?.(aligned);
    }

    if (macdLine.current && macdSignal.current && macdHist.current) {
      const macd = calcMACD(closes, times);
      macdLine.current.setData?.(macd.macd);
      macdSignal.current.setData?.(macd.signal);
      macdHist.current.setData?.(macd.hist);
    }

    if (stochK.current && stochD.current) {
      const stoch = calcStochRSI(closes, times);
      stochK.current.setData?.(stoch.k);
      stochD.current.setData?.(stoch.d);
    }
  }, [candles]);

  const last = candles[candles.length - 1];
  const isPositive = (priceChangePercent || 0) >= 0;

  return (
    <Card className="p-4 bg-card">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-muted p-1 rounded-md">
            {(["1m", "5m", "30m", "1h"] as TimeFrame[]).map((tf) => (
              <Button
                key={tf}
                size="sm"
                variant={timeFrame === tf ? "default" : "ghost"}
                onClick={() => setTimeFrame(tf)}
                className={`h-7 px-3 text-xs ${timeFrame === tf ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {tf}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-success h-7 px-2 text-xs">
            📊 Indicators
          </Button>
          <div className="w-56">
            <Select 
              value={market} 
              onValueChange={(v) => {
                console.log('Mudando mercado para:', v);
                setMarket(v as MarketId);
              }}
            >
              <SelectTrigger className="h-7 px-2 text-xs">
                <SelectValue aria-label="Mercado" placeholder="Selecionar mercado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="binance-btcusdt">BTC/USDT • Binance</SelectItem>
                <SelectItem value="exness-bitcoin">BITCOIN • Exness</SelectItem>
                <SelectItem value="exness-btcusd">BTC/USD • Exness</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${live ? "bg-success animate-pulse" : "bg-border"}`}></div>
          <span className={`text-xs font-medium ${live ? "text-success" : "text-muted-foreground"}`}>LIVE</span>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4 text-sm px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          <span className="font-medium">{marketCfg.displaySymbol}</span>
          <span className="text-muted-foreground">• {timeFrame} • {realTimeData.candles.length > 0 ? 'Dados Reais' : 'Binance (fallback)'}</span>
          <span className="text-xs text-blue-500">(ID: {market})</span>
        </div>
        {last && (
          <div className="flex gap-4 text-xs">
            <div className="flex gap-1"><span className="text-muted-foreground">O</span><span className="font-mono">{last.open.toFixed(2)}</span></div>
            <div className="flex gap-1"><span className="text-muted-foreground">H</span><span className="font-mono">{last.high.toFixed(2)}</span></div>
            <div className="flex gap-1"><span className="text-muted-foreground">L</span><span className="font-mono">{last.low.toFixed(2)}</span></div>
            <div className="flex gap-1"><span className="text-muted-foreground">C</span><span className={`font-mono ${isPositive ? "text-success" : "text-destructive"}`}>{last.close.toFixed(2)}</span></div>
            <div className={`font-mono ${isPositive ? "text-success" : "text-destructive"}`}>{isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%</div>
          </div>
        )}
        <div className="ml-auto text-muted-foreground text-xs">Vol • BTC: {last ? last.volume.toFixed(0) : "0"}</div>
      </div>

      <div className="w-full border border-border rounded-lg bg-card/50 overflow-hidden">
        <div ref={mainRef} className="w-full" style={{ height: 360 }} />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        <div className="w-full border border-border rounded-lg bg-card/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1"><span className="text-xs text-muted-foreground font-medium">RSI 14 close</span></div>
          <div ref={rsiRef} className="w-full" style={{ height: 120 }} />
        </div>
        <div className="w-full border border-border rounded-lg bg-card/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1"><span className="text-xs text-muted-foreground font-medium">MACD 12 26 9</span></div>
          <div ref={macdRef} className="w-full" style={{ height: 120 }} />
        </div>
        <div className="w-full border border-border rounded-lg bg-card/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1"><span className="text-xs text-muted-foreground font-medium">Stoch RSI 3 3 14 14</span></div>
          <div ref={stochRef} className="w-full" style={{ height: 120 }} />
        </div>
      </div>
    </Card>
  );
}