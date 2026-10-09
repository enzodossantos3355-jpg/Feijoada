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
  Plus, Printer, MagnifyingGlass, CheckCircle, Clock, Truck, ShoppingBag,
  ForkKnife, X, WhatsappLogo, ArrowRight
} from "@phosphor-icons/react";
import PaymentIcon, { PaymentBadge } from "@/components/PaymentIcon";
import { printReceipt } from "@/lib/print";

const STATUS_ORDER = ["Novo", "Em Preparo", "Pronto", "Em Entrega", "Concluído"];
const STATUS_STYLES = {
  Novo: "bg-[#EFF4F8] text-[#4A6E8C] border-[#4A6E8C]/20",
  "Em Preparo": "bg-[#FDF6EA] text-[#D99A45] border-[#D99A45]/20",
  Pronto: "bg-[#EEF3F0] text-[#6B8E7B] border-[#6B8E7B]/20",
  "Em Entrega": "bg-[#FCEEE6] text-[#C5533B] border-[#C5533B]/20",
  Concluído: "bg-stone-100 text-stone-700 border-stone-300",
  Cancelado: "bg-[#FCEDED] text-[#B94B4B] border-[#B94B4B]/20",
};

export default function Pedidos() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("Todos");

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

  const loadData = async () => {
    try {
      const [ordRes, prodRes, zoneRes] = await Promise.all([
        api.get("/orders"),
        api.get("/products"),
        api.get("/delivery-zones"),
      ]);
      setOrders(ordRes.data || []);
      setProducts((prodRes.data || []).filter((p) => p.active));
      setDeliveryZones(zoneRes.data || []);
    } catch {
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId, nextStatus) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      toast.success(`Pedido atualizado para "${nextStatus}"`);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
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

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "Todos" && o.status !== statusFilter) return false;
    if (deliveryFilter !== "Todos" && o.delivery_type !== deliveryFilter) return false;
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
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">Gestão de Pedidos</h1>
          <p className="text-sm text-stone-500">Controle do balcão, cozinha e expedição do delivery</p>
        </div>
        <Button onClick={() => setNewOrderOpen(true)} className="flex items-center gap-2">
          <Plus size={18} weight="bold" /> Novo Pedido (Balcão)
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-stone-200">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-stone-400" size={18} />
            <Input
              placeholder="Buscar por cliente, telefone ou # pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Status</SelectItem>
                {STATUS_ORDER.concat(["Cancelado"]).map((st) => (
                  <SelectItem key={st} value={st}>{st}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Tipos</SelectItem>
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
            const currentIdx = STATUS_ORDER.indexOf(ord.status);
            const nextStatus = currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

            return (
              <Card key={ord.order_id} className="border-stone-200 hover:shadow-md transition-shadow">
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
                      <span className="text-xs text-stone-400">
                        {ord.created_at ? new Date(ord.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <Badge variant="outline" className="text-xs border-stone-200">
                        {ord.delivery_type}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">{ord.customer_name || "Cliente Balcão"}</span>
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
                      <p className="text-xs italic text-amber-700 bg-amber-50 p-1.5 rounded inline-block">
                        Obs: {ord.notes}
                      </p>
                    )}
                  </div>

                  {/* Valor, Pagamento e Ações */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                    <div className="text-left lg:text-right">
                      <div className="font-display text-xl font-bold text-stone-900">
                        {BRL(ord.total || 0)}
                      </div>
                      <div className="mt-1">
                        <PaymentBadge method={ord.payment_method} size="xs" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        title="Imprimir Comprovante"
                        onClick={() => printReceipt(ord)}
                      >
                        <Printer size={16} />
                      </Button>

                      {nextStatus && (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(ord.order_id, nextStatus)}
                          className="flex items-center gap-1.5"
                        >
                          <span>{nextStatus}</span>
                          <ArrowRight size={14} />
                        </Button>
                      )}

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

      {/* Modal Novo Pedido */}
      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Pedido no Balcão</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateOrder} className="space-y-4">
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
    </div>
  );
}
