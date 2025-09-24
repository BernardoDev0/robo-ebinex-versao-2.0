// Utilitários de Trading Melhorados para Binary Options - Ebinex

// Função para calcular RSI
export const calculateRSI = (prices: number[], period: number = 14): number[] => {
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

// Função para calcular EMA
export const calculateEMA = (prices: number[], period: number): number[] => {
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

// Função para calcular SMA (Simple Moving Average)
export const calculateSMA = (values: number[], period: number): number[] => {
  const sma: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  
  return sma;
};

// Função para calcular Stochastic RSI
export const calculateStochRSI = (rsiValues: number[], period: number = 14, smoothK: number = 3, smoothD: number = 3) => {
  const stochRSI: number[] = [];
  
  for (let i = period - 1; i < rsiValues.length; i++) {
    const rsiSlice = rsiValues.slice(i - period + 1, i + 1);
    const minRSI = Math.min(...rsiSlice);
    const maxRSI = Math.max(...rsiSlice);
    
    if (maxRSI - minRSI === 0) {
      stochRSI.push(50); // Neutro se não há variação
    } else {
      const stoch = ((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100;
      stochRSI.push(stoch);
    }
  }
  
  // Calcular %K (média móvel)
  const K = calculateSMA(stochRSI, smoothK);
  // Calcular %D (média móvel de %K)
  const D = calculateSMA(K, smoothD);
  
  return { 
    K, 
    D, 
    crossover: K.length > 0 && D.length > 0 ? K[K.length - 1] > D[D.length - 1] : false,
    oversold: K.length > 0 ? K[K.length - 1] < 20 : false,
    overbought: K.length > 0 ? K[K.length - 1] > 80 : false
  };
};

// Função para calcular MACD
export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);
  
  const macd: number[] = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    macd.push(emaFast[i] - emaSlow[i]);
  }
  
  const signal = calculateEMA(macd, signalPeriod);
  const histogram: number[] = [];
  
  for (let i = 0; i < macd.length && i < signal.length; i++) {
    histogram.push(macd[i] - signal[i]);
  }
  
  return { macd, signal, histogram };
};

// Função para calcular ATR (Average True Range)
export const calculateATR = (highs: number[], lows: number[], closes: number[], period: number = 14) => {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const highLow = highs[i] - lows[i];
    const highClose = Math.abs(highs[i] - closes[i - 1]);
    const lowClose = Math.abs(lows[i] - closes[i - 1]);
    
    trueRanges.push(Math.max(highLow, highClose, lowClose));
  }
  
  // Calcular média móvel exponencial do True Range
  const atr = calculateEMA(trueRanges, period);
  const currentATR = atr[atr.length - 1];
  const avgPrice = closes[closes.length - 1];
  
  return {
    value: currentATR,
    percentage: (currentATR / avgPrice) * 100,
    level: currentATR / avgPrice > 0.02 ? 'ALTO' : 
           currentATR / avgPrice > 0.01 ? 'MÉDIO' : 'BAIXO'
  };
};

// Detector de Padrões de Candlestick
export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface CandlePattern {
  name: string;
  signal: 'BULLISH' | 'BEARISH' | 'REVERSÃO' | 'NEUTRAL';
  confidence: number;
}

