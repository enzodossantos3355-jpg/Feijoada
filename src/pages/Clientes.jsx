import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Users,
  Plus,
  MagnifyingGlass,
  WhatsappLogo,
  PencilSimple,
  Trash,
  Phone,
  MapPin,
  ShoppingBag,
  UserPlus,
  ArrowSquareOut,
  Clock,
  CurrencyDollar,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function Clientes() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal Novo / Editar Cliente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    delivery_zone_id: "",
    notes: "",
  });

  const loadData = async () => {
    try {
      const [custRes, zoneRes] = await Promise.all([
        api.get("/customers"),
        api.get("/delivery-zones"),
      ]);
      setCustomers(custRes.data || []);
      setZones(zoneRes.data || []);
    } catch {
      toast.error("Erro ao carregar lista de clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setForm({
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        delivery_zone_id: customer.delivery_zone_id || "",
        notes: customer.notes || "",
      });
    } else {
      setEditingCustomer(null);
      setForm({
        name: "",
        phone: "",
        address: "",
        delivery_zone_id: "",
        notes: "",
      });
    }
    setModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios!");
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        const res = await api.put(`/customers/${editingCustomer.customer_id}`, form);
        setCustomers((prev) =>
          prev.map((c) => (c.customer_id === editingCustomer.customer_id ? res.data : c))
        );
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const res = await api.post("/customers", form);
        setCustomers((prev) => [res.data, ...prev]);
        toast.success("Cliente salvo com sucesso!");
      }
      setModalOpen(false);
    } catch {
      toast.error("Erro ao salvar dados do cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId, name) => {
    if (!confirm(`Deseja realmente excluir o cadastro de "${name}"?`)) return;

    try {
      await api.delete(`/customers/${customerId}`);
      setCustomers((prev) => prev.filter((c) => c.customer_id !== customerId));
      toast.success("Cliente removido com sucesso");
    } catch {
      toast.error("Erro ao excluir cliente");
    }
  };

  const openWhatsAppChat = (phone) => {
    const clean = (phone || "").replace(/\D/g, "");
    if (!clean) {
      toast.error("Telefone inválido para WhatsApp");
      return;
    }
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    window.open(`https://wa.me/${full}`, "_blank");
  };

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = (c.name || "").toLowerCase().includes(q);
    const phoneMatch = (c.phone || "").toLowerCase().includes(q);
    const addressMatch = (c.address || "").toLowerCase().includes(q);
    const notesMatch = (c.notes || "").toLowerCase().includes(q);
    return nameMatch || phoneMatch || addressMatch || notesMatch;
  });

  const totalSpentAll = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0);
  const totalOrdersAll = customers.reduce((acc, c) => acc + (c.orders_count || 0), 0);
  const repeatCustomers = customers.filter((c) => (c.orders_count || 0) > 1).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            Clientes Salvos
          </h1>
          <p className="text-sm text-stone-500">
            Agenda de clientes do balcão e WhatsApp com endereços e histórico
          </p>
        </div>

        <Button
          onClick={() => handleOpenModal()}
          className="bg-[#C5533B] hover:bg-[#A9432D] text-white flex items-center gap-2 shadow-sm font-medium"
        >
          <UserPlus size={18} weight="bold" />
          <span>Cadastrar Novo Cliente</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-stone-500 tracking-wider">
                Total de Clientes
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {customers.length}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Cadastrados no sistema</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
              <Users size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-stone-500 tracking-wider">
                Clientes Recorrentes
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {repeatCustomers}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">Fizeram mais de 1 pedido</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
              <ShoppingBag size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-stone-500 tracking-wider">
                Total em Pedidos
              </p>
              <p className="text-2xl font-bold text-stone-900 mt-1 font-display">
                {totalOrdersAll} pedidos
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                {totalSpentAll > 0 ? `Total: ${BRL(totalSpentAll)}` : "Histórico integrado"}
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
              <CurrencyDollar size={24} weight="duotone" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca & Filtros */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-stone-400" size={18} />
            <Input
              placeholder="Buscar por nome, telefone, endereço ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-stone-50/50"
            />
          </div>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="text-xs">
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      {loading ? (
        <div className="p-12 text-center text-stone-500">Carregando lista de clientes...</div>
      ) : filtered.length === 0 ? (
        <Card className="border-stone-200 text-center py-12 bg-white">
          <CardContent>
            <Users size={48} className="mx-auto text-stone-300 mb-3" weight="duotone" />
            <p className="text-stone-700 font-semibold text-base">Nenhum cliente encontrado</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto mt-1">
              {search
                ? "Nenhum resultado corresponde à sua pesquisa."
                : "Os clientes serão salvos automaticamente quando fizerem pedidos no WhatsApp ou balcão, ou você pode cadastrar manualmente."}
            </p>
            <Button
              onClick={() => handleOpenModal()}
              className="mt-4 bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1.5"
            >
              <Plus size={16} weight="bold" /> Cadastrar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const zoneName = zones.find((z) => z.zone_id === c.delivery_zone_id)?.name;

            return (
              <Card
                key={c.customer_id}
                className="border border-stone-200 hover:border-stone-300 transition-all hover:shadow-md bg-white flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-3">
                  {/* Top: Nome e Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-stone-900 text-base truncate">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                        <Phone size={14} className="text-stone-400 shrink-0" />
                        <span className="font-mono">{c.phone || "Sem telefone"}</span>
                      </div>
                    </div>
                    {(c.orders_count || 0) > 0 && (
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] shrink-0 font-medium">
                        {c.orders_count} {c.orders_count === 1 ? "pedido" : "pedidos"}
                      </Badge>
                    )}
                  </div>

                  {/* Endereço */}
                  <div className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-100 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={15} className="text-[#C5533B] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800">
                          {c.address || "Endereço não cadastrado"}
                        </p>
                        {zoneName && (
                          <span className="text-[11px] text-stone-500">
                            Região: <strong>{zoneName}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {c.notes && (
                      <p className="text-[11px] italic text-amber-800 pt-1 border-t border-stone-200/60">
                        Obs: {c.notes}
                      </p>
                    )}
                  </div>

                  {/* Estatísticas */}
                  {(c.total_spent || 0) > 0 && (
                    <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                      <span>Total consumido:</span>
                      <span className="font-bold text-stone-900 font-mono">
                        {BRL(c.total_spent)}
                      </span>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {c.phone && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWhatsAppChat(c.phone)}
                          className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs gap-1 h-8 px-2.5"
                          title="Abrir WhatsApp com este cliente"
                        >
                          <WhatsappLogo size={15} weight="fill" />
                          <span>WhatsApp</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/pedidos")}
                        className="text-stone-700 border-stone-200 hover:bg-stone-50 text-xs gap-1 h-8 px-2.5"
                        title="Ver ou criar pedidos"
                      >
                        <ShoppingBag size={14} />
                        <span>Pedidos</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenModal(c)}
                        className="h-8 w-8 text-stone-500 hover:text-stone-900"
                        title="Editar cliente"
                      >
                        <PencilSimple size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCustomer(c.customer_id, c.name)}
                        className="h-8 w-8 text-stone-400 hover:text-red-600"
                        title="Excluir cliente"
                      >
                        <Trash size={15} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Novo / Editar Cliente */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg text-stone-900">
              {editingCustomer ? `Editar Cliente: ${editingCustomer.name}` : "Cadastrar Novo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCustomer} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-stone-700 font-semibold">Nome Completo *</Label>
              <Input
                required
                placeholder="Ex: João da Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Telefone / WhatsApp *</Label>
              <Input
                required
                placeholder="Ex: (11) 98765-4321"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Usado para identificar o cliente quando ele mandar mensagem no WhatsApp.
              </span>
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Endereço de Entrega Principal</Label>
              <Input
                placeholder="Ex: Rua das Palmeiras, 120, Apto 4"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1"
              />
            </div>

            {zones.length > 0 && (
              <div>
                <Label className="text-xs text-stone-700 font-semibold">Região / Bairro de Entrega</Label>
                <select
                  value={form.delivery_zone_id}
                  onChange={(e) => setForm({ ...form, delivery_zone_id: e.target.value })}
                  className="w-full mt-1 p-2 text-sm border rounded-lg bg-white border-stone-300"
                >
                  <option value="">Selecione uma região (opcional)...</option>
                  {zones.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.name} ({BRL(z.fee)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Observações / Preferências</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Não gosta de cebola, tocar interfone 12"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#C5533B] hover:bg-[#A9432D] text-white"
              >
                {submitting ? "Salvando..." : editingCustomer ? "Atualizar Cliente" : "Salvar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
