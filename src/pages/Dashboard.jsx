import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ShoppingBag, TrendingUp, Users, Bot, Sparkles } from "lucide-react";

export function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    api.get("/orders").then(({ data }) => setOrders(data || [])).catch(() => {});
  }, []);

  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.total || 0), 0);

  const generateAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const { data } = await api.post("/ai/report-insights", {
        total_orders: orders.length,
        revenue: totalRevenue,
      });
      setInsights(data.insights);
    } catch (e) {
      setInsights("Erro ao gerar análise da IA.");
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral do Balcão</h1>
        <p className="text-slate-500 text-sm">Resumo dos pedidos e inteligência do restaurante em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Faturamento Hoje</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">R$ {totalRevenue.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total de Pedidos</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{orders.length}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Atendente IA</p>
            <p className="text-sm font-semibold text-emerald-600 mt-1">Ativa no Server (Gemini 3.1 Flash)</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Bot className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <h2 className="font-bold text-lg">Consultor IA - Análise do Dia</h2>
          </div>
          <button
            onClick={generateAIInsights}
            disabled={loadingInsights}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loadingInsights ? "Analisando..." : "Gerar Relatório IA"}
          </button>
        </div>
        <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">
          {insights || "Clique no botão acima para a IA analisar o faturamento e dar sugestões de vendas para a marmitaria."}
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
