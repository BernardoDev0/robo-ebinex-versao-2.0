import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Download, Clock, Volume2, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import { 
  calculateRSI, 
  calculateStochRSI, 
  calculateMACD, 
  calculateEMA, 
  calculateATR, 
  detectCandlePatterns, 
  calculateWeightedConfluence, 
  getNextCandleTimer, 
  getTradingSession, 
  AlertSystem,
  runBacktest,
  createBacktestStrategy,
  type SignalData,
  type CandleData,
  type BacktestResult
} from "@/lib/tradingUtils";

interface AnalysisResult {
  direction: string;
  confidence: number;
  price: string;
  sentiment: string;
  analysis: string;
  reasoning: string;
  entry: string;
  stopLoss: string;
  takeProfit: string;
  confluences?: number;
  riskLevel?: string;
  expiration?: string;
  timeframe?: string;
  detailedReasons?: string[];
  stochRSI?: { K: number; D: number; signal: string };
  atr?: { value: number; level: string; percentage: number };
  patterns?: string[];
  tradingSession?: { quality: string; recommendation: string };
  confluenceDetails?: any;
}

interface AnalysisLog {
  id: string;
  timestamp: string;
  direction: "COMPRA" | "VENDA" | "AGUARDAR";
  confidence: number;
  price: string;
  expiration: string;
  timeframe: string;
  reasons: string[];
  rsi: number;
  macd: number;
  macdSignal: number;
  emaAlignment: string;
  confluences: number;
  riskLevel: string;
  provider: string;
  model?: string;
  result?: 'win' | 'loss';
}