export const detectCandlePatterns = (candles: CandleData[]): CandlePattern[] => {
  const patterns: CandlePattern[] = [];
  
  if (candles.length < 2) return patterns;
  
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  
  // Calcular tamanhos do corpo e sombras
  const bodySize = Math.abs(lastCandle.close - lastCandle.open);
  const totalRange = lastCandle.high - lastCandle.low;
  const lowerShadow = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const upperShadow = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  
  // Doji
  if (bodySize / totalRange < 0.1 && totalRange > 0) {
    patterns.push({ 
      name: 'Doji', 
      signal: 'REVERSÃO', 
      confidence: 70 
    });
  }
  
  // Hammer (martelo)
  if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5 && bodySize > 0) {
    patterns.push({ 
      name: 'Hammer', 
      signal: 'BULLISH', 
      confidence: 75 
    });
  }
  
  // Hanging Man
  if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5 && 
      lastCandle.close < lastCandle.open && bodySize > 0) {
    patterns.push({ 
      name: 'Hanging Man', 
      signal: 'BEARISH', 
      confidence: 75 
    });
  }
  
  // Engulfing Bullish
  if (prevCandle.close < prevCandle.open && // Vela anterior bearish
      lastCandle.close > lastCandle.open && // Vela atual bullish
      lastCandle.open < prevCandle.close &&
      lastCandle.close > prevCandle.open) {
    patterns.push({ 
      name: 'Bullish Engulfing', 
      signal: 'BULLISH', 
      confidence: 85 
    });
  }
  
  // Engulfing Bearish
  if (prevCandle.close > prevCandle.open && // Vela anterior bullish
      lastCandle.close < lastCandle.open && // Vela atual bearish
      lastCandle.open > prevCandle.close &&
      lastCandle.close < prevCandle.open) {
    patterns.push({ 
      name: 'Bearish Engulfing', 
      signal: 'BEARISH', 
      confidence: 85 
    });
  }
  
  // Shooting Star
  if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5 && 
      lastCandle.close < lastCandle.open && bodySize > 0) {
    patterns.push({ 
      name: 'Shooting Star', 
      signal: 'BEARISH', 
      confidence: 75 
    });
  }
  
  return patterns;
};

// Sistema de Confluências Aprimorado com Pesos
export interface SignalData {
  rsi1h: number;
  rsi5m: number;
  stochRSI1h: { K: number[]; D: number[]; crossover: boolean; oversold: boolean; overbought: boolean };
  stochRSI5m: { K: number[]; D: number[]; crossover: boolean; oversold: boolean; overbought: boolean };
  macd1h: { macd: number[]; signal: number[]; histogram: number[] };
  macd5m: { macd: number[]; signal: number[]; histogram: number[] };
  ema1h: { ema9: number; ema21: number; ema50: number; ema200: number; aligned: boolean };
  ema5m: { ema9: number; ema21: number; ema50: number; aligned: boolean };
  volume: { current: number; average: number; above_average: boolean };
  atr: { value: number; percentage: number; level: string };
  patterns: CandlePattern[];
  currentPrice: number;
}

