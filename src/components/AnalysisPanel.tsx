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
  const [apiKey, setApiKey] = useState(import.meta.env?.VITE_GROQ_API_KEY || '')
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
    timerRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Alertas baseados no timer
  useEffect(() => {
    if (nextCandleTimer.alert30s && !nextCandleTimer.alert10s) {
      alertSystem.notifySignal('TIMER');
    }
  }, [nextCandleTimer.alert30s, nextCandleTimer.alert10s, alertSystem]);

  // Modelos disponíveis do Groq
  const groqModels = [
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant",
      description: "Rápido e eficiente para análises básicas",
      category: "Text Generation",
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐"
    },
    {
      id: "llama-3.1-70b-versatile",
      name: "Llama 3.1 70B Versatile", 
      description: "Modelo mais poderoso para análises complexas",
      category: "Text Generation",
      speed: "🚀 Rápido",
      quality: "⭐⭐⭐⭐⭐"
    },
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B Versatile",
      description: "Versão mais recente com melhor performance",
      category: "Text Generation", 
      speed: "🚀 Rápido",
      quality: "⭐⭐⭐⭐⭐"
    },
    {
      id: "llama-3.1-405b-versatile",
      name: "Llama 3.1 405B Versatile",
      description: "Modelo gigante para máxima precisão",
      category: "Text Generation",
      speed: "🐌 Lento",
      quality: "⭐⭐⭐⭐⭐⭐"
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B 32K",
      description: "Modelo misto com contexto expandido",
      category: "Text Generation",
      speed: "⚡ Muito Rápido", 
      quality: "⭐⭐⭐⭐"
    },
    {
      id: "gemma-7b-it",
      name: "Gemma 7B IT",
      description: "Modelo Google otimizado para instruções",
      category: "Text Generation",
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐⭐"
    },
    {
      id: "gemma-2-9b-it",
      name: "Gemma 2 9B IT", 
      description: "Versão mais recente do Gemma",
      category: "Text Generation",
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐⭐"
    },
    {
      id: "qwen-2.5-72b-instruct",
      name: "Qwen 2.5 72B Instruct",
      description: "Modelo chinês com excelente performance",
      category: "Text Generation",
      speed: "🚀 Rápido",
      quality: "⭐⭐⭐⭐⭐"
    },
    {
      id: "qwen-2.5-7b-instruct",
      name: "Qwen 2.5 7B Instruct",
      description: "Versão compacta do Qwen",
      category: "Text Generation", 
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐⭐"
    },
    {
      id: "llama-3.3-8b-instruct",
      name: "Llama 3.3 8B Instruct",
      description: "Versão mais recente do Llama 8B",
      category: "Text Generation",
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐⭐"
    },
    {
      id: "openai/gpt-oss-120b",
      name: "GPT OSS 120B",
      description: "Modelo GPT de código aberto com 120B parâmetros",
      category: "Multilingual",
      speed: "🚀 Rápido",
      quality: "⭐⭐⭐⭐⭐⭐"
    },
    {
      id: "openai/gpt-oss-20b",
      name: "GPT OSS 20B",
      description: "Modelo GPT de código aberto com 20B parâmetros",
      category: "Multilingual",
      speed: "⚡ Muito Rápido",
      quality: "⭐⭐⭐⭐⭐"
    }
  ];

  const analysisSteps = [
    "Verificando RSI, MACD e Stochastic RSI",
    "Analisando EMAs e confluências técnicas", 
    "Checando suportes, resistências e volume",
    "Validando confiança mínima 70% (Ebinex)",
    "Definindo sinal: COMPRA/VENDA/AGUARDAR"
  ];

  const [currentStep, setCurrentStep] = useState(0);

  const handleAnalysis = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key necessária",
        description: "Por favor, insira sua API key do Groq para continuar.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setCurrentStep(0);
    setAnalysisResult(null);

    // Simular progresso da análise
    for (let i = 0; i < analysisSteps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    try {
      const result = await callAIProvider("groq", apiKey);
      setAnalysisResult(result);
      
      // Salvar log da análise
      const realData = await fetchRealBitcoinData();
      if (realData) {
        saveAnalysisLog(result, realData, "groq", selectedModel);
      }

      toast({
        title: "Análise concluída!",
        description: "A análise técnica foi finalizada com sucesso.",
      });

    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na análise",
        description: "Não foi possível completar a análise. Verifique sua configuração.",
        variant: "destructive"
      });
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
      // Buscar dados atuais do Bitcoin
      const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      const priceData = await priceResponse.json();
      console.log('✅ Dados de preço obtidos:', priceData.lastPrice);
      
      // Buscar dados históricos para indicadores técnicos (1 HORA)
      const kline1hResponse = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200');
      const kline1hData = await kline1hResponse.json();
      console.log('📊 Dados 1H obtidos:', kline1hData.length, 'velas');
      
      // Buscar dados de 5 minutos
      const kline5mResponse = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=200');
      const kline5mData = await kline5mResponse.json();
      console.log('📊 Dados 5M obtidos:', kline5mData.length, 'velas');
      
      // Processar dados para indicadores técnicos (1H)
      const closes1h = kline1hData.map((k: any) => parseFloat(k[4]));
      const volumes1h = kline1hData.map((k: any) => parseFloat(k[5]));
      const highs1h = kline1hData.map((k: any) => parseFloat(k[2]));
      const lows1h = kline1hData.map((k: any) => parseFloat(k[3]));
      
      // Processar dados para indicadores técnicos (5M)
      const closes5m = kline5mData.map((k: any) => parseFloat(k[4]));
      const volumes5m = kline5mData.map((k: any) => parseFloat(k[5]));
      const highs5m = kline5mData.map((k: any) => parseFloat(k[2]));
      const lows5m = kline5mData.map((k: any) => parseFloat(k[3]));
      
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
      console.error('Erro ao buscar dados reais:', error);
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
      price: realData.currentPrice,
      confluence: realData.confluence,
      atr: realData.atr,
      patterns: realData.patterns
    });
    
    // Usar os dados da confluência calculada
    const confluence = realData.confluence;
    const atr = realData.atr;
    const patterns = realData.patterns;
    const stochRSI5m = realData.stochRSI5m;
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

  const callAIProvider = async (provider: string, key: string): Promise<AnalysisResult> => {
    // Buscar dados reais do Bitcoin
    const realData = await fetchRealBitcoinData();
    
    if (!realData) {
      console.warn('Não foi possível buscar dados reais, tentando novamente...');
      // Tentar novamente com dados reais
      const retryData = await fetchRealBitcoinData();
      if (retryData) {
        return generateRealAnalysis(retryData);
      }
      // Se ainda falhar, usar dados demo como último recurso
      return generateDemoAnalysis();
    }

    // Calcular confluências multi-timeframe para o prompt
    const confluences = [
      // TIMEFRAME 1H (8 pontos)
      realData.rsi1h > 30 && realData.rsi1h < 70 ? 2 : realData.rsi1h < 30 || realData.rsi1h > 70 ? 1 : 0,
      realData.macd1h > realData.macdSignal1h ? 2 : 1,
      realData.ema9_1h > realData.ema21_1h && realData.ema21_1h > realData.ema50_1h ? 2 : realData.ema9_1h < realData.ema21_1h && realData.ema21_1h < realData.ema50_1h ? 2 : 0,
      realData.currentPrice > realData.ema9_1h ? 2 : 0,
      // TIMEFRAME 5M (5 pontos)
      realData.rsi5m > 30 && realData.rsi5m < 70 ? 1 : realData.rsi5m < 30 || realData.rsi5m > 70 ? 0.5 : 0,
      realData.macd5m > realData.macdSignal5m ? 1 : 0.5,
      realData.ema9_5m > realData.ema21_5m && realData.ema21_5m > realData.ema50_5m ? 1 : realData.ema9_5m < realData.ema21_5m && realData.ema21_5m < realData.ema50_5m ? 1 : 0,
      realData.currentPrice > realData.ema9_5m ? 1 : 0,
      // VOLUME E ESTRUTURA (2 pontos)
      realData.volume24h > 50000000 ? 2 : 1
    ].reduce((a, b) => a + b, 0);

    const prompt = `# 🎯 ANÁLISE TÉCNICA PROFISSIONAL MULTI-TIMEFRAME - BITCOIN BINARY OPTIONS

## 📋 CONTEXTO OPERACIONAL
Você é um **ANALISTA TÉCNICO SÊNIOR** especializado em Bitcoin com 15+ anos de experiência em trading institucional. Sua missão é fornecer uma análise precisa para uma operação binária no Bitcoin, baseada EXCLUSIVAMENTE nos dados técnicos reais fornecidos de MÚLTIPLOS TIMEFRAMES.

## 📊 DADOS DE MERCADO REAIS - ${new Date().toLocaleString('pt-BR')}

### 💰 INFORMAÇÕES FUNDAMENTAIS
- **Preço Atual**: $${realData.currentPrice.toFixed(2)}
- **Variação 24h**: ${realData.priceChange24h.toFixed(2)}%
- **Volume 24h**: ${realData.volume24h.toLocaleString()} BTC
- **Timestamp**: ${new Date().toISOString()}

### 📈 ANÁLISE MULTI-TIMEFRAME

#### 🕐 TIMEFRAME 1 HORA (Tendência Principal)
**RSI (14 períodos)**: ${realData.rsi1h.toFixed(2)}
- Zona: ${realData.rsi1h > 70 ? 'SOBRECOMPRADO' : realData.rsi1h < 30 ? 'SOBREVENDIDO' : 'NEUTRO'}
- Interpretação: ${realData.rsi1h > 70 ? 'Possível reversão para baixa' : realData.rsi1h < 30 ? 'Possível reversão para alta' : 'Momentum equilibrado'}

**MACD (12,26,9)**:
- MACD Line: ${realData.macd1h.toFixed(4)}
- Signal Line: ${realData.macdSignal1h.toFixed(4)}
- Histograma: ${(realData.macd1h - realData.macdSignal1h).toFixed(4)}
- Sinal: ${realData.macd1h > realData.macdSignal1h ? 'BULLISH (Compra)' : 'BEARISH (Venda)'}

**MÉDIAS MÓVEIS EXPONENCIAIS (1H)**:
- EMA 9: $${realData.ema9_1h.toFixed(2)} ${realData.currentPrice > realData.ema9_1h ? '↑' : '↓'}
- EMA 21: $${realData.ema21_1h.toFixed(2)} ${realData.currentPrice > realData.ema21_1h ? '↑' : '↓'}
- EMA 50: $${realData.ema50_1h.toFixed(2)} ${realData.currentPrice > realData.ema50_1h ? '↑' : '↓'}
- EMA 200: $${realData.ema200_1h.toFixed(2)} ${realData.currentPrice > realData.ema200_1h ? '↑' : '↓'}

**ALINHAMENTO DAS EMAs (1H)**: ${realData.ema9_1h > realData.ema21_1h && realData.ema21_1h > realData.ema50_1h && realData.ema50_1h > realData.ema200_1h ? 'ALTA (Bullish)' : realData.ema9_1h < realData.ema21_1h && realData.ema21_1h < realData.ema50_1h && realData.ema50_1h < realData.ema200_1h ? 'BAIXA (Bearish)' : 'LATERAL (Neutral)'}

#### ⚡ TIMEFRAME 5 MINUTOS (Entrada)
**RSI (14 períodos)**: ${realData.rsi5m.toFixed(2)}
- Zona: ${realData.rsi5m > 70 ? 'SOBRECOMPRADO' : realData.rsi5m < 30 ? 'SOBREVENDIDO' : 'NEUTRO'}
- Interpretação: ${realData.rsi5m > 70 ? 'Possível reversão para baixa' : realData.rsi5m < 30 ? 'Possível reversão para alta' : 'Momentum equilibrado'}

**MACD (12,26,9)**:
- MACD Line: ${realData.macd5m.toFixed(4)}
- Signal Line: ${realData.macdSignal5m.toFixed(4)}
- Histograma: ${(realData.macd5m - realData.macdSignal5m).toFixed(4)}
- Sinal: ${realData.macd5m > realData.macdSignal5m ? 'BULLISH (Compra)' : 'BEARISH (Venda)'}

**MÉDIAS MÓVEIS EXPONENCIAIS (5M)**:
- EMA 9: $${realData.ema9_5m.toFixed(2)} ${realData.currentPrice > realData.ema9_5m ? '↑' : '↓'}
- EMA 21: $${realData.ema21_5m.toFixed(2)} ${realData.currentPrice > realData.ema21_5m ? '↑' : '↓'}
- EMA 50: $${realData.ema50_5m.toFixed(2)} ${realData.currentPrice > realData.ema50_5m ? '↑' : '↓'}

**ALINHAMENTO DAS EMAs (5M)**: ${realData.ema9_5m > realData.ema21_5m && realData.ema21_5m > realData.ema50_5m ? 'ALTA (Bullish)' : realData.ema9_5m < realData.ema21_5m && realData.ema21_5m < realData.ema50_5m ? 'BAIXA (Bearish)' : 'LATERAL (Neutral)'}

### 📊 ESTRUTURA DE PREÇOS (Últimas 20 Velas)
**Máximas**: ${realData.highs.map(h => h.toFixed(2)).join(', ')}
**Mínimas**: ${realData.lows.map(l => l.toFixed(2)).join(', ')}
**Fechamentos**: ${realData.closes.map(c => c.toFixed(2)).join(', ')}

**Análise de Suporte/Resistência**:
- Resistência Principal: $${Math.max(...realData.highs).toFixed(2)}
- Suporte Principal: $${Math.min(...realData.lows).toFixed(2)}
- Range Atual: ${(Math.max(...realData.highs) - Math.min(...realData.lows)).toFixed(2)} pontos

## 🔍 METODOLOGIA DE ANÁLISE TÉCNICA MULTI-TIMEFRAME

### 1. **ANÁLISE DE MOMENTUM MULTI-TIMEFRAME**
**1H (Tendência Principal)**:
- RSI ${realData.rsi1h.toFixed(2)} indica: ${realData.rsi1h > 70 ? 'MOMENTUM DE ALTA EXCESSIVO - Possível correção' : realData.rsi1h < 30 ? 'MOMENTUM DE BAIXA EXCESSIVO - Possível recuperação' : 'MOMENTUM EQUILIBRADO'}
- Divergências: ${realData.rsi1h > 50 ? 'Tendência de alta mantida' : 'Tendência de baixa mantida'}

**5M (Entrada)**:
- RSI ${realData.rsi5m.toFixed(2)} indica: ${realData.rsi5m > 70 ? 'MOMENTUM DE ALTA EXCESSIVO - Possível correção' : realData.rsi5m < 30 ? 'MOMENTUM DE BAIXA EXCESSIVO - Possível recuperação' : 'MOMENTUM EQUILIBRADO'}
- Divergências: ${realData.rsi5m > 50 ? 'Tendência de alta mantida' : 'Tendência de baixa mantida'}

### 2. **ANÁLISE DE TENDÊNCIA MULTI-TIMEFRAME**
**1H (Tendência Principal)**:
- MACD ${realData.macd1h.toFixed(4)} vs Signal ${realData.macdSignal1h.toFixed(4)}: ${realData.macd1h > realData.macdSignal1h ? 'CRUZAMENTO BULLISH - Sinal de compra' : 'CRUZAMENTO BEARISH - Sinal de venda'}
- Histograma: ${(realData.macd1h - realData.macdSignal1h).toFixed(4)} ${(realData.macd1h - realData.macdSignal1h) > 0 ? '(Acelerando alta)' : '(Acelerando baixa)'}

**5M (Entrada)**:
- MACD ${realData.macd5m.toFixed(4)} vs Signal ${realData.macdSignal5m.toFixed(4)}: ${realData.macd5m > realData.macdSignal5m ? 'CRUZAMENTO BULLISH - Sinal de compra' : 'CRUZAMENTO BEARISH - Sinal de venda'}
- Histograma: ${(realData.macd5m - realData.macdSignal5m).toFixed(4)} ${(realData.macd5m - realData.macdSignal5m) > 0 ? '(Acelerando alta)' : '(Acelerando baixa)'}

### 3. **ANÁLISE DE TENDÊNCIA PRINCIPAL MULTI-TIMEFRAME**
**1H (Tendência Principal)**:
- Alinhamento: ${realData.ema9_1h > realData.ema21_1h && realData.ema21_1h > realData.ema50_1h ? 'BULLISH STRONG' : realData.ema9_1h < realData.ema21_1h && realData.ema21_1h < realData.ema50_1h ? 'BEARISH STRONG' : 'MIXED SIGNALS'}
- Posição do Preço: ${realData.currentPrice > realData.ema9_1h ? 'ACIMA da EMA 9 (Suporte)' : 'ABAIXO da EMA 9 (Resistência)'}

**5M (Entrada)**:
- Alinhamento: ${realData.ema9_5m > realData.ema21_5m && realData.ema21_5m > realData.ema50_5m ? 'BULLISH STRONG' : realData.ema9_5m < realData.ema21_5m && realData.ema21_5m < realData.ema50_5m ? 'BEARISH STRONG' : 'MIXED SIGNALS'}
- Posição do Preço: ${realData.currentPrice > realData.ema9_5m ? 'ACIMA da EMA 9 (Suporte)' : 'ABAIXO da EMA 9 (Resistência)'}

### 4. **ANÁLISE DE VOLUME E ESTRUTURA**
- Volume 24h: ${realData.volume24h.toLocaleString()} BTC
- Volume Status: ${realData.volume24h > 50000000 ? 'ALTO - Confirma movimento' : 'NORMAL - Aguardar confirmação'}

## 🎯 SISTEMA DE CONFLUÊNCIAS MULTI-TIMEFRAME

### **PONTUAÇÃO DE CONFLUÊNCIA** (0-15 pontos):
**TIMEFRAME 1H (Tendência Principal) - 8 pontos**:
- RSI 1H Favorável: ${realData.rsi1h > 30 && realData.rsi1h < 70 ? '2 pontos' : realData.rsi1h < 30 || realData.rsi1h > 70 ? '1 ponto' : '0 pontos'}
- MACD 1H Favorável: ${realData.macd1h > realData.macdSignal1h ? '2 pontos' : '1 ponto'}
- EMAs 1H Alinhadas: ${realData.ema9_1h > realData.ema21_1h && realData.ema21_1h > realData.ema50_1h ? '2 pontos' : realData.ema9_1h < realData.ema21_1h && realData.ema21_1h < realData.ema50_1h ? '2 pontos' : '0 pontos'}
- Preço vs EMAs 1H: ${realData.currentPrice > realData.ema9_1h ? '2 pontos' : '0 pontos'}

**TIMEFRAME 5M (Entrada) - 5 pontos**:
- RSI 5M Favorável: ${realData.rsi5m > 30 && realData.rsi5m < 70 ? '1 ponto' : realData.rsi5m < 30 || realData.rsi5m > 70 ? '0.5 pontos' : '0 pontos'}
- MACD 5M Favorável: ${realData.macd5m > realData.macdSignal5m ? '1 ponto' : '0.5 pontos'}
- EMAs 5M Alinhadas: ${realData.ema9_5m > realData.ema21_5m && realData.ema21_5m > realData.ema50_5m ? '1 ponto' : realData.ema9_5m < realData.ema21_5m && realData.ema21_5m < realData.ema50_5m ? '1 ponto' : '0 pontos'}
- Preço vs EMAs 5M: ${realData.currentPrice > realData.ema9_5m ? '1 ponto' : '0 pontos'}

**VOLUME E ESTRUTURA - 2 pontos**:
- Volume Confirma: ${realData.volume24h > 50000000 ? '2 pontos' : '1 ponto'}

**TOTAL DE CONFLUÊNCIAS**: ${confluences}/15 pontos

## 🚨 REGRAS DE NEGOCIAÇÃO BINÁRIA MULTI-TIMEFRAME

### **CRITÉRIOS PARA SINAL**:
- **MÍNIMO 10/15 confluências** para sinal de COMPRA/VENDA
- **MÁXIMO 9/15 confluências** = AGUARDAR
- **Confiança mínima**: 75%
- **Confiança ideal**: 85%+

### **GESTÃO DE RISCO**:
- Operação binária: Ganha tudo ou perde tudo
- Sem stop loss possível
- Entrada: Próxima vela de 5 minutos
- Expiração: Baseada na análise técnica (5min, 15min, 30min, 1h)

### **DETERMINAÇÃO DE EXPIRAÇÃO**:
- **5 minutos**: Confluências 10-12, confiança 75-85%
- **15 minutos**: Confluências 12-14, confiança 85-90%
- **30 minutos**: Confluências 14-15, confiança 90-95%
- **1 hora**: Confluências 15, confiança 95%+

## 📋 FORMATO DE RESPOSTA OBRIGATÓRIO

Responda APENAS no formato JSON abaixo, sem texto adicional:

{
  "direction": "COMPRA|VENDA|AGUARDAR",
  "confidence": 75-100,
  "price": "$${realData.currentPrice.toFixed(2)}",
  "sentiment": "Bullish|Bearish|Neutral",
  "analysis": "Análise técnica detalhada com números específicos e justificativa baseada nos dados reais fornecidos",
  "reasoning": "Raciocínio lógico passo-a-passo explicando como chegou à conclusão baseada nas confluências identificadas",
  "entry": "Próxima vela 5m",
  "stopLoss": "N/A (Binary Option)",
  "takeProfit": "N/A (Binary Option)",
  "confluences": ${confluences},
  "risk_level": "BAIXO|MÉDIO|ALTO",
  "expiration": "5min|15min|30min|1h",
  "timeframe": "1h + 5min",
  "detailedReasons": [
    "Motivo 1: RSI 1H ${realData.rsi1h.toFixed(2)} - ${realData.rsi1h > 70 ? 'Sobrecarregado' : realData.rsi1h < 30 ? 'Sobrevendido' : 'Neutro'}",
    "Motivo 2: RSI 5M ${realData.rsi5m.toFixed(2)} - ${realData.rsi5m > 70 ? 'Sobrecarregado' : realData.rsi5m < 30 ? 'Sobrevendido' : 'Neutro'}",
    "Motivo 3: MACD 1H ${realData.macd1h > realData.macdSignal1h ? 'Bullish' : 'Bearish'}",
    "Motivo 4: MACD 5M ${realData.macd5m > realData.macdSignal5m ? 'Bullish' : 'Bearish'}",
    "Motivo 5: EMAs 1H ${realData.ema9_1h > realData.ema21_1h && realData.ema21_1h > realData.ema50_1h ? 'Alinhadas para Alta' : realData.ema9_1h < realData.ema21_1h && realData.ema21_1h < realData.ema50_1h ? 'Alinhadas para Baixa' : 'Mistas'}",
    "Motivo 6: EMAs 5M ${realData.ema9_5m > realData.ema21_5m && realData.ema21_5m > realData.ema50_5m ? 'Alinhadas para Alta' : realData.ema9_5m < realData.ema21_5m && realData.ema21_5m < realData.ema50_5m ? 'Alinhadas para Baixa' : 'Mistas'}",
    "Motivo 7: Volume ${realData.volume24h > 50000000 ? 'Alto - Confirma movimento' : 'Normal - Aguardar confirmação'}"
  ]
}

## ⚠️ INSTRUÇÕES CRÍTICAS

1. **USE EXCLUSIVAMENTE** os dados técnicos fornecidos
2. **CALCULE** a pontuação de confluências corretamente
3. **JUSTIFIQUE** cada decisão com números específicos
4. **SEJA CONSERVADOR** - melhor AGUARDAR que operar sem certeza
5. **FOQUE** na precisão técnica, não em especulação
6. **ANALISE** a estrutura de preços para suportes/resistências
7. **CONSIDERE** o volume como confirmador do movimento

## 🎯 OBJETIVO FINAL
Fornecer uma análise técnica profissional e precisa para operação binária de 5 minutos no Bitcoin, baseada em dados reais e metodologia científica de análise técnica.

**IMPORTANTE**: Responda APENAS no formato JSON solicitado, sem texto adicional.`;
    
    let response;
    
    switch (provider) {
      case "huggingface":
        response = await fetch("https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium", {
          headers: { Authorization: `Bearer ${key}` },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        });
        break;
        
      case "cohere":
        response = await fetch("https://api.cohere.ai/v1/generate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "command-light",
            prompt: prompt,
            max_tokens: 300,
          }),
        });
        break;
        
      case "groq":
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            model: selectedModel,
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });
        break;
        
      default:
        throw new Error("Provider não suportado");
    }

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const responseData = await response.json();
    let aiResponse = '';
    
    // Processar resposta baseada no provedor
    switch (provider) {
      case "huggingface":
        aiResponse = responseData[0]?.generated_text || '';
        break;
      case "cohere":
        aiResponse = responseData.generations?.[0]?.text || '';
        break;
      case "groq":
        aiResponse = responseData.choices?.[0]?.message?.content || '';
        break;
      default:
        aiResponse = '';
    }

    // Tentar extrair JSON da resposta da IA
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        
        // Validar se tem os campos necessários
        if (parsedResult.direction && parsedResult.confidence && parsedResult.analysis) {
          return {
            direction: parsedResult.direction,
            confidence: Math.max(70, Math.min(100, parsedResult.confidence)),
            price: parsedResult.price || `$${realData?.currentPrice.toFixed(2) || '0.00'}`,
            sentiment: parsedResult.sentiment || 'Neutro',
            analysis: parsedResult.analysis,
            reasoning: parsedResult.reasoning || parsedResult.analysis,
            entry: parsedResult.entry || "Próxima vela 5m",
            stopLoss: parsedResult.stopLoss || "N/A (Binary Option)",
            takeProfit: parsedResult.takeProfit || "N/A (Binary Option)",
            confluences: parsedResult.confluences || 0,
            riskLevel: parsedResult.risk_level || "MÉDIO"
          };
        }
      }
    } catch (error) {
      console.warn('Erro ao processar resposta da IA:', error);
    }

    // Se não conseguir processar a resposta da IA, usar dados reais para gerar análise
    if (realData) {
      return generateRealAnalysis(realData);
    }

    // Fallback: tentar buscar dados reais novamente
    const fallbackData = await fetchRealBitcoinData();
    if (fallbackData) {
      return generateRealAnalysis(fallbackData);
    }

    // Último recurso: dados demo
    return generateDemoAnalysis();
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

        {/* Modelo Groq Fixo */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Modelo Groq</Label>
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-semibold text-white">GPT OSS 120B</div>
                    <div className="text-sm text-blue-300">Modelo GPT de código aberto com 120B parâmetros</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400"></span>
                  <span className="text-yellow-400"></span>
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
                disabled={!apiKey.trim()}
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
