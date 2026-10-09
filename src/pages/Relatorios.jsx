import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChartBar, Sparkle, TrendUp, ShoppingBag, CurrencyDollar, Calendar,
  Printer, ArrowClockwise
} from "@phosphor-icons/react";
import PaymentIcon from "@/components/PaymentIcon";

export default function Relatorios() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/summary");
      setReport(res.data || {});
      if (res.data?.insights) {
        setInsights(res.data.insights);
      }
    } catch {
      toast.error("Erro ao carregar dados do relatório");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleGenerateInsights = async () => {
    if (!report) return;
    setLoadingInsights(true);
    try {
      const res = await api.post("/ai/report-insights", report);
      if (res.data?.insights) {
        setInsights(res.data.insights);
        toast.success("Insights operacionais atualizados com IA!");
      }
    } catch {
      toast.error("Falha ao gerar insights da IA");
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">Relatórios & Faturamento</h1>
          <p className="text-sm text-stone-500">Métricas de vendas, ticket médio e análise de desempenho</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReport} className="flex items-center gap-1.5">
            <ArrowClockwise size={16} /> Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateInsights}
            disabled={loadingInsights}
            className="flex items-center gap-1.5"
          >
            <Sparkle size={16} weight="fill" />
            {loadingInsights ? "Analisando..." : "Gerar Análise IA"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-500">Calculando indicadores...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-stone-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-stone-400">Faturamento Hoje</p>
                  <p className="font-display text-2xl font-bold text-stone-900 mt-1">
                    {BRL(report?.revenue || report?.period_revenue || 0)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                  <CurrencyDollar size={22} weight="duotone" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-stone-400">Total de Pedidos</p>
                  <p className="font-display text-2xl font-bold text-stone-900 mt-1">
                    {report?.total_orders || report?.today_orders || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <ShoppingBag size={22} weight="duotone" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-stone-400">Ticket Médio</p>
                  <p className="font-display text-2xl font-bold text-stone-900 mt-1">
                    {BRL(report?.avg_ticket || 0)}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <TrendUp size={22} weight="duotone" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-stone-200">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-stone-400">Pedidos Entregues</p>
                  <p className="font-display text-2xl font-bold text-stone-900 mt-1">
                    {report?.valid_orders || report?.completed_orders || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
                  <ChartBar size={22} weight="duotone" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights da IA */}
          {insights && (
            <Card className="border-[#C5533B]/20 bg-[#FDF6EA]/40">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-[#C5533B] font-semibold text-sm">
                  <Sparkle size={18} weight="fill" />
                  <span>Análise e Recomendações da Consultoria com IA (Gemini)</span>
                </div>
                <div className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">
                  {insights}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Formas de Pagamento e Mais Vendidos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formas de Pagamento */}
            <Card className="border-stone-200">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-stone-900 text-base">Vendas por Forma de Pagamento</h3>
                <div className="space-y-3">
                  {Object.entries(report?.by_payment || {}).map(([method, total]) => (
                    <div key={method} className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50">
                      <div className="flex items-center gap-2">
                        <PaymentIcon method={method} size={20} />
                        <span className="text-sm font-medium text-stone-800">{method}</span>
                      </div>
                      <span className="font-mono font-semibold text-stone-900">{BRL(total)}</span>
                    </div>
                  ))}
                  {(!report?.by_payment || Object.keys(report.by_payment).length === 0) && (
                    <p className="text-sm text-stone-400 text-center py-4">Nenhum pagamento registrado no período.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pratos Mais Vendidos */}
            <Card className="border-stone-200">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold text-stone-900 text-base">Pratos Mais Pedidos</h3>
                <div className="space-y-3">
                  {(report?.top_products || []).map((prod, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{idx + 1}º</Badge>
                        <span className="text-sm font-medium text-stone-800">{prod.name}</span>
                      </div>
                      <span className="text-xs bg-stone-200 text-stone-700 px-2 py-1 rounded font-semibold">
                        {prod.quantity || prod.count} saídas
                      </span>
                    </div>
                  ))}
                  {(!report?.top_products || report.top_products.length === 0) && (
                    <p className="text-sm text-stone-400 text-center py-4">Nenhum prato vendido registrado ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
