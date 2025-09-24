import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

interface ChartData {
  time: string;
  price: number;
}

interface BitcoinData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

export function BitcoinChart() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<BitcoinData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBitcoinData = async () => {
      try {
        // Fetch current price
        const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const priceData = await priceResponse.json();
        const mappedPrice: BitcoinData = {
          symbol: priceData.symbol,
          lastPrice: String(priceData.lastPrice ?? priceData.price ?? "0"),
          priceChangePercent: String(priceData.priceChangePercent ?? "0"),
          volume: String(priceData.volume ?? "0"),
        };
        setCurrentPrice(mappedPrice);

        // Fetch klines data for chart (1 hour interval, last 24 hours)
        const klineResponse = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24');
        const klineData = await klineResponse.json();
        
        const formattedData = klineData.map((item: any) => ({
          time: new Date(item[0]).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          price: parseFloat(item[4]) // closing price
        }));

        setChartData(formattedData);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao buscar dados do Bitcoin:', error);
        setLoading(false);
      }
    };

    fetchBitcoinData();
    const interval = setInterval(fetchBitcoinData, 30000); // Atualiza a cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6 bg-card">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Carregando dados do Bitcoin...</div>
        </div>
      </Card>
    );
  }

  const priceChange = currentPrice ? parseFloat(currentPrice.priceChangePercent) : 0;
  const isPositive = priceChange >= 0;

  return (
    <Card className="p-6 bg-card">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-2xl font-bold text-foreground">BTC/USDT</h2>
          <div className="flex items-center gap-2">
            <span className="text-green-500 text-sm font-medium">● LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-3xl font-bold text-foreground">
            ${currentPrice ? parseFloat(currentPrice.lastPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </span>
          <span className={`text-sm font-medium px-2 py-1 rounded ${
            isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
          }`}>
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </span>
        </div>
      </div>

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
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>Bitcoin / TetherUS • 1h • Binance</span>
        <div className="flex items-center gap-4">
          <span>Vol • BTC: {currentPrice ? parseFloat(currentPrice.volume).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}</span>
          <button className="text-primary hover:text-primary/80">📊 Indicators</button>
        </div>
      </div>
    </Card>
  );
}