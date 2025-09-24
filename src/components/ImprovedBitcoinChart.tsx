import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChartData {
  time: string;
  price: number;
  volume: number;
}

interface BitcoinData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  high24h: string;
  low24h: string;
}

type MarketId = "binance-btcusdt" | "exness-bitcoin" | "exness-btcusd";

const MARKET_OPTIONS: Record<MarketId, { 
  binanceSymbol: string;
  displaySymbol: string; 
  providerLabel: string;
  apiEndpoint: string;
}> = {
  "binance-btcusdt": { 
    binanceSymbol: "BTCUSDT",
    displaySymbol: "BTC/USDT", 
    providerLabel: "Binance",
    apiEndpoint: "https://api.binance.com/api/v3"
  },
  "exness-bitcoin": { 
    binanceSymbol: "BTCUSDT", // Usar Binance como proxy para Exness
    displaySymbol: "BITCOIN", 
    providerLabel: "Exness (via Binance)",
    apiEndpoint: "https://api.binance.com/api/v3"
  },
  "exness-btcusd": { 
    binanceSymbol: "BTCUSDT", // Usar Binance como proxy para Exness
    displaySymbol: "BTC/USD", 
    providerLabel: "Exness (via Binance)",
    apiEndpoint: "https://api.binance.com/api/v3"
  },
};

const INTERVAL_OPTIONS = [
  { value: "1m", label: "1m", limit: 24 },
  { value: "5m", label: "5m", limit: 24 },
  { value: "15m", label: "15m", limit: 24 },
  { value: "30m", label: "30m", limit: 24 },
  { value: "1h", label: "1h", limit: 24 },
  { value: "4h", label: "4h", limit: 24 },
  { value: "1d", label: "1D", limit: 30 },
];

export function ImprovedBitcoinChart() {
  const [market, setMarket] = useState<MarketId>("binance-btcusdt");
  const [interval, setInterval] = useState("1h");
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<BitcoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const marketCfg = MARKET_OPTIONS[market];
  const intervalCfg = INTERVAL_OPTIONS.find(opt => opt.value === interval) || INTERVAL_OPTIONS[4];

  useEffect(() => {
    const fetchBitcoinData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch current price and 24h stats
        const priceResponse = await fetch(`${marketCfg.apiEndpoint}/ticker/24hr?symbol=${marketCfg.binanceSymbol}`);
        if (!priceResponse.ok) {
          throw new Error(`Erro na API: ${priceResponse.status}`);
        }
        
        const priceData = await priceResponse.json();
        const mappedPrice: BitcoinData = {
          symbol: priceData.symbol,
          lastPrice: String(priceData.lastPrice ?? priceData.price ?? "0"),
          priceChangePercent: String(priceData.priceChangePercent ?? "0"),
          volume: String(priceData.volume ?? "0"),
          high24h: String(priceData.highPrice ?? "0"),
          low24h: String(priceData.lowPrice ?? "0"),
        };
        setCurrentPrice(mappedPrice);

        // Fetch klines data for chart
        const klineResponse = await fetch(
          `${marketCfg.apiEndpoint}/klines?symbol=${marketCfg.binanceSymbol}&interval=${interval}&limit=${intervalCfg.limit}`
        );
        
        if (!klineResponse.ok) {
          throw new Error(`Erro na API de klines: ${klineResponse.status}`);
        }
        
        const klineData = await klineResponse.json();
        
        const formattedData = klineData.map((item: any) => ({
          time: new Date(item[0]).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          }),
          price: parseFloat(item[4]), // closing price
          volume: parseFloat(item[5]) // volume
        }));

        setChartData(formattedData);
      } catch (error) {
        console.error('Erro ao buscar dados do Bitcoin:', error);
        setError(`Erro ao carregar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBitcoinData();
    const intervalId = setInterval(fetchBitcoinData, 30000); // Atualiza a cada 30 segundos

    return () => clearInterval(intervalId);
  }, [market, interval, marketCfg, intervalCfg]);

  if (loading) {
    return (
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando dados do Bitcoin...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-center h-96">
          <div className="text-destructive">{error}</div>
        </div>
      </Card>
    );
  }

  const priceChange = currentPrice ? parseFloat(currentPrice.priceChangePercent) : 0;
  const isPositive = priceChange >= 0;
  const lastPrice = currentPrice ? parseFloat(currentPrice.lastPrice) : 0;

  return (
    <Card className="p-6 bg-card">
      {/* Controles */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-muted p-1 rounded-md">
            {INTERVAL_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={interval === opt.value ? "default" : "ghost"}
                onClick={() => setInterval(opt.value)}
                className={`h-7 px-3 text-xs ${interval === opt.value ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          
          <div className="w-56">
            <Select 
              value={market} 
              onValueChange={(v) => setMarket(v as MarketId)}
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
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>

      {/* Header com preços */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-2xl font-bold text-foreground">{marketCfg.displaySymbol}</h2>
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-sm font-medium">● LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-3xl font-bold text-foreground">
            ${lastPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            isPositive ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'
          }`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
          {currentPrice && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>24h Alta: ${parseFloat(currentPrice.high24h).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              <span>24h Baixa: ${parseFloat(currentPrice.low24h).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === 'price' ? `$${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : value,
                name === 'price' ? 'Preço' : 'Volume'
              ]}
              labelFormatter={(label) => `Horário: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rodapé */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{marketCfg.displaySymbol} • {marketCfg.providerLabel} • {intervalCfg.label}</span>
        <div className="flex items-center gap-4">
          <span>Vol • BTC: {currentPrice ? parseFloat(currentPrice.volume).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}</span>
          <button className="text-primary hover:text-primary/80">📊 Indicadores</button>
        </div>
      </div>
    </Card>
  );
}