export const calculateWeightedConfluence = (signals: SignalData) => {
  const weights = {
    // TIMEFRAME 1H (Tendência Principal) - 60% do peso total
    rsi1h: { 
      value: 3, 
      condition: (val: number) => val > 30 && val < 70,
      bonus: (val: number) => val < 30 || val > 70 ? 1 : 0 // Bonus para extremos
    },
    stochRSI1h: { 
      value: 2, 
      condition: (val: any) => val.crossover || val.oversold || val.overbought 
    },
    macd1h: { 
      value: 3, 
      condition: (val: any) => val.histogram.length > 0 && val.histogram[val.histogram.length - 1] > 0 
    },
    ema1h: { 
      value: 3, 
      condition: (val: any) => val.aligned 
    },
    
    // TIMEFRAME 5M (Entrada) - 30% do peso total
    rsi5m: { 
      value: 2, 
      condition: (val: number) => val > 30 && val < 70,
      bonus: (val: number) => val < 30 || val > 70 ? 0.5 : 0
    },
    stochRSI5m: { 
      value: 1.5, 
      condition: (val: any) => val.crossover || val.oversold || val.overbought 
    },
    macd5m: { 
      value: 2, 
      condition: (val: any) => val.histogram.length > 0 && val.histogram[val.histogram.length - 1] > 0 
    },
    ema5m: { 
      value: 1.5, 
      condition: (val: any) => val.aligned 
    },
    
    // CONFIRMADORES - 10% do peso total
    volume: { 
      value: 1, 
      condition: (val: any) => val.above_average 
    },
    atr: { 
      value: 0.5, 
      condition: (val: any) => val.level === 'MÉDIO' || val.level === 'BAIXO' // Preferir baixa volatilidade
    },
    patterns: { 
      value: 1, 
      condition: (val: CandlePattern[]) => val.some(p => p.signal === 'BULLISH' || p.signal === 'BEARISH') 
    }
  };
  
  let totalScore = 0;
  let maxScore = 0;
  const details: Record<string, { score: number; active: boolean; description: string }> = {};
  
  // RSI 1H
  maxScore += weights.rsi1h.value;
  const rsi1hActive = weights.rsi1h.condition(signals.rsi1h);
  const rsi1hBonus = weights.rsi1h.bonus ? weights.rsi1h.bonus(signals.rsi1h) : 0;
  if (rsi1hActive) totalScore += weights.rsi1h.value;
  totalScore += rsi1hBonus;
  details.rsi1h = {
    score: rsi1hActive ? weights.rsi1h.value + rsi1hBonus : rsi1hBonus,
    active: rsi1hActive,
    description: `RSI 1H: ${signals.rsi1h.toFixed(2)} ${rsi1hActive ? '✓' : '✗'}`
  };
  
  // Stochastic RSI 1H
  maxScore += weights.stochRSI1h.value;
  const stochRSI1hActive = weights.stochRSI1h.condition(signals.stochRSI1h);
  if (stochRSI1hActive) totalScore += weights.stochRSI1h.value;
  details.stochRSI1h = {
    score: stochRSI1hActive ? weights.stochRSI1h.value : 0,
    active: stochRSI1hActive,
    description: `Stoch RSI 1H: ${stochRSI1hActive ? '✓' : '✗'} (${signals.stochRSI1h.crossover ? 'Cross' : ''}${signals.stochRSI1h.oversold ? 'OS' : ''}${signals.stochRSI1h.overbought ? 'OB' : ''})`
  };
  
  // MACD 1H
  maxScore += weights.macd1h.value;
  const macd1hActive = weights.macd1h.condition(signals.macd1h);
  if (macd1hActive) totalScore += weights.macd1h.value;
  details.macd1h = {
    score: macd1hActive ? weights.macd1h.value : 0,
    active: macd1hActive,
    description: `MACD 1H: ${macd1hActive ? 'Bullish' : 'Bearish'} ${macd1hActive ? '✓' : '✗'}`
  };
  
  // EMAs 1H
  maxScore += weights.ema1h.value;
  const ema1hActive = weights.ema1h.condition(signals.ema1h);
  if (ema1hActive) totalScore += weights.ema1h.value;
  details.ema1h = {
    score: ema1hActive ? weights.ema1h.value : 0,
    active: ema1hActive,
    description: `EMAs 1H: ${ema1hActive ? 'Alinhadas' : 'Mistas'} ${ema1hActive ? '✓' : '✗'}`
  };
  
  // RSI 5M
  maxScore += weights.rsi5m.value;
  const rsi5mActive = weights.rsi5m.condition(signals.rsi5m);
  const rsi5mBonus = weights.rsi5m.bonus ? weights.rsi5m.bonus(signals.rsi5m) : 0;
  if (rsi5mActive) totalScore += weights.rsi5m.value;
  totalScore += rsi5mBonus;
  details.rsi5m = {
    score: rsi5mActive ? weights.rsi5m.value + rsi5mBonus : rsi5mBonus,
    active: rsi5mActive,
    description: `RSI 5M: ${signals.rsi5m.toFixed(2)} ${rsi5mActive ? '✓' : '✗'}`
  };
  
  // Stochastic RSI 5M
  maxScore += weights.stochRSI5m.value;
  const stochRSI5mActive = weights.stochRSI5m.condition(signals.stochRSI5m);
  if (stochRSI5mActive) totalScore += weights.stochRSI5m.value;
  details.stochRSI5m = {
    score: stochRSI5mActive ? weights.stochRSI5m.value : 0,
    active: stochRSI5mActive,
    description: `Stoch RSI 5M: ${stochRSI5mActive ? '✓' : '✗'}`
  };
  
  // MACD 5M
  maxScore += weights.macd5m.value;
  const macd5mActive = weights.macd5m.condition(signals.macd5m);
  if (macd5mActive) totalScore += weights.macd5m.value;
  details.macd5m = {
    score: macd5mActive ? weights.macd5m.value : 0,
    active: macd5mActive,
    description: `MACD 5M: ${macd5mActive ? 'Bullish' : 'Bearish'} ${macd5mActive ? '✓' : '✗'}`
  };
  
  // EMAs 5M
  maxScore += weights.ema5m.value;
  const ema5mActive = weights.ema5m.condition(signals.ema5m);
  if (ema5mActive) totalScore += weights.ema5m.value;
  details.ema5m = {
    score: ema5mActive ? weights.ema5m.value : 0,
    active: ema5mActive,
    description: `EMAs 5M: ${ema5mActive ? 'Alinhadas' : 'Mistas'} ${ema5mActive ? '✓' : '✗'}`
  };
  
  // Volume
  maxScore += weights.volume.value;
  const volumeActive = weights.volume.condition(signals.volume);
  if (volumeActive) totalScore += weights.volume.value;
  details.volume = {
    score: volumeActive ? weights.volume.value : 0,
    active: volumeActive,
    description: `Volume: ${volumeActive ? 'Alto' : 'Normal'} ${volumeActive ? '✓' : '✗'}`
  };
  
  // ATR
  maxScore += weights.atr.value;
  const atrActive = weights.atr.condition(signals.atr);
  if (atrActive) totalScore += weights.atr.value;
  details.atr = {
    score: atrActive ? weights.atr.value : 0,
    active: atrActive,
    description: `ATR: ${signals.atr.level} ${atrActive ? '✓' : '✗'}`
  };
  
  // Padrões de Candlestick
  maxScore += weights.patterns.value;
  const patternsActive = weights.patterns.condition(signals.patterns);
  if (patternsActive) totalScore += weights.patterns.value;
  details.patterns = {
    score: patternsActive ? weights.patterns.value : 0,
    active: patternsActive,
    description: `Padrões: ${signals.patterns.length > 0 ? signals.patterns.map(p => p.name).join(', ') : 'Nenhum'} ${patternsActive ? '✓' : '✗'}`
  };
  
  const percentage = (totalScore / maxScore) * 100;
  
  return {
    score: totalScore,
    maxScore: maxScore,
    percentage: percentage,
    confidence: percentage >= 75 ? 'ALTO' : 
                percentage >= 60 ? 'MÉDIO' : 'BAIXO',
    details: details,
    signalStrength: percentage >= 75 ? 'FORTE' :
                   percentage >= 60 ? 'MODERADO' :
                   percentage >= 45 ? 'FRACO' : 'MUITO_FRACO'
  };
};

