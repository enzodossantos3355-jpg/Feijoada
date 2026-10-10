import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Printer, MagnifyingGlass, ShoppingBag,
  X, WhatsappLogo, ArrowRight, Check, PencilSimple,
  LockKey, LockKeyOpen, CookingPot, CaretDown, CaretUp,
  Clock, CheckCircle, Warning
} from "@phosphor-icons/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentIcon, { PaymentBadge } from "@/components/PaymentIcon";
import { printReceipt } from "@/lib/print";

const STATUS_ORDER = ["Em Análise", "Novo", "Em Preparo", "Pronto", "Em Entrega", "Concluído"];

const STATUS_STYLES = {
  "Em Análise": "bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]/30 font-semibold",
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

export default function Pedidos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [dayStatus, setDayStatus] = useState({ is_open: true, day_state: "open" });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("Todos");
  const [paymentFilter, setPaymentFilter] = useState("Todos");

  // Contador de Produção colapsável
  const [productionExpanded, setProductionExpanded] = useState(true);

  // Modal Caixa
  const [caixaModalOpen, setCaixaModalOpen] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState("");

  // Modal Novo Pedido
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_type: "Entrega",
    address: "",
    zone_id: "",
    payment_method: "Pix",
    notes: "",
    items: [],
  });

  // Modal Editar Pedido (Em Análise ou existente)
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  useEffect(() => {
    const st = searchParams.get("status");
    if (st) setStatusFilter(st);
  }, [searchParams]);

  const loadData = async () => {
    try {
      const [ordRes, prodRes, zoneRes, custRes, dayRes] = await Promise.all([
        api.get("/orders"),
        api.get("/products"),
        api.get("/delivery-zones"),
        api.get("/customers").catch(() => ({ data: [] })),
        api.get("/day/status").catch(() => ({ data: { is_open: true, day_state: "open" } })),
      ]);
      setOrders(ordRes.data || []);
      setProducts((prodRes.data || []).filter((p) => p.active));
      setDeliveryZones(zoneRes.data || []);
      setSavedCustomers(custRes.data || []);
      setDayStatus(dayRes.data || { is_open: true, day_state: "open" });
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      if (["Pronto", "Em Entrega", "Concluído"].includes(nextStatus)) {
        toast.success(`Pedido atualizado para "${nextStatus}"! Mensagem enviada no WhatsApp do cliente.`);
      } else {
        toast.success(`Pedido atualizado para "${nextStatus}"`);
      }
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleApproveOrder = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/approve`);
      toast.success("Pedido aprovado com sucesso! Cliente notificado no WhatsApp.");
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: "Novo" } : o))
      );
    } catch {
      toast.error("Erro ao aprovar pedido");
    }
  };

  const handleSaveEditedOrder = async (e) => {
    e?.preventDefault();
    if (!editingOrder) return;

    try {
      const res = await api.put(`/orders/${editingOrder.order_id}`, editingOrder);
      toast.success("Pedido atualizado com sucesso!");
      setOrders((prev) =>
        prev.map((o) => (o.order_id === editingOrder.order_id ? res.data : o))
      );
      setEditOrderOpen(false);
      setEditingOrder(null);
    } catch {
      toast.error("Erro ao salvar alterações do pedido");
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!isCaixaOpen) {
      toast.error("O caixa do dia está fechado! Abra o caixa para registrar novos pedidos.");
      setCaixaModalOpen(true);
      return;
    }
    if (newOrder.items.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido");
      return;
    }

    try {
      const res = await api.post("/orders", newOrder);
      toast.success("Pedido criado com sucesso!");
      setOrders((prev) => [res.data, ...prev]);
      setNewOrderOpen(false);
      setNewOrder({
        customer_name: "",
        customer_phone: "",
        delivery_type: "Entrega",
        address: "",
        zone_id: "",
        payment_method: "Pix",
        notes: "",
        items: [],
      });
    } catch {
      toast.error("Falha ao criar pedido");
    }
  };

  const handleAddItem = (productId) => {
    const prod = products.find((p) => p.product_id === productId);
    if (!prod) return;

    setNewOrder((prev) => {
      const existing = prev.items.find((it) => it.product_id === productId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.product_id === productId ? { ...it, quantity: it.quantity + 1 } : it
          ),
        };
      }
      return {
        ...prev,
        items: [...prev.items, { product_id: prod.product_id, name: prod.name, price: prod.price, quantity: 1 }],
      };
    });
  };

  const handleRemoveItem = (productId) => {
    setNewOrder((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.product_id !== productId),
    }));
  };

  const inReviewCount = orders.filter((o) => o.status === "Em Análise").length;
  const isCaixaOpen = dayStatus.is_open && dayStatus.day_state !== "closed";

  const handleOpenCaixa = async (e) => {
    e?.preventDefault();
    try {
      const val = parseFloat(initialCashInput.replace(",", ".")) || 0;
      await api.post("/day/open", { initial_cash: val });
      toast.success("Caixa do dia ABERTO! Pedidos liberados.");
      setCaixaModalOpen(false);
      setInitialCashInput("");
      loadData();
    } catch {
      toast.error("Erro ao abrir caixa");
    }
  };

  const handleOpenNewOrderModal = () => {
    if (!isCaixaOpen) {
      toast.error("O caixa do dia está fechado! Abra o caixa para registrar pedidos.");
      setCaixaModalOpen(true);
      return;
    }
    setNewOrderOpen(true);
  };

  // Itens em produção na cozinha (Novo + Em Preparo)
  const productionOrders = orders.filter((o) => ["Novo", "Em Preparo"].includes(o.status));
  const productionItemsMap = new Map();
  for (const o of productionOrders) {
    for (const it of o.items || []) {
      const cur = productionItemsMap.get(it.name) || {
        name: it.name,
        count: 0,
        novo: 0,
        preparo: 0,
      };
      cur.count += it.quantity;
      if (o.status === "Novo") cur.novo += it.quantity;
      if (o.status === "Em Preparo") cur.preparo += it.quantity;
      productionItemsMap.set(it.name, cur);
    }
  }
  const productionItems = Array.from(productionItemsMap.values());

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "Todos" && o.status !== statusFilter) return false;
    if (deliveryFilter !== "Todos" && o.delivery_type !== deliveryFilter) return false;
    if (paymentFilter !== "Todos" && o.payment_method !== paymentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = o.customer_name?.toLowerCase().includes(q);
      const matchId = String(o.order_id || "").toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchPhone) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            Gestão de Pedidos
          </h1>
          <p className="text-sm text-stone-500">
            Controle do balcão, cozinha e expedição do delivery
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCaixaOpen && (
            <Button
              onClick={() => setCaixaModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 text-xs font-semibold animate-pulse"
            >
              <LockKey size={16} weight="bold" /> Abrir Caixa do Dia
            </Button>
          )}
          <Button
            onClick={handleOpenNewOrderModal}
            className="bg-[#C5533B] hover:bg-[#A9432D] text-white flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <Plus size={18} weight="bold" /> Novo Pedido (Balcão)
          </Button>
        </div>
      </div>

      {/* Banner de Aviso: Caixa Fechado */}
      {!isCaixaOpen && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg shrink-0">
              <LockKey size={24} weight="bold" />
            </div>
            <div>
              <p className="font-bold text-red-950 text-sm">
                O Caixa do Dia está FECHADO!
              </p>
              <p className="text-xs text-red-800">
                A IA no WhatsApp e o balcão estão impedidos de registrar pedidos até a abertura do caixa.
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

      {/* Contador de Produção da Cozinha (Itens a Fazer) */}
      {productionItems.length > 0 && (
        <Card className="border-stone-200 bg-white shadow-sm overflow-hidden">
          <div
            onClick={() => setProductionExpanded(!productionExpanded)}
            className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between cursor-pointer hover:bg-stone-100/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <CookingPot size={20} weight="duotone" className="text-[#C5533B]" />
              <span className="font-bold text-xs uppercase tracking-wider text-stone-800 font-display">
                Fila de Produção da Cozinha ({productionItems.reduce((acc, i) => acc + i.count, 0)} itens pendentes)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">
                {productionOrders.length} pedido{productionOrders.length > 1 ? "s" : ""}
              </span>
              {productionExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
            </div>
          </div>

          {productionExpanded && (
            <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {productionItems.map((item) => (
                <div
                  key={item.name}
                  className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 flex flex-col justify-between"
                >
                  <p className="font-semibold text-xs text-stone-900 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-stone-900 font-display">
                      {item.count}
                    </span>
                    <div className="flex gap-1 text-[10px]">
                      {item.novo > 0 && (
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                          {item.novo} novo
                        </span>
                      )}
                      {item.preparo > 0 && (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                          {item.preparo} prep.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Barra de Filtros por Status (Tabs Rápidas) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStatusFilter("Todos")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            statusFilter === "Todos"
              ? "bg-[#C5533B] text-white shadow-sm font-semibold"
              : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          Todos ({orders.length})
        </button>

        {/* Tab Destacada: Em Análise */}
        <button
          onClick={() => setStatusFilter("Em Análise")}
          className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
            statusFilter === "Em Análise"
              ? "bg-amber-500 text-white shadow-sm font-bold"
              : inReviewCount > 0
              ? "bg-amber-100 text-amber-900 border border-amber-300 font-semibold animate-pulse"
              : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
          }`}
        >
          <span>⏳ Em Análise</span>
          {inReviewCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                statusFilter === "Em Análise"
                  ? "bg-white text-amber-800"
                  : "bg-amber-500 text-white"
              }`}
            >
              {inReviewCount}
            </span>
          )}
        </button>

        {STATUS_ORDER.filter((s) => s !== "Em Análise").concat(["Cancelado"]).map((st) => {
          const count = orders.filter((o) => o.status === st).length;
          const active = statusFilter === st;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-[#C5533B] text-white shadow-sm font-semibold"
                  : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              {st} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Filtros Secundários de Busca, Pagamento e Entrega */}
      <Card className="border-stone-200 bg-white">
        <CardContent className="p-3.5 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-stone-400" size={18} />
            <Input
              placeholder="Buscar por cliente, telefone ou # pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-stone-50 border-stone-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-[150px] bg-stone-50 border-stone-200 text-xs">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Pagamentos</SelectItem>
                <SelectItem value="Pix">Pix</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">Cartão Débito</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="w-[130px] bg-stone-50 border-stone-200 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Tipos</SelectItem>
                <SelectItem value="Entrega">Entrega</SelectItem>
                <SelectItem value="Retirada">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      {loading ? (
        <div className="p-12 text-center text-stone-500">Carregando pedidos...</div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-stone-200 text-center py-12">
          <CardContent>
            <ShoppingBag size={48} className="mx-auto text-stone-300 mb-3" weight="duotone" />
            <p className="text-stone-600 font-medium">Nenhum pedido encontrado</p>
            <p className="text-sm text-stone-400">Aguardando novos pedidos do WhatsApp ou Balcão.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((ord) => {
            const isEmAnalise = ord.status === "Em Análise";
            const currentIdx = STATUS_ORDER.indexOf(ord.status);
            const nextStatus = currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

            return (
              <Card
                key={ord.order_id}
                className={`border transition-all ${
                  isEmAnalise
                    ? "border-amber-300 bg-amber-50/20 shadow-sm"
                    : "border-stone-200 hover:shadow-md"
                }`}
              >
                <CardContent className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Detalhes do Pedido */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-stone-800">
                        #{ord.order_id.slice(-6)}
                      </span>
                      <Badge className={STATUS_STYLES[ord.status] || "bg-stone-100 text-stone-700"}>
                        {ord.status}
                      </Badge>

                      {isEmAnalise && (
                        <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full border border-amber-300">
                          Anotado pela IA • Aguardando Aprovação
                        </span>
                      )}

                      <span className="text-xs text-stone-400">
                        {ord.created_at ? new Date(ord.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <Badge variant="outline" className="text-xs border-stone-200">
                        {ord.delivery_type}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{ord.customer_name || "Cliente"}</span>
                      {ord.customer_phone && (
                        <span className="text-xs text-stone-500 font-mono">({ord.customer_phone})</span>
                      )}
                    </div>

                    {ord.address && (
                      <p className="text-xs text-stone-600">
                        📍 {ord.address}
                      </p>
                    )}

                    {/* Itens */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(ord.items || []).map((it, idx) => (
                        <span key={idx} className="text-xs bg-stone-100 text-stone-800 px-2 py-1 rounded">
                          {it.quantity}x {it.name}
                        </span>
                      ))}
                    </div>

                    {ord.notes && (
                      <p className="text-xs italic text-amber-800 bg-amber-50 border border-amber-200/60 p-1.5 rounded inline-block">
                        {ord.notes}
                      </p>
                    )}
                  </div>

                  {/* Valor, Pagamento e Ações */}
                  <div className="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 flex-wrap">
                    <div className="text-left lg:text-right pr-2">
                      <div className="font-display text-xl font-bold text-stone-900">
                        {BRL(ord.total || 0)}
                      </div>
                      <div className="mt-1">
                        <PaymentBadge method={ord.payment_method} size="xs" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Botão de Chat WhatsApp */}
                      <Button
                        variant="outline"
                        size="sm"
                        title="Ver Atendimento no WhatsApp"
                        onClick={() => navigate("/atendimento")}
                        className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs gap-1"
                      >
                        <WhatsappLogo size={16} weight="fill" />
                        Chat
                      </Button>

                      {/* Botão de Editar */}
                      <Button
                        variant="outline"
                        size="sm"
                        title="Editar Detalhes do Pedido"
                        onClick={() => {
                          setEditingOrder({ ...ord });
                          setEditOrderOpen(true);
                        }}
                        className="text-stone-700 text-xs gap-1"
                      >
                        <PencilSimple size={14} />
                        Editar
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        title="Imprimir Comprovante"
                        onClick={() => printReceipt(ord)}
                      >
                        <Printer size={16} />
                      </Button>

                      {/* AÇÃO PRINCIPAL: Se for Em Análise -> Botão APROVAR PEDIDO */}
                      {isEmAnalise ? (
                        <Button
                          size="sm"
                          onClick={() => handleApproveOrder(ord.order_id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 text-xs shadow-sm"
                        >
                          <Check size={16} weight="bold" />
                          <span>Aprovar & Avisar Cliente</span>
                        </Button>
                      ) : nextStatus ? (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(ord.order_id, nextStatus)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span>{nextStatus}</span>
                          <ArrowRight size={14} />
                        </Button>
                      ) : null}

                      {ord.status !== "Cancelado" && ord.status !== "Concluído" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUpdateStatus(ord.order_id, "Cancelado")}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Editar Pedido */}
      {editingOrder && (
        <Dialog open={editOrderOpen} onOpenChange={setEditOrderOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Pedido #{editingOrder.order_id.slice(-6)}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveEditedOrder} className="space-y-4">
              <div>
                <Label className="text-xs text-stone-600">Nome do Cliente</Label>
                <Input
                  value={editingOrder.customer_name || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-stone-600">Telefone / WhatsApp</Label>
                <Input
                  value={editingOrder.customer_phone || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, customer_phone: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-stone-600">Endereço de Entrega</Label>
                <Input
                  value={editingOrder.address || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, address: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-600">Taxa de Entrega (R$)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editingOrder.delivery_fee || 0}
                    onChange={(e) => setEditingOrder({ ...editingOrder, delivery_fee: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-600">Forma de Pagamento</Label>
                  <Select
                    value={editingOrder.payment_method || "Pix"}
                    onValueChange={(val) => setEditingOrder({ ...editingOrder, payment_method: val })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                      <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-600">Observações</Label>
                <Input
                  value={editingOrder.notes || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditOrderOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Alterações</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Novo Pedido */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Pedido no Balcão</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-4">
            {savedCustomers.length > 0 && (
              <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                <Label className="text-xs text-stone-600 font-semibold block mb-1">
                  Selecionar Cliente Salvo (Opcional)
                </Label>
                <select
                  onChange={(e) => {
                    const c = savedCustomers.find((item) => item.customer_id === e.target.value);
                    if (c) {
                      setNewOrder((prev) => ({
                        ...prev,
                        customer_name: c.name || prev.customer_name,
                        customer_phone: c.phone || prev.customer_phone,
                        address: c.address || prev.address,
                        zone_id: c.delivery_zone_id || prev.zone_id,
                        notes: c.notes || prev.notes,
                      }));
                      toast.info(`Dados de "${c.name}" preenchidos!`);
                    }
                  }}
                  className="w-full p-2 text-xs border rounded-md bg-white border-stone-300"
                >
                  <option value="">Buscar na agenda de clientes salvos...</option>
                  {savedCustomers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.name} ({c.phone || "Sem tel"}) {c.address ? `• ${c.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome do Cliente</Label>
                <Input
                  required
                  placeholder="Ex: Carlos Silva"
                  value={newOrder.customer_name}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label>WhatsApp / Telefone</Label>
                <Input
                  placeholder="Ex: 11999998888"
                  value={newOrder.customer_phone}
                  onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de Atendimento</Label>
                <Select
                  value={newOrder.delivery_type}
                  onValueChange={(val) => setNewOrder({ ...newOrder, delivery_type: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrega">Entrega (Delivery)</SelectItem>
                    <SelectItem value="Retirada">Retirada no Balcão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={newOrder.payment_method}
                  onValueChange={(val) => setNewOrder({ ...newOrder, payment_method: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                    <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newOrder.delivery_type === "Entrega" && (
              <div className="space-y-1">
                <Label>Endereço de Entrega</Label>
                <Input
                  placeholder="Rua, número, complemento e bairro"
                  value={newOrder.address}
                  onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                />
              </div>
            )}

            {/* Adicionar Pratos */}
            <div className="space-y-2">
              <Label>Cardápio (Clique para adicionar)</Label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-stone-200 rounded-lg bg-stone-50">
                {products.map((p) => (
                  <Button
                    key={p.product_id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddItem(p.product_id)}
                    className="text-xs bg-white"
                  >
                    + {p.name} ({BRL(p.price)})
                  </Button>
                ))}
              </div>
            </div>

            {/* Itens Adicionados */}
            {newOrder.items.length > 0 && (
              <div className="space-y-2">
                <Label>Itens Selecionados</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {newOrder.items.map((it) => (
                    <div key={it.product_id} className="flex items-center justify-between bg-stone-100 p-2 rounded text-sm">
                      <span>{it.quantity}x {it.name} - {BRL(it.price * it.quantity)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500"
                        onClick={() => handleRemoveItem(it.product_id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Observações / Guarnições</Label>
              <Input
                placeholder="Ex: sem cebola, feijão por cima"
                value={newOrder.notes}
                onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOrderOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Pedido</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Abertura de Caixa no Pedidos */}
      <Dialog open={caixaModalOpen} onOpenChange={setCaixaModalOpen}>
        <DialogContent className="max-w-md bg-[#F9F8F6] border-stone-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-900 font-display">
              <LockKeyOpen size={24} weight="duotone" className="text-emerald-600" />
              Abertura do Caixa do Dia
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleOpenCaixa} className="space-y-4 py-2">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-900 leading-relaxed">
                Abra o caixa para poder registrar comandas no balcão e autorizar a IA a atender os clientes no WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pedidos_initial_cash" className="text-xs font-semibold text-stone-700">
                Fundo de Troco / Saldo Inicial em Dinheiro (R$)
              </Label>
              <Input
                id="pedidos_initial_cash"
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
