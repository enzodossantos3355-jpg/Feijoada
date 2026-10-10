import { useEffect, useState } from "react";
import api, { BRL } from "@/lib/api";
import {
  ShoppingBag,
  TrendUp,
  Users,
  Robot,
  Sparkle,
  WhatsappLogo,
  Plus,
  ArrowRight,
  Clock,
  LockKey,
  LockKeyOpen,
  CurrencyCircleDollar,
  CheckCircle,
  PencilSimple,
  Printer,
  CalendarCheck,
  Receipt,
  WarningCircle,
} from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import PaymentIcon, { PaymentBadge } from "@/components/PaymentIcon";

const STATUS_STYLES = {
  "Em Análise": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30 font-semibold",
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

export function Dashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [dayStatus, setDayStatus] = useState({
    is_open: true,
    day_state: "open",
    revenue: 0,
    open_orders: 0,
    total_orders: 0,
    initial_cash_balance: 0,
    by_payment: [],
  });
  const [waStatus, setWaStatus] = useState({});
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Modal Caixa
  const [caixaModalOpen, setCaixaModalOpen] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState("");
  const [closingCaixa, setClosingCaixa] = useState(false);

  const loadData = () => {
    Promise.all([
      api.get("/orders").catch(() => ({ data: [] })),
      api.get("/day/status").catch(() => ({ data: { is_open: true, day_state: "open" } })),
      api.get("/whatsapp/status").catch(() => ({ data: {} })),
    ]).then(([ordersRes, dayRes, waRes]) => {
      setOrders(ordersRes.data || []);
      setDayStatus(dayRes.data || { is_open: true, day_state: "open" });
      setWaStatus(waRes.data || {});
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCaixa = async (e) => {
    e?.preventDefault();
    try {
      const val = parseFloat(initialCashInput.replace(",", ".")) || 0;
      await api.post("/day/open", { initial_cash: val });
      toast.success("Caixa do dia ABERTO! A IA e novos pedidos estão ativos.");
      setCaixaModalOpen(false);
      setInitialCashInput("");
      loadData();
    } catch {
      toast.error("Erro ao abrir caixa");
    }
  };

  const handleCloseCaixa = async () => {
    setClosingCaixa(true);
    try {
      const res = await api.post("/day/close");
      toast.success(`Caixa finalizado! Faturamento: ${BRL(res.data?.revenue || 0)}`);
      setCaixaModalOpen(false);
      loadData();
    } catch {
      toast.error("Erro ao fechar caixa");
    } finally {
      setClosingCaixa(false);
    }
  };

  const handleApproveOrder = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/approve`);
      toast.success("Pedido aprovado! Notificação enviada no WhatsApp do cliente.");
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: "Novo" } : o))
      );
    } catch {
      toast.error("Erro ao aprovar pedido");
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!window.confirm("Deseja realmente RECUSAR este pedido?")) return;
    try {
      await api.patch(`/orders/${orderId}/status`, { status: "Cancelado" });
      toast.info("Pedido recusado/cancelado.");
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: "Cancelado" } : o))
      );
    } catch {
      toast.error("Erro ao recusar pedido");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Tem certeza que deseja EXCLUIR este pedido permanentemente?")) return;
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success("Pedido excluído permanentemente!");
      setOrders((prev) => prev.filter((o) => o.order_id !== orderId));
    } catch {
      toast.error("Erro ao excluir pedido");
    }
  };

  const generateAIInsights = async () => {
    setLoadingInsights(true);
    try {
      const { data } = await api.post("/ai/report-insights", {
        total_orders: orders.length,
        revenue: totalRevenue,
      });
      setInsights(data.insights);
    } catch {
      setInsights("Erro ao gerar análise da IA.");
    } finally {
      setLoadingInsights(false);
    }
  };

  const isCaixaOpen = dayStatus.is_open && dayStatus.day_state !== "closed";
  const isWaConnected = waStatus.is_connected || waStatus.status === "connected";

  const inReviewOrders = orders.filter((o) => o.status === "Em Análise");
  const activeOrders = orders.filter((o) =>
    ["Em Análise", "Novo", "Em Preparo", "Pronto", "Em Entrega"].includes(o.status)
  );
  const validOrders = orders.filter((o) => o.status !== "Cancelado");
  const totalRevenue = validOrders.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const avgTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;
  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            Visão Geral do Balcão
          </h1>
          <p className="text-stone-500 text-sm">
            Gestão operacional de pedidos, caixa do dia e atendimento WhatsApp
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Caixa */}
          <Button
            onClick={() => setCaixaModalOpen(true)}
            variant={isCaixaOpen ? "outline" : "default"}
            className={
              isCaixaOpen
                ? "border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs gap-1.5 font-semibold"
                : "bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 font-semibold animate-pulse"
            }
          >
            {isCaixaOpen ? (
              <>
                <LockKeyOpen size={16} weight="bold" className="text-emerald-600" />
                Caixa Aberto
              </>
            ) : (
              <>
                <LockKey size={16} weight="bold" />
                Abrir Caixa do Dia
              </>
            )}
          </Button>

          <Button
            onClick={() => {
              if (!isCaixaOpen) {
                toast.error("O caixa está fechado! Abra o caixa para registrar novos pedidos.");
                setCaixaModalOpen(true);
                return;
              }
              navigate("/pedidos");
            }}
            className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1.5 shadow-sm font-medium"
          >
            <Plus size={16} weight="bold" /> Novo Pedido
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate("/atendimento")}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs gap-1.5"
          >
            <WhatsappLogo size={16} weight="fill" /> Chats WhatsApp
          </Button>
        </div>
      </div>

      {/* Alerta se o Caixa estiver Fechado */}
      {!isCaixaOpen && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-lg shrink-0">
              <LockKey size={24} weight="bold" />
            </div>
            <div>
              <p className="font-bold text-red-950 text-sm">
                O Caixa do Dia está FECHADO!
              </p>
              <p className="text-xs text-red-800">
                A IA no WhatsApp e o balcão estão pausados para novos pedidos. Abra o caixa para iniciar os atendimentos.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setCaixaModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs shrink-0 font-semibold gap-1.5"
          >
            <LockKeyOpen size={16} weight="bold" /> Abrir Caixa Agora
          </Button>
        </div>
      )}

      {/* Destaque Prioritário: PEDIDOS EM ANÁLISE DA IA NO WHATSAPP */}
      {inReviewOrders.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm text-xl font-bold">
                ⏳
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-base text-amber-950 font-display">
                    Pedidos em Análise da IA no WhatsApp ({inReviewOrders.length})
                  </h2>
                  <Badge className="bg-amber-500 text-white text-[11px] font-bold">
                    Ação Necessária
                  </Badge>
                </div>
                <p className="text-xs text-amber-900 mt-0.5">
                  A IA anotou os itens com o cliente. Revise os detalhes e aprove para enviar para a cozinha e notificar o cliente!
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => navigate("/pedidos?status=Em%20Análise")}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0 font-medium"
            >
              Ver Todos em Pedidos <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {inReviewOrders.map((ord) => (
              <div
                key={ord.order_id}
                className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                      {ord.order_id.replace("ord_", "").toUpperCase()}
                    </span>
                    <Badge className={STATUS_STYLES["Em Análise"]}>Em Análise</Badge>
                  </div>

                  <p className="font-bold text-stone-900 text-sm">{ord.customer_name}</p>
                  <p className="text-xs text-stone-500">{ord.customer_phone || "WhatsApp"}</p>

                  <div className="mt-2.5 pt-2 border-t border-stone-100 space-y-1">
                    {(ord.items || []).map((it, idx) => (
                      <p key={idx} className="text-xs text-stone-700 truncate">
                        • <span className="font-semibold">{it.quantity}x</span> {it.name}
                        {it.additionals?.length > 0 && (
                          <span className="text-stone-400 text-[11px]">
                            {" "}(+{it.additionals.map((a) => a.name).join(", ")})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-stone-100">
                    <span className="text-stone-500">{ord.delivery_type}:</span>
                    <span className="font-bold text-stone-900 text-sm font-display">
                      {BRL(ord.total || 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-2 flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApproveOrder(ord.order_id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1 shadow-sm"
                  >
                    <CheckCircle size={15} weight="bold" /> Aprovar Pedido
                  </Button>
                  <div className="flex items-center gap-1.5 w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectOrder(ord.order_id)}
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50 text-[11px] font-semibold h-7"
                    >
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/pedidos`)}
                      className="border-stone-300 text-stone-700 text-[11px] h-7 px-2"
                      title="Editar / Gerenciar Pedido"
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteOrder(ord.order_id)}
                      className="text-red-500 hover:bg-red-50 text-[11px] h-7 px-2"
                      title="Excluir Pedido"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento */}
        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                Faturamento Hoje
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {BRL(dayStatus.revenue || totalRevenue)}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Vendas acumuladas</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
              <TrendUp size={26} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        {/* Total de Pedidos */}
        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                Total de Pedidos
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {orders.length}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {activeOrders.length} em andamento
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl">
              <ShoppingBag size={26} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                Ticket Médio
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {BRL(avgTicket)}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Por pedido concluído</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
              <Receipt size={26} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        {/* Status Caixa do Dia */}
        <Card
          onClick={() => setCaixaModalOpen(true)}
          className={`border shadow-sm cursor-pointer transition-all hover:border-[#C5533B]/50 ${
            isCaixaOpen ? "bg-white border-stone-200" : "bg-red-50/50 border-red-200"
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-semibold uppercase tracking-wider">
                Caixa do Dia
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCaixaOpen ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <p className="text-lg font-bold text-stone-900 font-display">
                  {isCaixaOpen ? "Aberto" : "Fechado"}
                </p>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">Clique para gerenciar</p>
            </div>
            <div
              className={`p-3 rounded-2xl ${
                isCaixaOpen ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {isCaixaOpen ? (
                <LockKeyOpen size={26} weight="duotone" />
              ) : (
                <LockKey size={26} weight="duotone" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caixa do Dia: Detalhes e Formas de Pagamento */}
      {isCaixaOpen && dayStatus.by_payment?.length > 0 && (
        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <CurrencyCircleDollar size={20} weight="duotone" className="text-[#C5533B]" />
                <h3 className="font-bold text-sm text-stone-900 font-display">
                  Arrecadação do Caixa por Forma de Pagamento
                </h3>
              </div>
              <span className="text-xs text-stone-500">
                Troco inicial na gaveta: {BRL(dayStatus.initial_cash_balance || 0)}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dayStatus.by_payment.map((pay) => (
                <div key={pay.method} className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <PaymentIcon method={pay.method} size={16} />
                    <span className="text-xs font-semibold text-stone-700">{pay.method}</span>
                  </div>
                  <p className="text-lg font-bold text-stone-900 font-display">
                    {BRL(pay.total || 0)}
                  </p>
                  <p className="text-[11px] text-stone-400">{pay.count} pagamento{pay.count > 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção: Pedidos Recentes do Balcão */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-stone-100">
          <div>
            <h2 className="font-bold text-lg text-stone-900 font-display">
              Pedidos Recentes do Balcão
            </h2>
            <p className="text-xs text-stone-500">Últimas comandas registradas no PDV e WhatsApp</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/pedidos")}
            className="border-stone-300 text-stone-700 text-xs font-medium"
          >
            Ver Fila Completa <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-10 text-stone-400">
            <ShoppingBag size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum pedido realizado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Pedido</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Itens</th>
                  <th className="py-2.5 px-3">Pagamento</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentOrders.map((ord) => (
                  <tr
                    key={ord.order_id}
                    onClick={() => navigate("/pedidos")}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-stone-800">
                      {ord.order_id.replace("ord_", "").toUpperCase()}
                    </td>
                    <td className="py-3 px-3 font-medium text-stone-900">
                      {ord.customer_name}
                      <span className="block text-[11px] text-stone-400 font-normal">
                        {ord.delivery_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-stone-600 max-w-xs truncate">
                      {(ord.items || []).map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                    </td>
                    <td className="py-3 px-3">
                      <PaymentBadge method={ord.payment_method} />
                    </td>
                    <td className="py-3 px-3">
                      <Badge className={STATUS_STYLES[ord.status] || "bg-stone-100 text-stone-700"}>
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-stone-900 font-display">
                      {BRL(ord.total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consultor IA Card */}
      <div className="bg-stone-900 rounded-2xl p-6 text-white shadow-md border border-stone-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
              <Sparkle size={24} weight="fill" />
            </div>
            <div>
              <h2 className="font-bold text-lg font-display">Consultor IA - Análise da Marmitaria</h2>
              <p className="text-xs text-stone-400">Inteligência Gemini para dicas de vendas, ticket médio e giro</p>
            </div>
          </div>
          <Button
            onClick={generateAIInsights}
            disabled={loadingInsights}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold text-xs gap-1.5 shadow-sm"
          >
            <Sparkle size={15} weight="bold" />
            {loadingInsights ? "Analisando dados..." : "Gerar Análise com IA"}
          </Button>
        </div>
        <p className="text-stone-300 text-sm whitespace-pre-line leading-relaxed font-sans">
          {insights || "Clique no botão acima para a IA analisar o faturamento e dar sugestões estratégicas para o seu restaurante."}
        </p>
      </div>

      {/* Modal Caixa do Dia */}
      <Dialog open={caixaModalOpen} onOpenChange={setCaixaModalOpen}>
        <DialogContent className="max-w-md bg-[#F9F8F6] border-stone-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-900 font-display">
              <CurrencyCircleDollar size={24} weight="duotone" className="text-[#C5533B]" />
              {isCaixaOpen ? "Controle do Caixa do Dia" : "Abertura do Caixa do Dia"}
            </DialogTitle>
          </DialogHeader>

          {isCaixaOpen ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-800">Status Atual</p>
                    <p className="text-lg font-bold text-emerald-950 font-display">🟢 Caixa Aberto</p>
                  </div>
                  <LockKeyOpen size={32} weight="duotone" className="text-emerald-600" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600 pt-3 border-t border-emerald-200">
                  <div>
                    <span className="font-semibold text-stone-800">Aberto às:</span>{" "}
                    {dayStatus.day_opened_at ? new Date(dayStatus.day_opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Hoje"}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-800">Faturamento:</span>{" "}
                    {BRL(dayStatus.revenue || totalRevenue)}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-800">Pedidos:</span>{" "}
                    {dayStatus.total_orders || orders.length}
                  </div>
                  <div>
                    <span className="font-semibold text-stone-800">Troco Inicial:</span>{" "}
                    {BRL(dayStatus.initial_cash_balance || 0)}
                  </div>
                </div>
              </div>

              <p className="text-xs text-stone-500">
                Ao fechar o caixa, os pedidos do período serão arquivados e a IA ficará em pausa para novas comandas até uma nova abertura.
              </p>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCaixaModalOpen(false)}
                  className="border-stone-300 text-stone-700"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleCloseCaixa}
                  disabled={closingCaixa}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {closingCaixa ? "Fechando..." : "Fechar Caixa & Finalizar Dia"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleOpenCaixa} className="space-y-4 py-2">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <LockKey size={28} weight="duotone" className="text-amber-700 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-950">Caixa Fechado</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Abra o caixa para autorizar a IA a atender pedidos no WhatsApp e liberar o registro no PDV.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initial_cash" className="text-xs font-semibold text-stone-700">
                  Fundo de Troco / Saldo Inicial em Dinheiro (R$)
                </Label>
                <Input
                  id="initial_cash"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value)}
                  className="bg-white border-stone-300"
                  autoFocus
                />
                <p className="text-[11px] text-stone-500">Opcional. Valor para troco na gaveta.</p>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCaixaModalOpen(false)}
                  className="border-stone-300 text-stone-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                >
                  <LockKeyOpen size={16} weight="bold" /> Abrir Caixa Agora
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Dashboard;