// Timer para Próxima Vela
export const getNextCandleTimer = (timeframe: '1m' | '5m' | '15m' | '30m' | '1h' = '5m') => {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  
  let minutesToNext: number;
  
  switch (timeframe) {
    case '1m':
      minutesToNext = 1 - (minutes % 1);
      break;
    case '5m':
      minutesToNext = 5 - (minutes % 5);
      break;
    case '15m':
      minutesToNext = 15 - (minutes % 15);
      break;
    case '30m':
      minutesToNext = 30 - (minutes % 30);
      break;
    case '1h':
      minutesToNext = 60 - minutes;
      break;
    default:
      minutesToNext = 5 - (minutes % 5);
  }
  
  const secondsToNext = (minutesToNext - 1) * 60 + (60 - seconds);
  
  return {
    minutes: Math.floor(secondsToNext / 60),
    seconds: secondsToNext % 60,
    totalSeconds: secondsToNext,
    alert30s: secondsToNext <= 30,
    alert10s: secondsToNext <= 10,
    timeframe: timeframe
  };
};

// Análise de Horário de Trading
export const getTradingSession = () => {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  
  // Sessões de trading (horário UTC)
  const sessions = {
    sydney: { start: 21, end: 6, active: false },
    tokyo: { start: 0, end: 9, active: false },
    london: { start: 8, end: 17, active: false },
    newYork: { start: 13, end: 22, active: false }
  };
  
  // Verificar sessões ativas
  for (const [name, session] of Object.entries(sessions)) {
    if (session.start > session.end) {
      // Sessão atravessa meia-noite
      session.active = utcHour >= session.start || utcHour < session.end;
    } else {
      session.active = utcHour >= session.start && utcHour < session.end;
    }
  }
  
  // Horários ótimos para Bitcoin Binary Options
  const optimalHours = {
    excellent: (utcHour >= 8 && utcHour <= 10) || (utcHour >= 13 && utcHour <= 15),
    good: (utcHour >= 6 && utcHour <= 17),
    avoid: dayOfWeek === 5 && utcHour >= 18, // Sexta após 18:00
    weekend: dayOfWeek === 0 || dayOfWeek === 6
  };
  
  return {
    sessions,
    quality: optimalHours.excellent ? 'EXCELENTE' :
             optimalHours.good ? 'BOM' :
             optimalHours.avoid ? 'EVITAR' :
             optimalHours.weekend ? 'FIM DE SEMANA' : 'REGULAR',
    recommendation: optimalHours.excellent ? 'Momento ideal para operar' :
                    optimalHours.good ? 'Bom momento para operar' :
                    optimalHours.avoid ? 'Evite operar agora' :
                    'Momento regular, opere com cautela',
    currentHour: utcHour,
    isWeekend: optimalHours.weekend
  };
};

