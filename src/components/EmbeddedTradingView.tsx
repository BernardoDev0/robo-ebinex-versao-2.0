import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MarketId = "binance-btcusdt" | "exness-bitcoin" | "exness-btcusd";

const MARKET_OPTIONS: Record<MarketId, { 
  tradingViewSymbol: string;
  displaySymbol: string; 
  providerLabel: string;
}> = {
  "binance-btcusdt": { 
    tradingViewSymbol: "BINANCE:BTCUSDT",
    displaySymbol: "BTC/USDT", 
    providerLabel: "Binance"
  },
  "exness-bitcoin": { 
    tradingViewSymbol: "EXNESS:BITCOIN",
    displaySymbol: "BITCOIN", 
    providerLabel: "Exness"
  },
  "exness-btcusd": { 
    tradingViewSymbol: "EXNESS:BTCUSD",
    displaySymbol: "BTC/USD", 
    providerLabel: "Exness"
  },
};

const INTERVAL_OPTIONS = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "1D" },
];

export function EmbeddedTradingView() {
  const [market, setMarket] = useState<MarketId>("binance-btcusdt");
  const [interval, setInterval] = useState("5");
  const [height, setHeight] = useState(500);

  const marketCfg = MARKET_OPTIONS[market];

  // Gerar URL do widget TradingView
  const tradingViewUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_${Date.now()}&symbol=${encodeURIComponent(marketCfg.tradingViewSymbol)}&interval=${interval}&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=pt&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${encodeURIComponent(marketCfg.tradingViewSymbol)}`;

  return (
    <Card className="p-4 bg-card">
      {/* Controles */}
      <div className="flex items-center justify-between mb-4 px-2">
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

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHeight(height === 500 ? 700 : 500)}
              className="h-7 px-2 text-xs"
            >
              {height === 500 ? "Expandir" : "Reduzir"}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
          <span className="text-xs font-medium text-success">LIVE</span>
        </div>
      </div>

      {/* Informações do mercado */}
      <div className="flex items-center gap-6 mb-4 text-sm px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          <span className="font-medium">{marketCfg.displaySymbol}</span>
          <span className="text-muted-foreground">• {INTERVAL_OPTIONS.find(opt => opt.value === interval)?.label} • TradingView Oficial</span>
        </div>
      </div>

      {/* Container do gráfico */}
      <div className="w-full border border-border rounded-lg bg-card/50 overflow-hidden">
        <iframe
          src={tradingViewUrl}
          style={{
            width: '100%',
            height: `${height}px`,
            border: 'none',
            borderRadius: '8px'
          }}
          title={`TradingView Chart - ${marketCfg.displaySymbol}`}
          allow="clipboard-write"
        />
      </div>

      {/* Rodapé */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{marketCfg.displaySymbol} • {marketCfg.providerLabel} • TradingView</span>
        <div className="flex items-center gap-4">
          <span>Dados em tempo real</span>
          <button className="text-primary hover:text-primary/80">📊 Indicadores</button>
        </div>
      </div>
    </Card>
  );
}
