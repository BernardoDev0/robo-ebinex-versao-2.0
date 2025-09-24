import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, TrendingUp, TrendingDown, Calendar, DollarSign, Download, Upload, Trash2, X, CalendarDays } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  date: string;
  result?: 'win' | 'loss';
  notes?: string;
  risk?: 'baixo' | 'medio' | 'alto';
}

interface MonthlyStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netResult: number;
  riskStats: {
    baixo: { total: number; wins: number; winRate: number };
    medio: { total: number; wins: number; winRate: number };
    alto: { total: number; wins: number; winRate: number };
  };
}

interface DailyStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netResult: number;
  riskStats: {
    baixo: { total: number; wins: number; winRate: number };
    medio: { total: number; wins: number; winRate: number };
    alto: { total: number; wins: number; winRate: number };
  };
}

export default function TradeTracker() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [newTrade, setNewTrade] = useState({
    symbol: 'BTCUSDT',
    entryPrice: '',
    quantity: '',
    notes: '',
    risk: 'medio' as 'baixo' | 'medio' | 'alto'
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netResult: 0,
    riskStats: {
      baixo: { total: 0, wins: 0, winRate: 0 },
      medio: { total: 0, wins: 0, winRate: 0 },
      alto: { total: 0, wins: 0, winRate: 0 }
    }
  });
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netResult: 0,
    riskStats: {
      baixo: { total: 0, wins: 0, winRate: 0 },
      medio: { total: 0, wins: 0, winRate: 0 },
      alto: { total: 0, wins: 0, winRate: 0 }
    }
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [exitPriceModal, setExitPriceModal] = useState<{
    isOpen: boolean;
    tradeId: string | null;
    result: 'win' | 'loss' | null;
    exitPrice: string;
  }>({
    isOpen: false,
    tradeId: null,
    result: null,
    exitPrice: ''
  });

  // Carregar trades do localStorage
  useEffect(() => {
    const savedTrades = localStorage.getItem('bitcoin-trades');
    if (savedTrades) {
      try {
        const parsedTrades = JSON.parse(savedTrades);
        setTrades(parsedTrades);
        console.log('✅ Trades carregados do localStorage:', parsedTrades.length);
      } catch (error) {
        console.error('❌ Erro ao carregar trades:', error);
        // Backup: tentar carregar da chave antiga
        const oldTrades = localStorage.getItem('trades');
        if (oldTrades) {
          try {
            const parsedOldTrades = JSON.parse(oldTrades);
            setTrades(parsedOldTrades);
            // Migrar para nova chave
            localStorage.setItem('bitcoin-trades', oldTrades);
            localStorage.removeItem('trades');
            console.log('✅ Migração de dados concluída');
          } catch (migrationError) {
            console.error('❌ Erro na migração:', migrationError);
          }
        }
      }
    }
  }, []);

  // Salvar trades no localStorage
  useEffect(() => {
    if (trades.length > 0) {
      setIsSaving(true);
      try {
        localStorage.setItem('bitcoin-trades', JSON.stringify(trades));
        console.log('💾 Trades salvos automaticamente:', trades.length);
        
        // Backup adicional
        localStorage.setItem('bitcoin-trades-backup', JSON.stringify({
          data: trades,
          timestamp: new Date().toISOString()
        }));
        
        setLastSaved(new Date().toLocaleTimeString('pt-BR'));
        calculateMonthlyStats();
        calculateDailyStats();
      } catch (error) {
        console.error('❌ Erro ao salvar trades:', error);
        alert('Erro ao salvar dados! Verifique o espaço disponível no navegador.');
      } finally {
        setTimeout(() => setIsSaving(false), 1000);
      }
    }
  }, [trades]);

  // Recalcular estatísticas diárias quando a data mudar
  useEffect(() => {
    calculateDailyStats();
  }, [selectedDate, trades]);

  // Calcular estatísticas mensais
  const calculateMonthlyStats = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() === currentMonth && 
             tradeDate.getFullYear() === currentYear &&
             trade.result;
    });

    const wins = monthlyTrades.filter(trade => trade.result === 'win').length;
    const losses = monthlyTrades.filter(trade => trade.result === 'loss').length;
    const totalTrades = wins + losses;
    
    const totalProfit = monthlyTrades
      .filter(trade => trade.result === 'win' && trade.exitPrice)
      .reduce((sum, trade) => {
        const profit = (trade.exitPrice! - trade.entryPrice) * trade.quantity;
        return sum + profit;
      }, 0);

    const lossTrades = monthlyTrades.filter(trade => trade.result === 'loss' && trade.exitPrice !== undefined);
    console.log('🔍 Trades de loss encontrados:', lossTrades);
    
    const totalLoss = lossTrades.reduce((sum, trade) => {
      const loss = Math.abs((trade.exitPrice! - trade.entryPrice) * trade.quantity);
      console.log('💰 Calculando loss:', { 
        symbol: trade.symbol, 
        entryPrice: trade.entryPrice, 
        exitPrice: trade.exitPrice, 
        quantity: trade.quantity, 
        loss 
      });
      return sum + loss;
    }, 0);

    // Calcular estatísticas por risco
    const riskStats = {
      baixo: { total: 0, wins: 0, winRate: 0 },
      medio: { total: 0, wins: 0, winRate: 0 },
      alto: { total: 0, wins: 0, winRate: 0 }
    };

    (['baixo', 'medio', 'alto'] as const).forEach(riskLevel => {
      const riskTrades = monthlyTrades.filter(trade => trade.risk === riskLevel);
      const riskWins = riskTrades.filter(trade => trade.result === 'win').length;
      const riskTotal = riskTrades.length;
      
      riskStats[riskLevel] = {
        total: riskTotal,
        wins: riskWins,
        winRate: riskTotal > 0 ? (riskWins / riskTotal) * 100 : 0
      };
    });

    setMonthlyStats({
      totalTrades,
      wins,
      losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      totalProfit,
      totalLoss,
      netResult: totalProfit - totalLoss,
      riskStats
    });
  };

  // Calcular estatísticas diárias
  const calculateDailyStats = () => {
    const selectedDateObj = new Date(selectedDate);
    const selectedYear = selectedDateObj.getFullYear();
    const selectedMonth = selectedDateObj.getMonth();
    const selectedDay = selectedDateObj.getDate();
    
    const dailyTrades = trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getFullYear() === selectedYear && 
             tradeDate.getMonth() === selectedMonth &&
             tradeDate.getDate() === selectedDay &&
             trade.result;
    });

    const wins = dailyTrades.filter(trade => trade.result === 'win').length;
    const losses = dailyTrades.filter(trade => trade.result === 'loss').length;
    const totalTrades = wins + losses;
    
    const totalProfit = dailyTrades
      .filter(trade => trade.result === 'win' && trade.exitPrice)
      .reduce((sum, trade) => {
        const profit = (trade.exitPrice! - trade.entryPrice) * trade.quantity;
        return sum + profit;
      }, 0);

    const lossTrades = dailyTrades.filter(trade => trade.result === 'loss' && trade.exitPrice !== undefined);
    
    const totalLoss = lossTrades.reduce((sum, trade) => {
      const loss = Math.abs((trade.exitPrice! - trade.entryPrice) * trade.quantity);
      return sum + loss;
    }, 0);

    // Calcular estatísticas por risco
    const riskStats = {
      baixo: { total: 0, wins: 0, winRate: 0 },
      medio: { total: 0, wins: 0, winRate: 0 },
      alto: { total: 0, wins: 0, winRate: 0 }
    };

    (['baixo', 'medio', 'alto'] as const).forEach(riskLevel => {
      const riskTrades = dailyTrades.filter(trade => trade.risk === riskLevel);
      const riskWins = riskTrades.filter(trade => trade.result === 'win').length;
      const riskTotal = riskTrades.length;
      
      riskStats[riskLevel] = {
        total: riskTotal,
        wins: riskWins,
        winRate: riskTotal > 0 ? (riskWins / riskTotal) * 100 : 0
      };
    });

    setDailyStats({
      totalTrades,
      wins,
      losses,
      winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
      totalProfit,
      totalLoss,
      netResult: totalProfit - totalLoss,
      riskStats
    });
  };

  // Adicionar novo trade
  const addTrade = () => {
    if (!newTrade.symbol || !newTrade.entryPrice || !newTrade.quantity) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const trade: Trade = {
      id: Date.now().toString(),
      symbol: newTrade.symbol.toUpperCase(),
      entryPrice: parseFloat(newTrade.entryPrice),
      quantity: parseFloat(newTrade.quantity),
      date: new Date().toISOString(),
      notes: newTrade.notes,
      risk: newTrade.risk
    };

    setTrades([trade, ...trades]);
    setNewTrade({ symbol: 'BTCUSDT', entryPrice: '', quantity: '', notes: '', risk: 'medio' });
  };

  // Abrir modal de preço de saída
  const openExitPriceModal = (tradeId: string, result: 'win' | 'loss') => {
    setExitPriceModal({
      isOpen: true,
      tradeId,
      result,
      exitPrice: ''
    });
  };

  // Confirmar preço de saída
  const confirmExitPrice = () => {
    if (!exitPriceModal.exitPrice || !exitPriceModal.tradeId || !exitPriceModal.result) return;
    
    const exitPrice = parseFloat(exitPriceModal.exitPrice);
    if (isNaN(exitPrice)) {
      alert('Por favor, digite um preço válido');
      return;
    }

    markTradeResult(exitPriceModal.tradeId, exitPriceModal.result, exitPrice);
    setExitPriceModal({
      isOpen: false,
      tradeId: null,
      result: null,
      exitPrice: ''
    });
  };

  // Marcar resultado do trade
  const markTradeResult = (tradeId: string, result: 'win' | 'loss', exitPrice?: number) => {
    console.log('🔧 Marcando trade:', { tradeId, result, exitPrice });
    setTrades(trades.map(trade => {
      if (trade.id === tradeId) {
        const updatedTrade = { ...trade, result, exitPrice: exitPrice !== undefined ? exitPrice : trade.exitPrice };
        console.log('✅ Trade atualizado:', updatedTrade);
        return updatedTrade;
      }
      return trade;
    }));
  };

  // Deletar trade
  const deleteTrade = (tradeId: string) => {
    setTrades(trades.filter(trade => trade.id !== tradeId));
  };

  // Exportar dados
  const exportData = () => {
    const dataToExport = {
      trades: trades,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitcoin-trades-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('📁 Dados exportados com sucesso!');
  };

  // Importar dados
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target?.result as string);
            if (importedData.trades && Array.isArray(importedData.trades)) {
              setTrades(importedData.trades);
              console.log('📥 Dados importados com sucesso!');
              alert(`Dados importados com sucesso! ${importedData.trades.length} trades carregados.`);
            } else {
              throw new Error('Formato de arquivo inválido');
            }
          } catch (error) {
            console.error('❌ Erro ao importar dados:', error);
            alert('Erro ao importar dados! Verifique se o arquivo está no formato correto.');
          }
        };
        reader.readAsText(file);
      }
    };
    
    input.click();
  };

  // Limpar todos os dados
  const clearAllData = () => {
    if (confirm('⚠️ ATENÇÃO: Esta ação irá apagar TODOS os seus trades! Tem certeza?')) {
      if (confirm('⚠️ ÚLTIMA CONFIRMAÇÃO: Todos os dados serão perdidos permanentemente!')) {
        setTrades([]);
        localStorage.removeItem('bitcoin-trades');
        localStorage.removeItem('bitcoin-trades-backup');
        console.log('🗑️ Todos os dados foram limpos');
        alert('Todos os dados foram removidos com sucesso!');
      }
    }
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              {viewMode === 'monthly' ? <Calendar className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />}
              {viewMode === 'monthly' ? 'Estatísticas do Mês' : 'Estatísticas do Dia'}
            </CardTitle>
            <div className="flex items-center gap-4">
              {/* Controles de visualização */}
              <div className="flex items-center gap-2">
                <Select value={viewMode} onValueChange={(value: 'monthly' | 'daily') => setViewMode(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                  </SelectContent>
                </Select>
                
                {viewMode === 'daily' && (
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-40"
                  />
                )}
              </div>

              {/* Indicador de salvamento */}
              <div className="flex items-center gap-2 text-sm">
                {isSaving ? (
                  <div className="flex items-center gap-1 text-blue-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    <span>Salvando...</span>
                  </div>
                ) : lastSaved ? (
                  <div className="flex items-center gap-1 text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span>Salvo às {lastSaved}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-500">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Dados locais</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportData}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={importData}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Restore
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllData}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {viewMode === 'monthly' ? monthlyStats.totalTrades : dailyStats.totalTrades}
              </div>
              <div className="text-sm text-gray-600">Total de Trades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {viewMode === 'monthly' ? monthlyStats.wins : dailyStats.wins}
              </div>
              <div className="text-sm text-gray-600">Wins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {viewMode === 'monthly' ? monthlyStats.losses : dailyStats.losses}
              </div>
              <div className="text-sm text-gray-600">Losses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {(viewMode === 'monthly' ? monthlyStats.winRate : dailyStats.winRate).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Taxa de Acerto</div>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">
                R$ {(viewMode === 'monthly' ? monthlyStats.totalProfit : dailyStats.totalProfit).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Lucro Total</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-600">
                R$ {(viewMode === 'monthly' ? monthlyStats.totalLoss : dailyStats.totalLoss).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Prejuízo Total</div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${(viewMode === 'monthly' ? monthlyStats.netResult : dailyStats.netResult) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(viewMode === 'monthly' ? monthlyStats.netResult : dailyStats.netResult).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Resultado Líquido</div>
            </div>
          </div>
          
          {/* Estatísticas por Risco */}
          <Separator className="my-4" />
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-center text-white">Assertividade por Risco</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-lg backdrop-blur-sm">
                <div className="text-sm text-green-300 mb-2">Risco Baixo</div>
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {(viewMode === 'monthly' ? monthlyStats.riskStats.baixo.winRate : dailyStats.riskStats.baixo.winRate).toFixed(1)}%
                </div>
                <div className="text-xs text-green-200/70">
                  {viewMode === 'monthly' ? monthlyStats.riskStats.baixo.wins : dailyStats.riskStats.baixo.wins}/{viewMode === 'monthly' ? monthlyStats.riskStats.baixo.total : dailyStats.riskStats.baixo.total} trades
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border border-yellow-700/30 rounded-lg backdrop-blur-sm">
                <div className="text-sm text-yellow-300 mb-2">Risco Médio</div>
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  {(viewMode === 'monthly' ? monthlyStats.riskStats.medio.winRate : dailyStats.riskStats.medio.winRate).toFixed(1)}%
                </div>
                <div className="text-xs text-yellow-200/70">
                  {viewMode === 'monthly' ? monthlyStats.riskStats.medio.wins : dailyStats.riskStats.medio.wins}/{viewMode === 'monthly' ? monthlyStats.riskStats.medio.total : dailyStats.riskStats.medio.total} trades
                </div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-700/30 rounded-lg backdrop-blur-sm">
                <div className="text-sm text-red-300 mb-2">Risco Alto</div>
                <div className="text-2xl font-bold text-red-400 mb-1">
                  {(viewMode === 'monthly' ? monthlyStats.riskStats.alto.winRate : dailyStats.riskStats.alto.winRate).toFixed(1)}%
                </div>
                <div className="text-xs text-red-200/70">
                  {viewMode === 'monthly' ? monthlyStats.riskStats.alto.wins : dailyStats.riskStats.alto.wins}/{viewMode === 'monthly' ? monthlyStats.riskStats.alto.total : dailyStats.riskStats.alto.total} trades
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adicionar Novo Trade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Novo Trade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="symbol">Símbolo</Label>
              <Input
                id="symbol"
                placeholder="Ex: BTCUSDT"
                value={newTrade.symbol}
                onChange={(e) => setNewTrade({...newTrade, symbol: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="entryPrice">Preço de Entrada</Label>
              <Input
                id="entryPrice"
                type="number"
                step="0.01"
                placeholder="Ex: 45000.00"
                value={newTrade.entryPrice}
                onChange={(e) => setNewTrade({...newTrade, entryPrice: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                placeholder="Ex: 0.001"
                value={newTrade.quantity}
                onChange={(e) => setNewTrade({...newTrade, quantity: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="risk">Risco</Label>
              <Select
                value={newTrade.risk}
                onValueChange={(value: 'baixo' | 'medio' | 'alto') => 
                  setNewTrade({...newTrade, risk: value})
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o risco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={addTrade} className="w-full">
                Adicionar Trade
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Input
              id="notes"
              placeholder="Anotações sobre o trade..."
              value={newTrade.notes}
              onChange={(e) => setNewTrade({...newTrade, notes: e.target.value})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum trade registrado ainda. Adicione seu primeiro trade acima!
            </div>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{trade.symbol}</span>
                        {trade.result && (
                          <Badge variant={trade.result === 'win' ? 'default' : 'destructive'}>
                            {trade.result === 'win' ? 'WIN' : 'LOSS'}
                          </Badge>
                        )}
                        {trade.risk && (
                          <Badge 
                            variant="outline" 
                            className={
                              trade.risk === 'baixo' ? 'border-green-500 text-green-600' :
                              trade.risk === 'medio' ? 'border-yellow-500 text-yellow-600' :
                              'border-red-500 text-red-600'
                            }
                          >
                            Risco {trade.risk === 'baixo' ? 'Baixo' : trade.risk === 'medio' ? 'Médio' : 'Alto'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(trade.date)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTrade(trade.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-600">Preço de Entrada</div>
                      <div className="font-medium">R$ {trade.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Quantidade</div>
                      <div className="font-medium">{trade.quantity}</div>
                    </div>
                    {trade.exitPrice !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">Preço de Saída</div>
                        <div className="font-medium">R$ {trade.exitPrice.toFixed(2)}</div>
                      </div>
                    )}
                    {trade.result && trade.exitPrice !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">Resultado</div>
                        <div className={`font-medium ${trade.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                          R$ {((trade.exitPrice - trade.entryPrice) * trade.quantity).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>

                  {trade.notes && (
                    <div className="mb-3">
                      <div className="text-sm text-gray-600">Observações</div>
                      <div className="text-sm">{trade.notes}</div>
                    </div>
                  )}

                  {!trade.result && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => openExitPriceModal(trade.id, 'win')}
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Marcar como WIN
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => openExitPriceModal(trade.id, 'loss')}
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        Marcar como LOSS
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Preço de Saída */}
      <Dialog open={exitPriceModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setExitPriceModal({
            isOpen: false,
            tradeId: null,
            result: null,
            exitPrice: ''
          });
        }
      }}>
        <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {exitPriceModal.result === 'win' ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-green-400">Marcar como WIN</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-red-500" />
                  <span className="text-red-400">Marcar como LOSS</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="exitPrice" className="text-gray-300">
                Preço de Saída
              </Label>
              <Input
                id="exitPrice"
                type="number"
                step="0.01"
                placeholder="Ex: 45000.00"
                value={exitPriceModal.exitPrice}
                onChange={(e) => setExitPriceModal(prev => ({ ...prev, exitPrice: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setExitPriceModal({
                  isOpen: false,
                  tradeId: null,
                  result: null,
                  exitPrice: ''
                })}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                onClick={confirmExitPrice}
                className={`${
                  exitPriceModal.result === 'win' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {exitPriceModal.result === 'win' ? (
                  <>
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Confirmar WIN
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 mr-1" />
                    Confirmar LOSS
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
