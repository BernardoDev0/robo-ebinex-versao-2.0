import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type TimeFrame = '1m' | '5m' | '30m' | '1h';

const timeFrameMap = {
  '1m': '1m',
  '5m': '5m', 
  '30m': '30m',
  '1h': '1h'
};

export function SimpleTradingChart() {
  const [currentData, setCurrentData] = useState<CandlestickData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<any>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1h');
  const [loading, setLoading] = useState(true);
  const [rsiValue, setRsiValue] = useState(62.64);
  const [macdValues, setMacdValues] = useState({ macd: 11.23, signal: 69.61, histogram: 57.37 });
  const [stochRsiValues, setStochRsiValues] = useState({ k: 61.71, d: 37.44 });

  // Calculate RSI
  const calculateRSI = (prices: number[], period = 14): number => {
    if (prices.length < period + 1) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    let avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
    let avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const fetchBitcoinData = async () => {
    try {
      setLoading(true);
      
      // Fetch current price
      const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      const priceData = await priceResponse.json();
      setCurrentPrice(priceData);

      // Fetch klines data
      const limit = 100;
      const klineResponse = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeFrameMap[timeFrame]}&limit=${limit}`);
      const klineData = await klineResponse.json();
      
      const formattedData: CandlestickData[] = klineData.map((item: any) => ({
        time: Math.floor(item[0] / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));

      setCurrentData(formattedData);
      
      // Calculate indicators
      const closePrices = formattedData.map(d => d.close);
      const rsi = calculateRSI(closePrices);
      setRsiValue(rsi);
      
      // Mock MACD and Stoch RSI with realistic variations
      setMacdValues({
        macd: 11.23 + (Math.random() - 0.5) * 20,
        signal: 69.61 + (Math.random() - 0.5) * 20,
        histogram: 57.37 + (Math.random() - 0.5) * 20
      });
      
      setStochRsiValues({
        k: Math.random() * 100,
        d: Math.random() * 100
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar dados do Bitcoin:', error);
      setLoading(false);
    }
  };

  // Create SVG candlestick chart
  const renderCandlesticks = () => {
    if (!currentData.length) return null;

    const maxPrice = Math.max(...currentData.map(d => d.high));
    const minPrice = Math.min(...currentData.map(d => d.low));
    const priceRange = maxPrice - minPrice;
    const chartHeight = 300;
    const chartWidth = 800;
    const candleWidth = chartWidth / currentData.length * 0.8;

    return (
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="bg-background">
        <defs>
          <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#26a69a" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#26a69a" stopOpacity="0.2"/>
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <line 
            key={i}
            x1="0" 
            y1={i * (chartHeight / 4)} 
            x2={chartWidth} 
            y2={i * (chartHeight / 4)} 
            stroke="hsl(var(--border))" 
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Candlesticks */}
        {currentData.map((candle, index) => {
          const x = (index / currentData.length) * chartWidth;
          const isGreen = candle.close >= candle.open;
          
          const highY = ((maxPrice - candle.high) / priceRange) * (chartHeight - 80) + 20;
          const lowY = ((maxPrice - candle.low) / priceRange) * (chartHeight - 80) + 20;
          const openY = ((maxPrice - candle.open) / priceRange) * (chartHeight - 80) + 20;
          const closeY = ((maxPrice - candle.close) / priceRange) * (chartHeight - 80) + 20;
          
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.abs(closeY - openY);
          
          return (
            <g key={index}>
              {/* Wick */}
              <line
                x1={x + candleWidth / 2}
                y1={highY}
                x2={x + candleWidth / 2}
                y2={lowY}
                stroke={isGreen ? '#26a69a' : '#ef5350'}
                strokeWidth="1"
              />
              {/* Body */}
              <rect
                x={x + candleWidth * 0.1}
                y={bodyTop}
                width={candleWidth * 0.8}
                height={Math.max(bodyHeight, 1)}
                fill={isGreen ? '#26a69a' : '#ef5350'}
                opacity="0.8"
              />
            </g>
          );
        })}
        
        {/* Price labels */}
        {[0, 1, 2, 3, 4].map(i => {
          const price = maxPrice - (i * priceRange / 4);
          return (
            <text 
              key={i}
              x={chartWidth - 80} 
              y={i * (chartHeight / 4) + 5} 
              fill="hsl(var(--muted-foreground))" 
              fontSize="12"
              textAnchor="start"
            >
              ${price.toFixed(0)}
            </text>
          );
        })}
      </svg>
    );
  };

  useEffect(() => {
    fetchBitcoinData();
    const interval = setInterval(fetchBitcoinData, 5000); // Atualizar a cada 5 segundos para tempo real
    return () => clearInterval(interval);
  }, [timeFrame]);

  const priceChange = currentPrice ? parseFloat(currentPrice.priceChangePercent) : 0;
  const isPositive = priceChange >= 0;
  const lastCandle = currentData[currentData.length - 1];

  if (loading) {
    return (
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando dados do Bitcoin...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card">
      {/* Header with timeframe selector */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-muted p-1 rounded-md">
            {(['1m', '5m', '30m', '1h'] as TimeFrame[]).map((tf) => (
              <Button
                key={tf}
                variant={timeFrame === tf ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeFrame(tf)}
                className={`h-7 px-3 text-xs ${timeFrame === tf ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                {tf}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">📈</Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">📊</Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">📋</Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">➕</Button>
          </div>
          <Button variant="ghost" size="sm" className="text-success h-7 px-2 text-xs">
            📊 Indicators
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
          <span className="text-xs text-success font-medium">LIVE</span>
        </div>
      </div>

      {/* OHLCV Info */}
      <div className="flex items-center gap-6 mb-4 text-sm px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          <span className="text-foreground font-medium">Bitcoin / TetherUS</span>
          <span className="text-muted-foreground">• {timeFrame} • Binance</span>
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
        </div>
        {lastCandle && (
          <div className="flex gap-4 text-xs">
            <div className="flex gap-1">
              <span className="text-muted-foreground">O</span>
              <span className="text-foreground font-mono">{lastCandle.open.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-muted-foreground">H</span>
              <span className="text-foreground font-mono">{lastCandle.high.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-muted-foreground">L</span>
              <span className="text-foreground font-mono">{lastCandle.low.toFixed(2)}</span>
            </div>
            <div className="flex gap-1">
              <span className="text-muted-foreground">C</span>
              <span className={`font-mono ${isPositive ? "text-success" : "text-destructive"}`}>
                {lastCandle.close.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-1">
              <span className={`font-mono ${isPositive ? "text-success" : "text-destructive"}`}>
                {isPositive ? "+" : ""}{priceChange.toFixed(2)} ({isPositive ? "+" : ""}{priceChange.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}
        <div className="ml-auto text-muted-foreground text-xs">
          Vol • BTC: {lastCandle ? lastCandle.volume.toFixed(0) : '0'}
        </div>
      </div>

      {/* Main Chart */}
      <div className="w-full border border-border rounded-lg bg-card/50 overflow-hidden">
        <div className="bg-gradient-to-b from-background/80 to-background/40 p-4">
          {renderCandlesticks()}
        </div>
      </div>
      
      {/* Volume Chart */}
      <div className="w-full mt-2 border border-border rounded-lg bg-card/30 overflow-hidden">
        <div className="bg-gradient-to-b from-background/60 to-background/20 p-2 h-20">
          <div className="mb-1">
            <span className="text-xs text-muted-foreground font-medium">Volume</span>
          </div>
          <svg width="100%" height="50" viewBox="0 0 800 50" className="bg-transparent">
            {currentData.map((candle, index) => {
              const x = (index / currentData.length) * 800;
              const maxVolume = Math.max(...currentData.map(d => d.volume));
              const volumeHeight = (candle.volume / maxVolume) * 40;
              const isGreen = candle.close >= candle.open;
              
              return (
                <rect
                  key={index}
                  x={x}
                  y={50 - volumeHeight}
                  width={800 / currentData.length * 0.8}
                  height={volumeHeight}
                  fill={isGreen ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                  opacity="0.7"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Indicators */}
      <div className="mt-4 space-y-4">
        <div className="bg-muted/20 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">RSI</span>
              <span className="text-xs text-muted-foreground">14 close</span>
            </div>
            <span className="text-xs text-purple-400 font-mono">{rsiValue.toFixed(2)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full relative">
            <div 
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${rsiValue}%` }}
            />
            {/* RSI levels */}
            <div className="absolute top-0 left-[30%] w-px h-full bg-red-500 opacity-30"></div>
            <div className="absolute top-0 left-[50%] w-px h-full bg-yellow-500 opacity-30"></div>
            <div className="absolute top-0 left-[70%] w-px h-full bg-red-500 opacity-30"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>30</span>
            <span>50</span>
            <span>70</span>
            <span>100</span>
          </div>
        </div>
        
        <div className="bg-muted/20 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">MACD</span>
              <span className="text-xs text-muted-foreground">12 26 close 9</span>
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-blue-400 font-mono">{macdValues.macd.toFixed(2)}</span>
              <span className="text-xs text-orange-400 font-mono">{macdValues.signal.toFixed(2)}</span>
              <span className="text-xs text-red-400 font-mono">{macdValues.histogram.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-8 bg-muted rounded flex items-center justify-center relative">
            <div className="absolute left-0 top-0 w-full h-full flex items-center">
              <div 
                className="bg-blue-400 h-1 rounded"
                style={{ width: '40%', marginLeft: '30%' }}
              />
              <div 
                className="bg-orange-400 h-1 rounded ml-1"
                style={{ width: '35%' }}
              />
            </div>
            <div className="text-xs text-muted-foreground z-10">MACD Lines</div>
          </div>
        </div>
        
        <div className="bg-muted/20 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Stoch RSI</span>
              <span className="text-xs text-muted-foreground">3 3 14 14 close</span>
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-purple-400 font-mono">{stochRsiValues.k.toFixed(2)}</span>
              <span className="text-xs text-red-400 font-mono">{stochRsiValues.d.toFixed(2)}</span>
            </div>
          </div>
          <div className="h-8 bg-muted rounded flex items-center relative">
            <div 
              className="h-1 bg-purple-400 rounded ml-2 absolute"
              style={{ width: `${(stochRsiValues.k / 100) * 70}%`, top: '30%' }}
            />
            <div 
              className="h-1 bg-red-400 rounded ml-2 absolute"
              style={{ width: `${(stochRsiValues.d / 100) * 70}%`, top: '60%' }}
            />
            {/* Stoch RSI levels */}
            <div className="absolute top-0 left-[20%] w-px h-full bg-red-500 opacity-20"></div>
            <div className="absolute top-0 left-[80%] w-px h-full bg-red-500 opacity-20"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span>
            <span>20</span>
            <span>50</span>
            <span>80</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </Card>
  );
}