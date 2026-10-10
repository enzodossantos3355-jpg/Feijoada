import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { BRL } from "@/lib/api";
import {
  House,
  ShoppingBag,
  WhatsappLogo,
  Users,
  ForkKnife,
  ChartBar,
  Archive,
  Gear,
  SignOut,
  Robot,
  QrCode,
  WifiHigh,
  LockKey,
  LockKeyOpen,
  CurrencyCircleDollar,
} from "@phosphor-icons/react";
import NotificationBell from "@/components/NotificationBell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [waStatus, setWaStatus] = useState({
    is_connected: false,
    status: "disconnected",
    phone: null,
  });

  const [dayStatus, setDayStatus] = useState({
    is_open: true,
    day_state: "open",
    revenue: 0,
    open_orders: 0,
    total_orders: 0,
    initial_cash_balance: 0,
  });

  const [caixaModalOpen, setCaixaModalOpen] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState("");
  const [closingCaixa, setClosingCaixa] = useState(false);

  const fetchStatus = () => {
    api
      .get("/whatsapp/status")
      .then((res) => setWaStatus(res.data || {}))
      .catch(() => {});

    api
      .get("/day/status")
      .then((res) => setDayStatus(res.data || { is_open: true, day_state: "open" }))
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCaixa = async (e) => {
    e?.preventDefault();
    try {
      const val = parseFloat(initialCashInput.replace(",", ".")) || 0;
      await api.post("/day/open", { initial_cash: val });
      toast.success("Caixa do dia ABERTO com sucesso! IA e novos pedidos ativos.");
      setCaixaModalOpen(false);
      setInitialCashInput("");
      fetchStatus();
    } catch {
      toast.error("Erro ao abrir caixa");
    }
  };

  const handleCloseCaixa = async () => {
    setClosingCaixa(true);
    try {
      const res = await api.post("/day/close");
      toast.success(`Caixa do dia fechado! Faturamento final: ${BRL(res.data?.revenue || 0)}`);
      setCaixaModalOpen(false);
      fetchStatus();
    } catch {
      toast.error("Erro ao fechar caixa");
    } finally {
      setClosingCaixa(false);
    }
  };

  const isConnected = waStatus.is_connected || waStatus.status === "connected";
  const isCaixaOpen = dayStatus.is_open && dayStatus.day_state !== "closed";

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: House },
    { label: "Pedidos", path: "/pedidos", icon: ShoppingBag },
    { label: "Atendimento WhatsApp", path: "/atendimento", icon: WhatsappLogo },
    { label: "Clientes Salvos", path: "/clientes", icon: Users },
    { label: "Cardápio", path: "/produtos", icon: ForkKnife },
    { label: "Relatórios", path: "/relatorios", icon: ChartBar },
    { label: "Armazenamento & Caixas", path: "/armazenamento", icon: Archive },
    { label: "Configurações & IA", path: "/configuracoes", icon: Gear },
  ];

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex">
      {/* Sidebar no design autêntico orgânico e acolhedor (#F4F2EF) */}
      <aside className="w-64 bg-[#F4F2EF] text-stone-800 flex flex-col border-r border-[#E7E5E4] shrink-0">
        <div className="p-6 border-b border-[#E7E5E4] flex items-center gap-3">
          <div className="p-2.5 bg-[#C5533B] text-white rounded-xl font-bold text-xl shadow-sm">
            🍱
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-stone-900 font-display">
              Marmita Hub
            </h1>
            <p className="text-xs text-stone-500 font-medium">Gestão & Delivery Inteligente</p>
          </div>
        </div>

        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.path ||
              (item.path === "/dashboard" && location.pathname === "/");

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-[#C5533B] text-white shadow-sm font-semibold"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 font-medium"
                }`}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Card do WhatsApp na Sidebar com acesso direto ao QR Code */}
        <div className="p-3.5 border-t border-[#E7E5E4] bg-stone-100/50">
          <Link
            to="/configuracoes"
            className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
              isConnected
                ? "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70 text-emerald-950"
                : "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 text-amber-950"
            }`}
            title="Clique para gerenciar conexão do WhatsApp e QR Code"
          >
            <div
              className={`p-1.5 rounded-lg text-white ${
                isConnected ? "bg-emerald-600" : "bg-[#C5533B]"
              }`}
            >
              {isConnected ? <WifiHigh size={16} weight="bold" /> : <QrCode size={16} weight="bold" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight">
                {isConnected ? "WhatsApp Conectado" : "Conectar WhatsApp"}
              </p>
              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                {isConnected ? `+${waStatus.phone || "Ativo"}` : "Abrir QR Code"}
              </p>
            </div>
          </Link>
        </div>

        {/* Usuário e Logout */}
        <div className="p-4 border-t border-[#E7E5E4]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-semibold text-stone-900 truncate">
                {user?.name || "Operador"}
              </p>
              <p className="text-xs text-stone-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-stone-200/60 rounded-lg transition-colors flex-shrink-0"
              title="Sair"
            >
              <SignOut size={18} weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-[#E7E5E4] bg-white/90 backdrop-blur px-6 sm:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Indicador de Caixa Aberto / Fechado com Ação Direta */}
            <button
              onClick={() => setCaixaModalOpen(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold border transition-all shadow-sm ${
                isCaixaOpen
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100 animate-pulse"
              }`}
              title="Clique para gerenciar o Caixa do Dia"
            >
              {isCaixaOpen ? (
                <>
                  <LockKeyOpen size={15} weight="bold" className="text-emerald-600" />
                  <span>Caixa Aberto</span>
                  <span className="hidden md:inline text-stone-500 font-normal">
                    • {dayStatus.total_orders || 0} ped. ({BRL(dayStatus.revenue || 0)})
                  </span>
                </>
              ) : (
                <>
                  <LockKey size={15} weight="bold" className="text-red-600" />
                  <span>Caixa Fechado</span>
                  <span className="hidden md:inline text-red-600 font-medium">
                    (IA & Pedidos Pausados)
                  </span>
                </>
              )}
            </button>

            {/* Atendente IA Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-stone-700 font-medium">
              <Robot size={18} className={isCaixaOpen ? "text-emerald-600" : "text-stone-400"} weight="fill" />
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                  isCaixaOpen
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-stone-100 text-stone-600 border-stone-200"
                }`}
              >
                {isCaixaOpen ? "IA Atendendo" : "IA Pausada (Caixa Fechado)"}
              </span>
            </div>

            {/* WhatsApp Pareado Status */}
            <Link
              to="/configuracoes"
              className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                isConnected
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse"
              }`}
            >
              {isConnected ? (
                <>
                  <WifiHigh size={14} className="text-emerald-600" weight="bold" />
                  <span>WhatsApp Pareado</span>
                </>
              ) : (
                <>
                  <QrCode size={14} className="text-amber-700" weight="bold" />
                  <span>Conectar WhatsApp (QR Code)</span>
                </>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <div className="p-6 sm:p-8 max-w-7xl w-full mx-auto">{children || <Outlet />}</div>

        {/* Modal de Gestão do Caixa do Dia */}
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
                      {BRL(dayStatus.revenue || 0)}
                    </div>
                    <div>
                      <span className="font-semibold text-stone-800">Pedidos feitos:</span>{" "}
                      {dayStatus.total_orders || 0}
                    </div>
                    <div>
                      <span className="font-semibold text-stone-800">Troco Inicial:</span>{" "}
                      {BRL(dayStatus.initial_cash_balance || 0)}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-500">
                  Com o caixa aberto, os clientes podem fazer pedidos pelo WhatsApp e o balcão está autorizado a registrar comandas.
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
                        Abra o caixa para autorizar a IA a receber pedidos no WhatsApp e liberar o registro no balcão.
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
                  <p className="text-[11px] text-stone-500">Opcional. Valor em moedas/notas na gaveta para troco.</p>
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
      </main>
    </div>
  );
}

export default Layout;