// Sistema de Alertas (Class)
// Sistema de Backtesting
export interface BacktestTrade {
  timestamp: number;
  direction: 'COMPRA' | 'VENDA';
  confidence: number;
  entryPrice: number;
  exitPrice: number;
  result: 'WIN' | 'LOSS';
  profit: number;
  balance: number;
  confluenceScore: number;
  patterns: string[];
}

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  finalBalance: number;
  initialBalance: number;
  roi: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  trades: BacktestTrade[];
  monthlyResults: { [month: string]: { trades: number; wins: number; profit: number } };
}

export const runBacktest = (
  historicalData: CandleData[],
  strategy: (data: CandleData[], index: number) => { direction: 'COMPRA' | 'VENDA' | 'AGUARDAR'; confidence: number; confluenceScore: number; patterns: string[] },
  initialBalance: number = 1000,
  riskPerTrade: number = 0.02, // 2% do saldo por trade
  minConfidence: number = 70
): BacktestResult => {
  let balance = initialBalance;
  const trades: BacktestTrade[] = [];
  let wins = 0;
  let losses = 0;
  let maxBalance = initialBalance;
  let maxDrawdown = 0;
  let currentConsecutiveWins = 0;
  let currentConsecutiveLosses = 0;
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  
  const monthlyResults: { [month: string]: { trades: number; wins: number; profit: number } } = {};
  
  // Precisamos de pelo menos 200 velas para calcular os indicadores
  for (let i = 200; i < historicalData.length - 1; i++) {
    const signal = strategy(historicalData, i);
    
    if (signal.direction !== 'AGUARDAR' && signal.confidence >= minConfidence) {
      const entryPrice = historicalData[i].close;
      const exitPrice = historicalData[i + 1].close; // Próxima vela (5 minutos)
      
      const betAmount = balance * riskPerTrade;
      const isWin = (signal.direction === 'COMPRA' && exitPrice > entryPrice) ||
                    (signal.direction === 'VENDA' && exitPrice < entryPrice);
      
      let profit: number;
      if (isWin) {
        profit = betAmount * 0.9; // 90% de retorno típico em binary options
        balance += profit;
        wins++;
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentConsecutiveWins);
      } else {
        profit = -betAmount;
        balance += profit; // Subtrai o valor
        losses++;
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentConsecutiveLosses);
      }
      
      // Atualizar drawdown
      if (balance > maxBalance) {
        maxBalance = balance;
      } else {
        const currentDrawdown = maxBalance - balance;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      }
      
      // Registrar trade
      const timestamp = Date.now() - (historicalData.length - i) * 5 * 60 * 1000; // Aproximação
      const trade: BacktestTrade = {
        timestamp,
        direction: signal.direction,
        confidence: signal.confidence,
        entryPrice,
        exitPrice,
        result: isWin ? 'WIN' : 'LOSS',
        profit,
        balance,
        confluenceScore: signal.confluenceScore,
        patterns: signal.patterns
      };
      
      trades.push(trade);
      
      // Estatísticas mensais
      const month = new Date(timestamp).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyResults[month]) {
        monthlyResults[month] = { trades: 0, wins: 0, profit: 0 };
      }
      monthlyResults[month].trades++;
      if (isWin) monthlyResults[month].wins++;
      monthlyResults[month].profit += profit;
    }
  }
  
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const roi = ((balance - initialBalance) / initialBalance) * 100;
  const maxDrawdownPercentage = maxBalance > 0 ? (maxDrawdown / maxBalance) * 100 : 0;
  
  // Calcular profit factor
  const totalWinProfit = trades.filter(t => t.result === 'WIN').reduce((sum, t) => sum + t.profit, 0);
  const totalLossProfit = Math.abs(trades.filter(t => t.result === 'LOSS').reduce((sum, t) => sum + t.profit, 0));
  const profitFactor = totalLossProfit > 0 ? totalWinProfit / totalLossProfit : 0;
  
  // Médias
  const winTrades = trades.filter(t => t.result === 'WIN');
  const lossTrades = trades.filter(t => t.result === 'LOSS');
  const averageWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.profit, 0) / winTrades.length : 0;
  const averageLoss = lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + t.profit, 0) / lossTrades.length : 0;
  const largestWin = winTrades.length > 0 ? Math.max(...winTrades.map(t => t.profit)) : 0;
  const largestLoss = lossTrades.length > 0 ? Math.min(...lossTrades.map(t => t.profit)) : 0;
  
  return {
    totalTrades,
    wins,
    losses,
    winRate,
    finalBalance: balance,
    initialBalance,
    roi,
    maxDrawdown,
    maxDrawdownPercentage,
    profitFactor,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    consecutiveWins: maxConsecutiveWins,
    consecutiveLosses: maxConsecutiveLosses,
    trades,
    monthlyResults
  };
};

