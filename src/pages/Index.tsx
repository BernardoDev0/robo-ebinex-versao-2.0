import { AnalysisPanel, AnalysisLogs } from "@/components/AnalysisPanel";
import { TradingViewLikeChart } from "@/components/TradingViewLikeChart";
import { EmbeddedTradingView } from "@/components/EmbeddedTradingView";
import { ImprovedBitcoinChart } from "@/components/ImprovedBitcoinChart";
import TradeTracker from "@/components/TradeTracker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [chartType, setChartType] = useState("tradingview");

  const renderChart = () => {
    switch (chartType) {
      case "tradingview":
        return <EmbeddedTradingView />;
      case "improved":
        return <ImprovedBitcoinChart />;
      case "advanced":
        return <TradingViewLikeChart />;
      default:
        return <EmbeddedTradingView />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <Tabs defaultValue="trading" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="trading" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trading & Análise
            </TabsTrigger>
            <TabsTrigger value="tracker" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Trade Tracker
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trading" className="space-y-6">
            {/* Seletor de tipo de gráfico */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Gráficos Bitcoin - Exness & TradingView</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tipo de gráfico:</span>
                <Select value={chartType} onValueChange={setChartType}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tradingview">TradingView Oficial</SelectItem>
                    <SelectItem value="improved">Gráfico Melhorado</SelectItem>
                    <SelectItem value="advanced">Gráfico Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chart Area */}
              <div className="lg:col-span-2">
                <div className="h-96">
                  {renderChart()}
                </div>
              </div>
              
              {/* Analysis Panel */}
              <div className="lg:col-span-1">
                <AnalysisPanel />
              </div>
            </div>
            
            {/* Log de Análises - Fora do grid, ocupando toda a largura com mais espaçamento */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <AnalysisLogs />
            </div>
          </TabsContent>
          
          <TabsContent value="tracker" className="space-y-6">
            <TradeTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