export function AnalysisPanel() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState("openai/gpt-oss-120b");
  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Novos estados para funcionalidades melhoradas
  const [nextCandleTimer, setNextCandleTimer] = useState(getNextCandleTimer('5m'));
  const [tradingSession, setTradingSession] = useState(getTradingSession());
  const [alertSystem] = useState(new AlertSystem());
  const [showBacktest, setShowBacktest] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const timerRef = useRef<number>();

  // Função para salvar log da análise
  const saveAnalysisLog = (result: AnalysisResult, realData: any, provider: string, model?: string) => {
    const log: AnalysisLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString('pt-BR'),
      direction: result.direction as "COMPRA" | "VENDA" | "AGUARDAR",
      confidence: result.confidence,
      price: result.price,
      expiration: result.expiration || "5 minutos",
      timeframe: result.timeframe || "1h + 5min",
      reasons: result.detailedReasons || [result.reasoning],
      rsi: realData?.rsi || 0,
      macd: realData?.macd || 0,
      macdSignal: realData?.macdSignal || 0,
      emaAlignment: realData ? (realData.ema9 > realData.ema21 && realData.ema21 > realData.ema50 ? 'ALTA' : 
                                realData.ema9 < realData.ema21 && realData.ema21 < realData.ema50 ? 'BAIXA' : 'LATERAL') : 'N/A',
      confluences: result.confluences || 0,
      riskLevel: result.riskLevel || 'MÉDIO',
      provider: provider,
      model: model
    };

    setAnalysisLogs(prev => [log, ...prev.slice(0, 49)]); // Manter apenas os últimos 50 logs
    
    // Salvar no localStorage
    try {
      const savedLogs = JSON.parse(localStorage.getItem('bitcoin-analysis-logs') || '[]');
      savedLogs.unshift(log);
      localStorage.setItem('bitcoin-analysis-logs', JSON.stringify(savedLogs.slice(0, 49)));
    } catch (error) {
      console.error('Erro ao salvar log:', error);
    }

    console.log('📝 Log salvo:', log);
  };

  // Função para carregar logs salvos
  const loadAnalysisLogs = () => {
    try {
      const savedLogs = JSON.parse(localStorage.getItem('bitcoin-analysis-logs') || '[]');
      setAnalysisLogs(savedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  // Função para marcar resultado do log
  const markLogResult = (logId: string, result: 'win' | 'loss') => {
    setAnalysisLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, result } : log
    ));
    
    // Salvar no localStorage
    try {
      const updatedLogs = analysisLogs.map(log => 
        log.id === logId ? { ...log, result } : log
      );
      localStorage.setItem('bitcoin-analysis-logs', JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Erro ao salvar resultado do log:', error);
    }
  };

  // Função para baixar logs selecionadas
  const downloadSelectedLogs = () => {
    const selectedLogs = analysisLogs.filter(log => log.result === 'win' || log.result === 'loss');
    
    if (selectedLogs.length === 0) {
      toast({
        title: "Nenhuma log selecionada",
        description: "Marque algumas análises como WIN ou LOSS antes de baixar.",
        variant: "destructive"
      });
      return;
    }

    const dataToExport = {
      logs: selectedLogs,
      exportDate: new Date().toISOString(),
      totalLogs: selectedLogs.length,
      wins: selectedLogs.filter(log => log.result === 'win').length,
      losses: selectedLogs.filter(log => log.result === 'loss').length,
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitcoin-analysis-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Logs baixadas com sucesso!",
      description: `${selectedLogs.length} análises exportadas.`,
    });
  };

  // Carregar logs ao montar o componente
  useEffect(() => {
    loadAnalysisLogs();
    
    // Solicitar permissão para notificações
    alertSystem.requestPermission();
  }, []);
  
  // Timer para próxima vela
  useEffect(() => {
    const updateTimer = () => {
      setNextCandleTimer(getNextCandleTimer('5m'));
      setTradingSession(getTradingSession());
    };
    
    // Atualizar a cada segundo
    timerRef.current = window.setInterval(updateTimer, 1000);
    
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Alertas baseados no timer
  useEffect(() => {
    if (nextCandleTimer.alert30s && !nextCandleTimer.alert10s) {
      alertSystem.notifySignal('TIMER');
    }
  }, [nextCandleTimer.alert30s, nextCandleTimer.alert10s, alertSystem]);

  // Modelo fixo GPT OSS 120B
  const selectedModelInfo = {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    description: "Modelo GPT de código aberto com 120B parâmetros",
    category: "Multilingual",
    speed: "🚀 Rápido",
    quality: "⭐⭐⭐⭐⭐⭐"
  };

  const analysisSteps = [
    "Verificando RSI, MACD e Stochastic RSI",
    "Analisando EMAs e confluências técnicas", 
    "Checando suportes, resistências e volume",
    "Validando confiança mínima 70% (Ebinex)",
    "Definindo sinal: COMPRA/VENDA/AGUARDAR"
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const handleAnalysis = async () => {

    setIsAnalyzing(true);
    setCurrentStep(0);
    setAnalysisResult(null);

    // Simular progresso da análise
    for (let i = 0; i < analysisSteps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    try {
      // Buscar dados reais do Bitcoin
      console.log('🔄 Iniciando busca de dados reais do Bitcoin...');
      const realData = await fetchRealBitcoinData();
      
      if (!realData) {
        console.error('❌ Dados reais não obtidos');
        throw new Error('Não foi possível buscar dados reais do Bitcoin. Verifique sua conexão com a internet.');
      }
      
      console.log('✅ Dados reais obtidos, gerando análise...');
      // Gerar análise baseada em dados reais
      const result = generateRealAnalysis(realData);
      
      console.log('📊 Análise gerada:', result);
      setAnalysisResult(result);
      
      // Salvar log da análise
      saveAnalysisLog(result, realData, "algoritmo-proprio", selectedModelInfo.name);

      toast({
        title: "Análise concluída!",
        description: `Sinal ${result.direction} com ${result.confidence}% de confiança`,
      });

    } catch (error) {
      console.error('❌ Erro na análise:', error);
      
      // Fallback: Gerar análise demo se houver erro
      console.log('🔄 Tentando análise demo como fallback...');
      try {
        const demoResult = generateDemoAnalysis();
        setAnalysisResult(demoResult);
        
        toast({
          title: "Análise Demo",
          description: "Usando dados simulados. Verifique sua conexão para dados reais.",
          variant: "destructive"
        });
      } catch (demoError) {
        console.error('❌ Erro na análise demo:', demoError);
        toast({
          title: "Erro na análise",
          description: "Erro completo do sistema. Tente novamente em alguns segundos.",
          variant: "destructive"
        });
      }
    }

    setIsAnalyzing(false);
  };

  const stopAnalysis = () => {
    setIsAnalyzing(false);
    setCurrentStep(0);
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      huggingface: "Hugging Face",
      cohere: "Cohere",
      groq: "Groq",
      demo: "Demo"
    };
    return names[provider] || provider;
  };

  const generateDemoAnalysis = (): AnalysisResult => {
    // Seguindo regras da Ebinex: só sinal se confiança >= 70%
    const directions = ["COMPRA", "VENDA", "AGUARDAR"];
    const confidenceLevel = Math.floor(Math.random() * 31) + 70; // 70-100%
    
    // Se confiança < 80%, força AGUARDAR (mais conservador)
    const randomDirection = confidenceLevel < 80 && Math.random() < 0.4 ? 
      "AGUARDAR" : directions[Math.floor(Math.random() * directions.length)];
    
    const rsi = Math.floor(Math.random() * 40) + 30;
    const macdSignal = Math.random() > 0.5 ? 'positivo' : 'negativo';
    const volume = Math.random() > 0.5 ? 'alto' : 'normal';
    const emaAlignment = Math.random() > 0.5 ? 'alinhadas para alta' : 'alinhadas para baixa';
    
    const analysisDetails = `RSI: ${rsi}, MACD: ${macdSignal}, Volume: ${volume}, EMAs: ${emaAlignment}. `;
    const confluenceCount = [rsi, macdSignal === 'positivo', volume === 'alto'].filter(Boolean).length;
    
    return {
      direction: randomDirection,
      confidence: confidenceLevel,
      price: "$114,996.09",
      sentiment: randomDirection === 'COMPRA' ? 'Bullish' : randomDirection === 'VENDA' ? 'Bearish' : 'Neutro',
      analysis: `${analysisDetails}Confluência: ${confluenceCount}/3 indicadores alinhados. ${randomDirection === 'AGUARDAR' ? 'Aguardando melhor setup.' : `Sinal ${randomDirection.toLowerCase()} identificado.`}`,
      reasoning: `Análise específica para Ebinex Binary Options: ${confluenceCount >= 2 ? 'Setup válido com' : 'Setup fraco com apenas'} ${confluenceCount} indicadores convergentes. ${randomDirection !== 'AGUARDAR' ? 'Entrada na próxima vela de 5min.' : 'Aguardando confluência de 70%+.'}`,
      entry: "Próxima vela 5m",
      stopLoss: "N/A (Binary Option)",
      takeProfit: "N/A (Binary Option)"
    };
  };

  // Função para buscar dados reais do Bitcoin com análise multi-timeframe melhorada
  const fetchRealBitcoinData = async () => {
    try {
      console.log('🔍 Buscando dados reais do Bitcoin (Multi-Timeframe Melhorado)...');
      
      // Buscar dados atuais do Bitcoin com timeout
      const priceResponse = await Promise.race([
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na API do preço')), 10000))
      ]) as Response;
      
      if (!priceResponse.ok) {
        throw new Error(`Erro na API de preço: ${priceResponse.status}`);
      }
      
      const priceData = await priceResponse.json();
      console.log('✅ Dados de preço obtidos:', priceData.lastPrice);
      
      // Buscar dados históricos para indicadores técnicos (1 HORA) com timeout
      const kline1hResponse = await Promise.race([
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na API 1H')), 10000))
      ]) as Response;
      
      if (!kline1hResponse.ok) {
        throw new Error(`Erro na API 1H: ${kline1hResponse.status}`);
      }
      
      const kline1hData = await kline1hResponse.json();
      console.log('📊 Dados 1H obtidos:', kline1hData.length, 'velas');
      
      // Buscar dados de 5 minutos com timeout
      const kline5mResponse = await Promise.race([
        fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=200'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na API 5M')), 10000))
      ]) as Response;
      
      if (!kline5mResponse.ok) {
        throw new Error(`Erro na API 5M: ${kline5mResponse.status}`);
      }
      
      const kline5mData = await kline5mResponse.json();
      console.log('📊 Dados 5M obtidos:', kline5mData.length, 'velas');
      
      // Validar dados recebidos
      if (!Array.isArray(kline1hData) || kline1hData.length < 50) {
        throw new Error('Dados insuficientes do timeframe 1H');
      }
      
      if (!Array.isArray(kline5mData) || kline5mData.length < 50) {
        throw new Error('Dados insuficientes do timeframe 5M');
      }
      
      if (!priceData.lastPrice || isNaN(parseFloat(priceData.lastPrice))) {
        throw new Error('Preço atual inválido');
      }
      
      // Processar dados para indicadores técnicos (1H)
      const closes1h = kline1hData.map((k: any) => parseFloat(k[4])).filter(v => !isNaN(v));
      const volumes1h = kline1hData.map((k: any) => parseFloat(k[5])).filter(v => !isNaN(v));
      const highs1h = kline1hData.map((k: any) => parseFloat(k[2])).filter(v => !isNaN(v));
      const lows1h = kline1hData.map((k: any) => parseFloat(k[3])).filter(v => !isNaN(v));
      
      // Processar dados para indicadores técnicos (5M)
      const closes5m = kline5mData.map((k: any) => parseFloat(k[4])).filter(v => !isNaN(v));
      const volumes5m = kline5mData.map((k: any) => parseFloat(k[5])).filter(v => !isNaN(v));
      const highs5m = kline5mData.map((k: any) => parseFloat(k[2])).filter(v => !isNaN(v));
      const lows5m = kline5mData.map((k: any) => parseFloat(k[3])).filter(v => !isNaN(v));
      
      // Verificar se temos dados suficientes após filtrar
      if (closes1h.length < 50 || closes5m.length < 50) {
        throw new Error('Dados filtrados insuficientes para análise');
      }
      
      // Calcular RSI para ambos os timeframes
      const rsi1h = calculateRSI(closes1h, 14);
      const rsi5m = calculateRSI(closes5m, 14);
      const currentRSI1h = rsi1h[rsi1h.length - 1];
      const currentRSI5m = rsi5m[rsi5m.length - 1];
      console.log('📊 RSI 1H calculado:', currentRSI1h);
      console.log('📊 RSI 5M calculado:', currentRSI5m);
      
      // Calcular Stochastic RSI para ambos os timeframes
      const stochRSI1h = calculateStochRSI(rsi1h);
      const stochRSI5m = calculateStochRSI(rsi5m);
      console.log('📊 Stoch RSI 1H:', stochRSI1h);
      console.log('📊 Stoch RSI 5M:', stochRSI5m);
      
      // Calcular MACD para ambos os timeframes
      const macd1h = calculateMACD(closes1h, 12, 26, 9);
      const macd5m = calculateMACD(closes5m, 12, 26, 9);
      const currentMACD1h = macd1h.macd[macd1h.macd.length - 1];
      const currentSignal1h = macd1h.signal[macd1h.signal.length - 1];
      const currentMACD5m = macd5m.macd[macd5m.macd.length - 1];
      const currentSignal5m = macd5m.signal[macd5m.signal.length - 1];
      console.log('📊 MACD 1H calculado:', currentMACD1h, 'Signal:', currentSignal1h);
      console.log('📊 MACD 5M calculado:', currentMACD5m, 'Signal:', currentSignal5m);
      
      // Calcular EMAs para ambos os timeframes
      const ema9_1h = calculateEMA(closes1h, 9);
      const ema21_1h = calculateEMA(closes1h, 21);
      const ema50_1h = calculateEMA(closes1h, 50);
      const ema200_1h = calculateEMA(closes1h, 200);
      
      const ema9_5m = calculateEMA(closes5m, 9);
      const ema21_5m = calculateEMA(closes5m, 21);
      const ema50_5m = calculateEMA(closes5m, 50);
      
      // Calcular ATR para volatilidade
      const atr = calculateATR(highs5m, lows5m, closes5m);
      console.log('📊 ATR calculado:', atr);
      
      // Detectar padrões de candlestick
      const candleData: CandleData[] = kline5mData.slice(-5).map((k: any) => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      const patterns = detectCandlePatterns(candleData);
      console.log('📊 Padrões detectados:', patterns);
      
      // Dados atuais
      const currentPrice = parseFloat(priceData.lastPrice);
      const priceChange24h = parseFloat(priceData.priceChangePercent);
      const volume24h = parseFloat(priceData.volume);
      
      // Preparar dados para análise de confluência
      const signalData: SignalData = {
        rsi1h: currentRSI1h,
        rsi5m: currentRSI5m,
        stochRSI1h: stochRSI1h,
        stochRSI5m: stochRSI5m,
        macd1h: { ...macd1h, histogram: macd1h.macd.map((m, i) => m - (macd1h.signal[i] || 0)) },
        macd5m: { ...macd5m, histogram: macd5m.macd.map((m, i) => m - (macd5m.signal[i] || 0)) },
        ema1h: {
          ema9: ema9_1h[ema9_1h.length - 1],
          ema21: ema21_1h[ema21_1h.length - 1],
          ema50: ema50_1h[ema50_1h.length - 1],
          ema200: ema200_1h[ema200_1h.length - 1],
          aligned: ema9_1h[ema9_1h.length - 1] > ema21_1h[ema21_1h.length - 1] && 
                   ema21_1h[ema21_1h.length - 1] > ema50_1h[ema50_1h.length - 1]
        },
        ema5m: {
          ema9: ema9_5m[ema9_5m.length - 1],
          ema21: ema21_5m[ema21_5m.length - 1],
          ema50: ema50_5m[ema50_5m.length - 1],
          aligned: ema9_5m[ema9_5m.length - 1] > ema21_5m[ema21_5m.length - 1] && 
                   ema21_5m[ema21_5m.length - 1] > ema50_5m[ema50_5m.length - 1]
        },
        volume: {
          current: volume24h,
          average: volumes5m.reduce((a, b) => a + b, 0) / volumes5m.length,
          above_average: volume24h > volumes5m.reduce((a, b) => a + b, 0) / volumes5m.length
        },
        atr: atr,
        patterns: patterns,
        currentPrice: currentPrice
      };
      
      // Calcular confluências
      const confluence = calculateWeightedConfluence(signalData);
      console.log('📊 Confluências calculadas:', confluence);

      return {
        currentPrice,
        priceChange24h,
        volume24h,
        // Dados 1H
        rsi1h: currentRSI1h,
        stochRSI1h: stochRSI1h,
        macd1h: currentMACD1h,
        macdSignal1h: currentSignal1h,
        ema9_1h: ema9_1h[ema9_1h.length - 1],
        ema21_1h: ema21_1h[ema21_1h.length - 1],
        ema50_1h: ema50_1h[ema50_1h.length - 1],
        ema200_1h: ema200_1h[ema200_1h.length - 1],
        highs1h: highs1h.slice(-20),
        lows1h: lows1h.slice(-20),
        closes1h: closes1h.slice(-20),
        volumes1h: volumes1h.slice(-20),
        // Dados 5M
        rsi5m: currentRSI5m,
        stochRSI5m: stochRSI5m,
        macd5m: currentMACD5m,
        macdSignal5m: currentSignal5m,
        ema9_5m: ema9_5m[ema9_5m.length - 1],
        ema21_5m: ema21_5m[ema21_5m.length - 1],
        ema50_5m: ema50_5m[ema50_5m.length - 1],
        highs5m: highs5m.slice(-20),
        lows5m: lows5m.slice(-20),
        closes5m: closes5m.slice(-20),
        volumes5m: volumes5m.slice(-20),
        // Novas funcionalidades
        atr: atr,
        patterns: patterns,
        confluence: confluence,
        signalData: signalData,
        // Dados combinados para compatibilidade
        rsi: currentRSI5m, // Usar 5M como principal
        macd: currentMACD5m,
        macdSignal: currentSignal5m,
        ema9: ema9_5m[ema9_5m.length - 1],
        ema21: ema21_5m[ema21_5m.length - 1],
        ema50: ema50_5m[ema50_5m.length - 1],
        ema200: ema200_1h[ema200_1h.length - 1], // Usar 1H para EMA 200
        highs: highs5m.slice(-20),
        lows: lows5m.slice(-20),
        closes: closes5m.slice(-20),
        volumes: volumes5m.slice(-20),
        kline5m: kline5mData.slice(-20)
      };
    } catch (error) {
      console.error('❌ Erro detalhado ao buscar dados reais:', error);
      
      // Log mais específico do erro
      if (error instanceof Error) {
        console.error('Mensagem do erro:', error.message);
        console.error('Stack trace:', error.stack);
      }
      
      // Tentar novamente uma vez em caso de erro de rede
      if (error instanceof Error && error.message.includes('Timeout')) {
        console.log('🔄 Tentando novamente devido a timeout...');
        try {
          // Segunda tentativa com timeout menor
          const retryResponse = await Promise.race([
            fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Segundo timeout')), 5000))
          ]) as Response;
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            console.log('✅ Segunda tentativa bem-sucedida');
            
            // Retornar dados básicos se conseguir pelo menos o preço
            return {
              currentPrice: parseFloat(retryData.lastPrice),
              priceChange24h: parseFloat(retryData.priceChangePercent || '0'),
              volume24h: parseFloat(retryData.volume || '0'),
              // Dados básicos para evitar erros
              rsi1h: 50, rsi5m: 50,
              stochRSI1h: { K: [50], D: [50], crossover: false, oversold: false, overbought: false },
              stochRSI5m: { K: [50], D: [50], crossover: false, oversold: false, overbought: false },
              macd1h: { macd: [0], signal: [0], histogram: [0] },
              macd5m: { macd: [0], signal: [0], histogram: [0] },
              atr: { value: 100, percentage: 0.1, level: 'MÉDIO' as const },
              patterns: [],
              confluence: { score: 8, maxScore: 18, percentage: 44, confidence: 'BAIXO' as const, details: {}, signalStrength: 'FRACO' as const },
              signalData: {} as any,
              // Dados mínimos para compatibilidade
              rsi: 50, macd: 0, macdSignal: 0,
              ema9: retryData.lastPrice, ema21: retryData.lastPrice, ema50: retryData.lastPrice, ema200: retryData.lastPrice,
              highs: [retryData.lastPrice], lows: [retryData.lastPrice], closes: [retryData.lastPrice], volumes: [100]
            };
          }
        } catch (retryError) {
          console.error('❌ Segunda tentativa falhou:', retryError);
        }
      }
      
      return null;
    }
  };

  // Função para calcular RSI
  const calculateRSI = (prices: number[], period: number) => {
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGains: number[] = [];
    const avgLosses: number[] = [];
    
    // Primeira média
    avgGains[period - 1] = gains.slice(0, period).reduce((a, b) => a + b) / period;
    avgLosses[period - 1] = losses.slice(0, period).reduce((a, b) => a + b) / period;
    
    // Médias suavizadas
    for (let i = period; i < gains.length; i++) {
      avgGains[i] = (avgGains[i - 1] * (period - 1) + gains[i]) / period;
      avgLosses[i] = (avgLosses[i - 1] * (period - 1) + losses[i]) / period;
    }
    
    const rsi: number[] = [];
    for (let i = period - 1; i < avgGains.length; i++) {
      const rs = avgLosses[i] === 0 ? 100 : avgGains[i] / avgLosses[i];
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  };

  // Função para calcular MACD
  const calculateMACD = (prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    
    const macd: number[] = [];
    for (let i = slowPeriod - 1; i < prices.length; i++) {
      macd.push(emaFast[i] - emaSlow[i]);
    }
    
    const signal = calculateEMA(macd, signalPeriod);
    
    return { macd, signal };
  };

  // Função para calcular EMA
  const calculateEMA = (prices: number[], period: number) => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Primeira EMA é SMA
    ema[period - 1] = prices.slice(0, period).reduce((a, b) => a + b) / period;
    
    // EMAs subsequentes
    for (let i = period; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  };

  // Função para gerar análise baseada em dados reais
  // Função para executar backtesting
  const runBacktestAnalysis = async () => {
    setIsBacktesting(true);
    setBacktestResult(null);
    
    try {
      // Buscar dados históricos para backtesting
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000');
      const data = await response.json();
      
      const historicalData: CandleData[] = data.map((k: any) => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      
      const strategy = createBacktestStrategy();
      const result = runBacktest(historicalData, strategy, 1000, 0.02, 70);
      
      setBacktestResult(result);
      
      toast({
        title: "Backtesting concluído!",
        description: `${result.totalTrades} trades simulados. Taxa de acerto: ${result.winRate.toFixed(1)}%`,
      });
    } catch (error) {
      console.error('Erro no backtesting:', error);
      toast({
        title: "Erro no backtesting",
        description: "Não foi possível executar o backtesting.",
        variant: "destructive"
      });
    } finally {
      setIsBacktesting(false);
    }
  };

  const generateRealAnalysis = (realData: any): AnalysisResult => {
    console.log('🎯 Gerando análise melhorada com dados reais:', {
      price: realData?.currentPrice,
      confluence: realData?.confluence,
      atr: realData?.atr,
      patterns: realData?.patterns
    });
    
    // Verificações de segurança
    if (!realData || !realData.currentPrice) {
      console.warn('⚠️ Dados insuficientes, usando valores padrão');
      return generateDemoAnalysis();
    }
    
    // Usar os dados da confluência calculada com valores padrão
    const confluence = realData.confluence || { 
      score: 8, 
      maxScore: 18, 
      percentage: 44, 
      confidence: 'BAIXO', 
      details: {}, 
      signalStrength: 'FRACO' 
    };
    const atr = realData.atr || { value: 100, percentage: 0.1, level: 'MÉDIO' };
    const patterns = realData.patterns || [];
    const stochRSI5m = realData.stochRSI5m || { 
      K: [50], 
      D: [50], 
      crossover: false, 
      oversold: false, 
      overbought: false 
    };
    const currentPrice = realData.currentPrice;
    const tradingSession = getTradingSession();
    
    // Determinar direção baseada na confluência melhorada
    let direction = 'AGUARDAR';
    let confidence = confluence.percentage;
    let riskLevel = 'MÉDIO';
    let expiration = '5min';
    
    // Ajustar confiança baseada na volatilidade
    if (atr.level === 'ALTO') {
      confidence *= 0.85; // Reduzir confiança em 15% em alta volatilidade
      riskLevel = 'ALTO';
    } else if (atr.level === 'BAIXO') {
      confidence *= 1.1; // Aumentar confiança em 10% em baixa volatilidade
      riskLevel = 'BAIXO';
    }
    
    // Ajustar baseado na sessão de trading
    if (tradingSession.quality === 'EVITAR' || tradingSession.quality === 'FIM DE SEMANA') {
      confidence *= 0.7; // Reduzir significativamente
      riskLevel = 'ALTO';
    } else if (tradingSession.quality === 'EXCELENTE') {
      confidence *= 1.15; // Aumentar confiança
    }
    
    // Determinar direção final
    if (confidence >= 75) {
      // Análise mais sofisticada para determinar direção
      const bullishIndicators = [
        realData.rsi5m < 70 && realData.rsi5m > 30,
        stochRSI5m.oversold || (stochRSI5m.crossover && stochRSI5m.K[stochRSI5m.K.length - 1] < 80),
        realData.macd5m > realData.macdSignal5m,
        realData.ema5m.aligned && realData.currentPrice > realData.ema9_5m,
        patterns.some(p => p.signal === 'BULLISH'),
        realData.volume.above_average
      ];
      
      const bearishIndicators = [
        realData.rsi5m < 70 && realData.rsi5m > 30,
        stochRSI5m.overbought || (stochRSI5m.crossover && stochRSI5m.K[stochRSI5m.K.length - 1] > 20),
        realData.macd5m < realData.macdSignal5m,
        !realData.ema5m.aligned && realData.currentPrice < realData.ema9_5m,
        patterns.some(p => p.signal === 'BEARISH'),
        realData.volume.above_average
      ];
      
      const bullishCount = bullishIndicators.filter(Boolean).length;
      const bearishCount = bearishIndicators.filter(Boolean).length;
      
      if (bullishCount > bearishCount && bullishCount >= 4) {
        direction = 'COMPRA';
        // Tocar alerta sonoro
        alertSystem.notifySignal('COMPRA');
      } else if (bearishCount > bullishCount && bearishCount >= 4) {
        direction = 'VENDA';
        // Tocar alerta sonoro
        alertSystem.notifySignal('VENDA');
      }
      
      // Determinar expiração baseada na força do sinal
      if (confidence >= 90) {
        expiration = '15min';
      } else if (confidence >= 85) {
        expiration = '10min';
      }
    }
    
    // Garantir que confiança não exceda 100%
    confidence = Math.min(100, Math.max(0, confidence));
    
    // Se confiança < 75%, forçar AGUARDAR
    if (confidence < 75) {
      direction = 'AGUARDAR';
    }
    
    const sentiment = direction === 'COMPRA' ? 'Bullish' : direction === 'VENDA' ? 'Bearish' : 'Neutro';
    
    return {
      direction,
      confidence: Math.round(confidence),
      price: `$${currentPrice.toFixed(2)}`,
      sentiment,
      analysis: `Análise Multi-Timeframe Melhorada: Confluência ${confluence.score.toFixed(1)}/${confluence.maxScore} (${confluence.percentage.toFixed(1)}%). ATR: ${atr.level} (${atr.percentage.toFixed(2)}%). Padrões: ${patterns.map(p => p.name).join(', ') || 'Nenhum'}. Sessão: ${tradingSession.quality}. ${direction === 'AGUARDAR' ? 'Aguardando melhor confluência.' : `Sinal ${direction.toLowerCase()} identificado com força ${confluence.signalStrength}.`}`,
      reasoning: `Análise técnica avançada: ${Object.entries(confluence.details).map(([key, detail]: [string, any]) => detail.description).join(', ')}. Volatilidade ${atr.level} ajustou confiança. ${tradingSession.quality !== 'REGULAR' ? `Horário de trading: ${tradingSession.recommendation}.` : ''} ${direction !== 'AGUARDAR' ? 'Entrada na próxima vela de 5min.' : 'Aguardando confluência de 75%+.'}`,
      entry: "Próxima vela 5m",
      stopLoss: "N/A (Binary Option)",
      takeProfit: "N/A (Binary Option)",
      confluences: Math.round(confluence.score),
      riskLevel: riskLevel,
      expiration: expiration,
      timeframe: "1h + 5min",
      stochRSI: {
        K: stochRSI5m.K[stochRSI5m.K.length - 1] || 50,
        D: stochRSI5m.D[stochRSI5m.D.length - 1] || 50,
        signal: stochRSI5m.oversold ? 'Sobrevendido' : stochRSI5m.overbought ? 'Sobrecomprado' : stochRSI5m.crossover ? 'Cruzamento' : 'Neutro'
      },
      atr: atr,
      patterns: patterns.map(p => p.name),
      tradingSession: tradingSession,
      confluenceDetails: confluence.details,
      detailedReasons: [
        `RSI 1H: ${realData.rsi1h.toFixed(2)} - ${realData.rsi1h > 70 ? 'Sobrecomprado' : realData.rsi1h < 30 ? 'Sobrevendido' : 'Neutro'}`,
        `RSI 5M: ${realData.rsi5m.toFixed(2)} - ${realData.rsi5m > 70 ? 'Sobrecomprado' : realData.rsi5m < 30 ? 'Sobrevendido' : 'Neutro'}`,
        `Stoch RSI 5M: ${stochRSI5m.oversold ? 'Sobrevendido' : stochRSI5m.overbought ? 'Sobrecomprado' : 'Normal'}`,
        `MACD 1H: ${realData.macd1h > realData.macdSignal1h ? 'Bullish' : 'Bearish'}`,
        `MACD 5M: ${realData.macd5m > realData.macdSignal5m ? 'Bullish' : 'Bearish'}`,
        `EMAs 1H: ${realData.ema1h.aligned ? 'Alinhadas para Alta' : 'Mistas'}`,
        `EMAs 5M: ${realData.ema5m.aligned ? 'Alinhadas para Alta' : 'Mistas'}`,
        `ATR: ${atr.level} - Volatilidade ${atr.percentage.toFixed(2)}%`,
        `Volume: ${realData.volume.above_average ? 'Acima da média' : 'Normal'}`,
        `Padrões: ${patterns.length > 0 ? patterns.map(p => p.name).join(', ') : 'Nenhum padrão detectado'}`,
        `Horário: ${tradingSession.quality} - ${tradingSession.recommendation}`
      ]
    };
  };


  return (
    <Card className="p-4 bg-card h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Ebinex Binary Options</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span className="text-sm text-muted-foreground">Bitcoin 5m • Entrada na próxima vela</span>
            </div>
          </div>
        </div>

        {/* Modelo GPT OSS 120B Fixo */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Modelo de IA</Label>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-semibold text-white">{selectedModelInfo.name}</div>
                    <div className="text-sm text-blue-300">{selectedModelInfo.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">{selectedModelInfo.speed}</span>
                  <span className="text-yellow-400">{selectedModelInfo.quality}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Current Price e Timer - Dados Reais */}
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">
              {analysisResult?.price || '$114,996.09'}
            </div>
            <div className="text-xs text-muted-foreground">
              📊 Dados em tempo real via Binance API
            </div>
          </div>
          
          {/* Timer para próxima vela */}
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-lg p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Próxima Vela 5M</span>
              </div>
              <div className={`text-lg font-bold ${nextCandleTimer.alert30s ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
                {String(nextCandleTimer.minutes).padStart(2, '0')}:{String(nextCandleTimer.seconds).padStart(2, '0')}
              </div>
            </div>
            {nextCandleTimer.alert30s && (
              <div className="text-xs text-red-300 mt-1 text-center animate-pulse">
                ⚠️ Entrada em {nextCandleTimer.totalSeconds}s
              </div>
            )}
            <div className="text-xs text-blue-200 mt-1 text-center">
              🎯 Sincronizado com Ebinex (-31s)
            </div>
          </div>
          
          {/* Sessão de Trading */}
          <div className={`border rounded-lg p-3 backdrop-blur-sm ${
            tradingSession.quality === 'EXCELENTE' ? 'bg-green-900/30 border-green-700/30' :
            tradingSession.quality === 'BOM' ? 'bg-blue-900/30 border-blue-700/30' :
            tradingSession.quality === 'EVITAR' ? 'bg-red-900/30 border-red-700/30' :
            'bg-gray-900/30 border-gray-700/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Sessão de Trading</span>
              </div>
              <Badge variant={
                tradingSession.quality === 'EXCELENTE' ? 'default' :
                tradingSession.quality === 'BOM' ? 'secondary' :
                tradingSession.quality === 'EVITAR' ? 'destructive' : 'outline'
              }>
                {tradingSession.quality}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {tradingSession.recommendation}
            </div>
          </div>
        </div>

        {/* Analysis Status */}
        <div className="space-y-3">
          {isAnalyzing ? (
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-sm font-medium text-success mb-2">
                  ● ● ● Analisando indicadores técnicos...
                </div>
                <div className="text-xs text-muted-foreground">
                  {analysisSteps[currentStep]}
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                {analysisSteps.map((step, index) => (
                  <div key={index} className={`flex items-center gap-2 ${
                    index <= currentStep ? 'text-success' : 'text-muted-foreground'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>• {step}</span>
                  </div>
                ))}
              </div>
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={stopAnalysis}
              >
                🛑 Parar Análise
              </Button>
            </div>
          ) : analysisResult ? (
            <div className="space-y-4">
              {/* Analysis Result */}
              <div className="text-center space-y-2">
                <Badge variant={
                  analysisResult.direction === 'COMPRA' ? 'default' : 
                  analysisResult.direction === 'VENDA' ? 'destructive' : 'secondary'
                } className="text-lg px-4 py-2">
                  {analysisResult.direction}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Confiança: {analysisResult.confidence}% • {analysisResult.sentiment}
                </div>
              </div>

              {/* Trading Points */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada:</span>
                  <span className="text-foreground font-medium">{analysisResult.entry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expiração:</span>
                  <span className="text-warning font-medium">{analysisResult.expiration || '5min'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="text-info font-medium">Binary Option</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assertividade:</span>
                  <span className={`font-bold ${analysisResult.confidence >= 80 ? 'text-success' : analysisResult.confidence >= 70 ? 'text-warning' : 'text-danger'}`}>
                    {analysisResult.confidence}%
                  </span>
                </div>
                {analysisResult.confluences && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confluências:</span>
                    <span className={`font-bold ${analysisResult.confluences >= 12 ? 'text-success' : analysisResult.confluences >= 8 ? 'text-warning' : 'text-danger'}`}>
                      {analysisResult.confluences}/18
                    </span>
                  </div>
                )}
                {analysisResult.riskLevel && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risco:</span>
                    <span className={`font-bold ${
                      analysisResult.riskLevel === 'BAIXO' ? 'text-success' : 
                      analysisResult.riskLevel === 'MÉDIO' ? 'text-warning' : 'text-danger'
                    }`}>
                      {analysisResult.riskLevel}
                    </span>
                  </div>
                )}
                {analysisResult.stochRSI && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stoch RSI:</span>
                    <span className={`font-medium ${
                      analysisResult.stochRSI.signal === 'Sobrevendido' ? 'text-green-400' :
                      analysisResult.stochRSI.signal === 'Sobrecomprado' ? 'text-red-400' :
                      analysisResult.stochRSI.signal === 'Cruzamento' ? 'text-blue-400' : 'text-gray-400'
                    }`}>
                      {analysisResult.stochRSI.signal}
                    </span>
                  </div>
                )}
                {analysisResult.atr && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volatilidade:</span>
                    <span className={`font-medium ${
                      analysisResult.atr.level === 'BAIXO' ? 'text-green-400' :
                      analysisResult.atr.level === 'MÉDIO' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {analysisResult.atr.level} ({analysisResult.atr.percentage.toFixed(2)}%)
                    </span>
                  </div>
                )}
              </div>
              
              {/* Padrões de Candlestick */}
              {analysisResult.patterns && analysisResult.patterns.length > 0 && (
                <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-700/30 rounded p-2">
                  <div className="text-sm font-medium text-purple-300 mb-1">📊 Padrões Detectados:</div>
                  <div className="flex flex-wrap gap-1">
                    {analysisResult.patterns.map((pattern, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-purple-500/50 text-purple-300">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis Summary */}
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                <div className="font-medium mb-1">Análise:</div>
                <div>{analysisResult.analysis}</div>
              </div>

              {/* Ebinex Warning */}
              {analysisResult.direction !== 'AGUARDAR' && (
                <div className="bg-warning/10 border border-warning/20 p-3 rounded text-xs">
                  <div className="text-warning font-medium mb-1">⚠️ IMPORTANTE - Regras Ebinex:</div>
                  <div className="text-muted-foreground">
                    • Entrada só acontece na PRÓXIMA vela de 5min<br/>
                    • Resultado é binário: ganha tudo ou perde tudo<br/>
                    • Sem stop loss - aguarde os 5 minutos
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleAnalysis}
              >
                🔄 Nova Análise
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-muted-foreground text-sm">
                Bitcoin 5m • Ebinex Binary Options • Min. 70% confiança
              </div>
              <Button 
                className="w-full bg-primary hover:bg-primary/90" 
                onClick={handleAnalysis}
              >
                📊 Analisar BTC/USDT (GPT OSS 120B)
              </Button>
            </div>
          )}
        </div>

        {/* Botões Glass - Funcionalidades Melhoradas */}
        <div className="space-y-3">
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => alertSystem.notifySignal('ALERTA')}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-md shadow-lg"
            >
              <Volume2 className="h-3 w-3 mr-1" />
              🔔 Teste Alerta
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowBacktest(!showBacktest)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-md shadow-lg"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              📊 Backtest
            </Button>
          </div>
          
          {/* Botão de Backtesting */}
          {showBacktest && (
            <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-700/30 rounded-lg p-3 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm font-medium text-indigo-300 mb-2">Sistema de Backtesting</div>
                  <Button 
                    onClick={runBacktestAnalysis}
                    disabled={isBacktesting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isBacktesting ? '⏳ Executando...' : '🚀 Executar Backtest (1000 velas)'}
                  </Button>
                </div>
                
                {backtestResult && (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-indigo-300">Total Trades</div>
                        <div className="font-bold text-white">{backtestResult.totalTrades}</div>
                      </div>
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-indigo-300">Taxa de Acerto</div>
                        <div className={`font-bold ${backtestResult.winRate >= 60 ? 'text-green-400' : 'text-red-400'}`}>
                          {backtestResult.winRate.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-indigo-300">ROI</div>
                        <div className={`font-bold ${backtestResult.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {backtestResult.roi.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-indigo-300">Profit Factor</div>
                        <div className={`font-bold ${backtestResult.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                          {backtestResult.profitFactor.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-indigo-200">
                      Saldo Final: ${backtestResult.finalBalance.toFixed(2)} | 
                      Max Drawdown: {backtestResult.maxDrawdownPercentage.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </Card>
  );
}

// Componente separado para o Log de Análises
export function AnalysisLogs() {
  const [analysisLogs, setAnalysisLogs] = useState<AnalysisLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Função para carregar logs salvos
  const loadAnalysisLogs = () => {
    try {
      const savedLogs = JSON.parse(localStorage.getItem('bitcoin-analysis-logs') || '[]');
      setAnalysisLogs(savedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  // Função para marcar resultado do log
  const markLogResult = (logId: string, result: 'win' | 'loss') => {
    setAnalysisLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, result } : log
    ));
    
    // Salvar no localStorage
    try {
      const updatedLogs = analysisLogs.map(log => 
        log.id === logId ? { ...log, result } : log
      );
      localStorage.setItem('bitcoin-analysis-logs', JSON.stringify(updatedLogs));
    } catch (error) {
      console.error('Erro ao salvar resultado do log:', error);
    }
  };

  // Função para baixar logs selecionadas
  const downloadSelectedLogs = () => {
    const selectedLogs = analysisLogs.filter(log => log.result === 'win' || log.result === 'loss');
    
    if (selectedLogs.length === 0) {
      toast({
        title: "Nenhuma log selecionada",
        description: "Marque algumas análises como WIN ou LOSS antes de baixar.",
        variant: "destructive"
      });
      return;
    }

    const dataToExport = {
      logs: selectedLogs,
      exportDate: new Date().toISOString(),
      totalLogs: selectedLogs.length,
      wins: selectedLogs.filter(log => log.result === 'win').length,
      losses: selectedLogs.filter(log => log.result === 'loss').length,
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitcoin-analysis-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Logs baixadas com sucesso!",
      description: `${selectedLogs.length} análises exportadas.`,
    });
  };

  // Carregar logs ao montar o componente
  useEffect(() => {
    loadAnalysisLogs();
  }, []);

  return (
    <Card className="p-4 bg-card relative z-10">
      <div className="space-y-4">
        {/* Header do Log */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">📝 Log de Análises</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSelectedLogs}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-md shadow-lg"
            >
              <Download className="h-4 w-4 mr-1" />
              Baixar Selecionadas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              {showLogs ? "Ocultar Log" : "Ver Log"} ({analysisLogs.length})
            </Button>
          </div>
        </div>

        {showLogs && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {analysisLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Nenhuma análise registrada ainda
              </div>
            ) : (
              analysisLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-2 bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.direction === "COMPRA" ? "default" : log.direction === "VENDA" ? "destructive" : "secondary"}>
                        {log.direction}
                      </Badge>
                      <span className="text-sm font-medium">{log.price}</span>
                      <Badge variant="outline">{log.confidence}%</Badge>
                      {log.result && (
                        <Badge variant={log.result === 'win' ? 'default' : 'destructive'}>
                          {log.result === 'win' ? 'WIN' : 'LOSS'}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.timestamp}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 text-xs mb-1">
                    <div><strong>Expiração:</strong> {log.expiration}</div>
                    <div><strong>Timeframe:</strong> {log.timeframe}</div>
                    <div><strong>Confluências:</strong> {log.confluences}/15</div>
                    <div><strong>Risco:</strong> {log.riskLevel}</div>
                    <div><strong>RSI 1H:</strong> {log.rsi.toFixed(2)}</div>
                    <div><strong>RSI 5M:</strong> {log.rsi.toFixed(2)}</div>
                    <div><strong>MACD 1H:</strong> {log.macd.toFixed(4)}</div>
                    <div><strong>MACD 5M:</strong> {log.macd.toFixed(4)}</div>
                  </div>

                  <div className="text-xs">
                    <strong>Motivos:</strong>
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      {log.reasons.map((reason, index) => (
                        <li key={index} className="text-muted-foreground">{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-muted-foreground">
                      {log.provider} {log.model && `• ${log.model}`}
                    </div>
                    {!log.result && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50 text-xs px-2 py-1"
                          onClick={() => markLogResult(log.id, 'win')}
                        >
                          WIN
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50 text-xs px-2 py-1"
                          onClick={() => markLogResult(log.id, 'loss')}
                        >
                          LOSS
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