// Função de estratégia de exemplo para backtesting
export const createBacktestStrategy = () => {
  return (data: CandleData[], index: number) => {
    // Verificar se temos dados suficientes
    if (index < 200) {
      return { direction: 'AGUARDAR' as const, confidence: 0, confluenceScore: 0, patterns: [] };
    }
    
    // Extrair dados para cálculos
    const closes1h = data.slice(Math.max(0, index - 100), index + 1).map(c => c.close);
    const closes5m = data.slice(Math.max(0, index - 50), index + 1).map(c => c.close);
    const highs = data.slice(Math.max(0, index - 50), index + 1).map(c => c.high);
    const lows = data.slice(Math.max(0, index - 50), index + 1).map(c => c.low);
    const volumes = data.slice(Math.max(0, index - 50), index + 1).map(c => c.volume || 0);
    
    // Calcular indicadores
    const rsi1h = calculateRSI(closes1h, 14);
    const rsi5m = calculateRSI(closes5m, 14);
    const currentRSI1h = rsi1h[rsi1h.length - 1] || 50;
    const currentRSI5m = rsi5m[rsi5m.length - 1] || 50;
    
    const stochRSI1h = calculateStochRSI(rsi1h);
    const stochRSI5m = calculateStochRSI(rsi5m);
    
    const macd1h = calculateMACD(closes1h);
    const macd5m = calculateMACD(closes5m);
    
    const ema9_1h = calculateEMA(closes1h, 9);
    const ema21_1h = calculateEMA(closes1h, 21);
    const ema50_1h = calculateEMA(closes1h, 50);
    const ema200_1h = calculateEMA(closes1h, 200);
    
    const ema9_5m = calculateEMA(closes5m, 9);
    const ema21_5m = calculateEMA(closes5m, 21);
    const ema50_5m = calculateEMA(closes5m, 50);
    
    const atr = calculateATR(highs, lows, closes5m);
    const patterns = detectCandlePatterns(data.slice(index - 1, index + 1));
    
    // Preparar dados para análise de confluência
    const signalData: SignalData = {
      rsi1h: currentRSI1h,
      rsi5m: currentRSI5m,
      stochRSI1h: stochRSI1h,
      stochRSI5m: stochRSI5m,
      macd1h: macd1h,
      macd5m: macd5m,
      ema1h: {
        ema9: ema9_1h[ema9_1h.length - 1] || data[index].close,
        ema21: ema21_1h[ema21_1h.length - 1] || data[index].close,
        ema50: ema50_1h[ema50_1h.length - 1] || data[index].close,
        ema200: ema200_1h[ema200_1h.length - 1] || data[index].close,
        aligned: ema9_1h.length > 0 && ema21_1h.length > 0 && ema50_1h.length > 0 && 
                 ema9_1h[ema9_1h.length - 1] > ema21_1h[ema21_1h.length - 1] && 
                 ema21_1h[ema21_1h.length - 1] > ema50_1h[ema50_1h.length - 1]
      },
      ema5m: {
        ema9: ema9_5m[ema9_5m.length - 1] || data[index].close,
        ema21: ema21_5m[ema21_5m.length - 1] || data[index].close,
        ema50: ema50_5m[ema50_5m.length - 1] || data[index].close,
        aligned: ema9_5m.length > 0 && ema21_5m.length > 0 && ema50_5m.length > 0 && 
                 ema9_5m[ema9_5m.length - 1] > ema21_5m[ema21_5m.length - 1] && 
                 ema21_5m[ema21_5m.length - 1] > ema50_5m[ema50_5m.length - 1]
      },
      volume: {
        current: volumes[volumes.length - 1] || 0,
        average: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0,
        above_average: volumes.length > 0 && volumes[volumes.length - 1] > volumes.reduce((a, b) => a + b, 0) / volumes.length
      },
      atr: atr,
      patterns: patterns,
      currentPrice: data[index].close
    };
    
    const confluence = calculateWeightedConfluence(signalData);
    
    // Determinar direção baseada na confluência
    let direction: 'COMPRA' | 'VENDA' | 'AGUARDAR' = 'AGUARDAR';
    
    if (confluence.percentage >= 75) {
      // Determinar direção baseada nos indicadores principais
      const bullishSignals = [
        currentRSI5m < 70 && currentRSI5m > 30,
        stochRSI5m.oversold || stochRSI5m.crossover,
        macd5m.histogram.length > 0 && macd5m.histogram[macd5m.histogram.length - 1] > 0,
        signalData.ema5m.aligned,
        patterns.some(p => p.signal === 'BULLISH')
      ].filter(Boolean).length;
      
      const bearishSignals = [
        currentRSI5m > 30 && currentRSI5m < 70,
        stochRSI5m.overbought,
        macd5m.histogram.length > 0 && macd5m.histogram[macd5m.histogram.length - 1] < 0,
        !signalData.ema5m.aligned,
        patterns.some(p => p.signal === 'BEARISH')
      ].filter(Boolean).length;
      
      if (bullishSignals > bearishSignals) {
        direction = 'COMPRA';
      } else if (bearishSignals > bullishSignals) {
        direction = 'VENDA';
      }
    }
    
    return {
      direction,
      confidence: confluence.percentage,
      confluenceScore: confluence.score,
      patterns: patterns.map(p => p.name)
    };
  };
};

export class AlertSystem {
  private audioContext: AudioContext | null = null;
  
  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext não disponível:', error);
    }
  }
  
  playSound(frequency: number = 440, duration: number = 200) {
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Erro ao reproduzir som:', error);
    }
  }
  
  notifySignal(type: 'COMPRA' | 'VENDA' | 'ALERTA' | 'TIMER') {
    // Som diferente para cada tipo de sinal
    const sounds = {
      COMPRA: [523, 659, 784], // C, E, G (acorde maior)
      VENDA: [440, 554, 659],  // A, C#, E (acorde menor)
      ALERTA: [880, 880, 880], // A5 repetido
      TIMER: [800, 1000]       // Alerta de timer
    };
    
    const frequencies = sounds[type] || sounds.ALERTA;
    frequencies.forEach((freq, index) => {
      setTimeout(() => this.playSound(freq, 150), index * 200);
    });
    
    // Notificação do navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      const messages = {
        COMPRA: 'Sinal de COMPRA identificado!',
        VENDA: 'Sinal de VENDA identificado!',
        ALERTA: 'Alerta do sistema!',
        TIMER: 'Próxima vela em 30 segundos!'
      };
      
      new Notification('Ebinex Trading System', {
        body: messages[type],
        icon: '/favicon.ico',
        requireInteraction: true
      });
    }
  }
  
  requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}