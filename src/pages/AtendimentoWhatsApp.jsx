import { useState, useEffect, useRef } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  WhatsappLogo,
  Robot,
  User,
  PaperPlaneTilt,
  CheckCircle,
  Warning,
  Clock,
  Phone,
  MagnifyingGlass,
  ArrowsClockwise,
  ShoppingBag,
  PencilSimple,
  ArrowRight,
  Fire,
  Truck,
  Sparkle,
  QrCode,
  WifiHigh,
  WifiSlash,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function AtendimentoWhatsApp() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [filterTab, setFilterTab] = useState("all"); // "all" | "needs_human" | "in_review" | "bot_active" | "completed"
  const [search, setSearch] = useState("");
  const [outgoingText, setOutgoingText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Status do WhatsApp & QR Code Modal
  const [waStatus, setWaStatus] = useState({ is_connected: false, status: "disconnected" });
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Modal para Simular Mensagem de Teste
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simName, setSimName] = useState("Lucas Mendes");
  const [simPhone, setSimPhone] = useState("11988887777");
  const [simMessage, setSimMessage] = useState(
    "Olá, gostaria de pedir 2 marmitas tradicionais M para entregar na Rua das Palmeiras 45 e pagar no Pix"
  );

  // Modal para Editar Pedido Vinculado
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const messagesEndRef = useRef(null);

  const loadChats = async () => {
    try {
      const [chatsRes, waRes] = await Promise.all([
        api.get("/whatsapp/chats"),
        api.get("/whatsapp/status"),
      ]);
      const list = chatsRes.data || [];
      setChats(list);
      setWaStatus(waRes.data || {});

      // Se nenhum chat selecionado e a lista tiver itens, seleciona o primeiro
      if (!selectedChatId && list.length > 0) {
        setSelectedChatId(list[0].chat_id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadChatDetails = async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/whatsapp/chats/${id}`);
      setCurrentChat(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadChats();
    const interval = setInterval(loadChats, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChatId) {
      loadChatDetails(selectedChatId);
    }
  }, [selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat?.messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!outgoingText.trim() || !selectedChatId) return;

    setSending(true);
    try {
      await api.post(`/whatsapp/chats/${selectedChatId}/message`, {
        text: outgoingText.trim(),
      });
      setOutgoingText("");
      await loadChatDetails(selectedChatId);
      await loadChats();
    } catch {
      toast.error("Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleToggleHumanControl = async (enableHuman) => {
    if (!selectedChatId) return;
    try {
      await api.post(`/whatsapp/chats/${selectedChatId}/toggle-human`, {
        enable_human: enableHuman,
      });
      toast.success(
        enableHuman
          ? "Atendimento assumido! O bot foi pausado para este cliente."
          : "Bot reativado para este cliente!"
      );
      await loadChatDetails(selectedChatId);
      await loadChats();
    } catch {
      toast.error("Erro ao alterar modo de atendimento");
    }
  };

  const handleApproveOrder = async (orderId) => {
    if (!orderId) return;
    try {
      await api.post(`/orders/${orderId}/approve`);
      toast.success("Pedido aprovado com sucesso! Cliente notificado no WhatsApp.");
      await loadChatDetails(selectedChatId);
      await loadChats();
    } catch {
      toast.error("Erro ao aprovar pedido");
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!orderId || !window.confirm("Deseja realmente RECUSAR este pedido?")) return;
    try {
      await api.patch(`/orders/${orderId}/status`, { status: "Cancelado" });
      toast.info("Pedido recusado.");
      await loadChatDetails(selectedChatId);
      await loadChats();
    } catch {
      toast.error("Erro ao recusar pedido");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!orderId || !window.confirm("Tem certeza que deseja EXCLUIR este pedido permanentemente?")) return;
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success("Pedido excluído!");
      setEditOrderOpen(false);
      await loadChatDetails(selectedChatId);
      await loadChats();
    } catch {
      toast.error("Erro ao excluir pedido");
    }
  };

  const handleSimulateMessage = async (e) => {
    e.preventDefault();
    try {
      await api.post("/whatsapp/simulate-message", {
        phone: simPhone,
        message: simMessage,
        name: simName,
      });
      toast.success("Mensagem simulada enviada para a IA!");
      setSimModalOpen(false);
      await loadChats();
      const clean = simPhone.replace(/\D/g, "");
      setSelectedChatId(clean);
    } catch {
      toast.error("Erro ao simular mensagem");
    }
  };

  const handleSaveEditedOrder = async () => {
    if (!editingOrder) return;
    try {
      await api.put(`/orders/${editingOrder.order_id}`, editingOrder);
      toast.success("Pedido atualizado com sucesso!");
      setEditOrderOpen(false);
      await loadChatDetails(selectedChatId);
    } catch {
      toast.error("Erro ao salvar alterações");
    }
  };

  const handleGenerateQR = async () => {
    try {
      await api.post("/whatsapp/start");
      toast.success("Iniciando conexão... Gerando QR Code.");
      setTimeout(async () => {
        try {
          const res = await api.get("/whatsapp/status");
          if (res.data?.qr_code) {
            setWaStatus(res.data);
          } else {
            const sim = await api.post("/whatsapp/simulate-qr");
            setWaStatus((prev) => ({ ...prev, qr_code: sim.data.qr_code, status: "qr_ready" }));
          }
        } catch {}
      }, 1500);
    } catch {
      const res = await api.post("/whatsapp/simulate-qr");
      setWaStatus((prev) => ({ ...prev, qr_code: res.data.qr_code, status: "qr_ready" }));
      toast.success("QR Code gerado para pareamento!");
    }
  };

  const handleForceReconnect = async () => {
    try {
      toast.info("Solicitando reconexão forçada do WhatsApp...");
      await api.post("/whatsapp/force-reconnect");
      toast.success("Comando enviado! Reconectando ao WhatsApp...");
      setTimeout(loadChats, 2000);
    } catch {
      toast.error("Erro ao solicitar reconexão do WhatsApp");
    }
  };

  const isConnected = waStatus.is_connected || waStatus.status === "connected";

  // Filtra chats
  const filteredChats = chats.filter((c) => {
    if (filterTab === "needs_human" && c.status !== "needs_human" && !c.is_human_controlled) return false;
    if (filterTab === "in_review" && c.status !== "in_review") return false;
    if (filterTab === "bot_active" && (c.is_human_controlled || c.status === "needs_human")) return false;
    if (filterTab === "completed" && c.status !== "completed") return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.customer_name?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q);
      const matchLast = c.last_message?.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchLast) return false;
    }
    return true;
  });

  const needsHumanCount = chats.filter((c) => c.status === "needs_human" || c.is_human_controlled).length;
  const inReviewCount = chats.filter((c) => c.status === "in_review").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
              Atendimento WhatsApp
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 flex items-center">
              <Robot size={15} weight="fill" /> Bot IA & Humano
            </Badge>
          </div>
          <p className="text-sm text-stone-500">
            Acompanhe as conversas em tempo real, pedidos em análise e assuma o atendimento quando necessário
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Conexão WhatsApp / QR Code */}
          <Button
            variant="outline"
            onClick={() => setQrModalOpen(true)}
            className={`text-xs gap-1.5 ${
              isConnected
                ? "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                : "text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 animate-pulse font-semibold"
            }`}
          >
            {isConnected ? <WifiHigh size={16} weight="bold" /> : <QrCode size={16} weight="bold" />}
            <span>{isConnected ? "WhatsApp Conectado" : "Ver QR Code WhatsApp"}</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleForceReconnect}
            title="Força a re-inicialização da conexão do WhatsApp caso caia ou trave"
            className="text-xs gap-1 text-[#C5533B] border-stone-300 hover:bg-stone-50 font-medium"
          >
            <ArrowsClockwise size={15} weight="bold" />
            <span>Forçar Conexão</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setSimModalOpen(true)}
            className="flex items-center gap-2 text-stone-700 text-xs"
          >
            <Sparkle size={15} className="text-amber-500" weight="fill" />
            <span>Simular Cliente (Teste)</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={loadChats} title="Atualizar conversas">
            <ArrowsClockwise size={16} className="text-stone-500" />
          </Button>
        </div>
      </div>

      {/* Alerta de QR Code se Desconectado */}
      {!isConnected && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-900 rounded-lg">
              <QrCode size={24} weight="bold" />
            </div>
            <div>
              <p className="font-semibold text-amber-950 text-sm">
                WhatsApp Desconectado no Servidor
              </p>
              <p className="text-xs text-amber-800">
                Para o robô responder clientes automaticamente no seu número, conecte o WhatsApp escaneando o QR Code.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setQrModalOpen(true)}
              className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1.5 shadow-sm font-medium shrink-0"
            >
              <QrCode size={15} weight="bold" /> Escanear QR Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/configuracoes")}
              className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
            >
              Ir para Configurações
            </Button>
          </div>
        </div>
      )}

      {/* Main Container: 2 Colunas (Lista de Chats + Janela de Conversa) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
        {/* Coluna da Esquerda: Lista de Conversas / Abas */}
        <Card className="lg:col-span-4 flex flex-col h-full border-stone-200 shadow-sm overflow-hidden bg-white">
          {/* Barra de Busca */}
          <div className="p-3 border-b border-stone-200 bg-stone-50/50 space-y-2.5">
            <div className="relative">
              <MagnifyingGlass size={16} className="text-stone-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Buscar por cliente, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs bg-white"
              />
            </div>

            {/* Abas de Filtro */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  filterTab === "all" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                Todos ({chats.length})
              </button>
              <button
                onClick={() => setFilterTab("needs_human")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  filterTab === "needs_human"
                    ? "bg-red-600 text-white"
                    : "text-red-700 bg-red-50 hover:bg-red-100"
                }`}
              >
                🚨 Precisa Humano {needsHumanCount > 0 && `(${needsHumanCount})`}
              </button>
              <button
                onClick={() => setFilterTab("in_review")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  filterTab === "in_review"
                    ? "bg-amber-600 text-white"
                    : "text-amber-800 bg-amber-50 hover:bg-amber-100"
                }`}
              >
                🟡 Em Análise {inReviewCount > 0 && `(${inReviewCount})`}
              </button>
              <button
                onClick={() => setFilterTab("bot_active")}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  filterTab === "bot_active" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                🤖 Bot
              </button>
            </div>
          </div>

          {/* Lista de Chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-stone-400">Carregando conversas...</div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 space-y-2">
                <WhatsappLogo size={36} className="mx-auto text-stone-300" weight="duotone" />
                <p>Nenhuma conversa encontrada neste filtro.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSimModalOpen(true)}
                  className="text-xs mt-2"
                >
                  Simular Mensagem de Teste
                </Button>
              </div>
            ) : (
              filteredChats.map((c) => {
                const isSelected = selectedChatId === c.chat_id;
                const isNeedsHuman = c.status === "needs_human" || c.is_human_controlled;
                const isInReview = c.status === "in_review";

                return (
                  <div
                    key={c.chat_id}
                    onClick={() => setSelectedChatId(c.chat_id)}
                    className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 text-left ${
                      isSelected
                        ? "bg-stone-100/90 border-l-4 border-l-[#C5533B]"
                        : "hover:bg-stone-50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                        isNeedsHuman
                          ? "bg-red-100 text-red-700"
                          : isInReview
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {isNeedsHuman ? "🚨" : isInReview ? "⏳" : "🍱"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-stone-900 text-xs sm:text-sm truncate">
                          {c.customer_name || "Cliente WhatsApp"}
                        </span>
                        <span className="text-[10px] text-stone-400 shrink-0">
                          {c.last_timestamp
                            ? new Date(c.last_timestamp).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>

                      <p className="text-xs text-stone-500 font-mono mt-0.5">{c.phone}</p>

                      <p className="text-xs text-stone-600 truncate mt-1">
                        {c.last_message || "Conversa iniciada"}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {isNeedsHuman && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200">
                            🚨 Atendente Humano
                          </span>
                        )}
                        {isInReview && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                            🟡 Em Análise
                          </span>
                        )}
                        {!isNeedsHuman && !isInReview && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            🤖 Bot Atendendo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Coluna da Direita: Janela de Chat Aberta */}
        <Card className="lg:col-span-8 flex flex-col h-full border-stone-200 shadow-sm overflow-hidden bg-[#FAF9F6]">
          {currentChat ? (
            <>
              {/* Header do Chat Selecionado */}
              <div className="p-4 border-b border-stone-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 font-bold">
                    {currentChat.customer_name ? currentChat.customer_name[0] : "C"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-stone-900 text-sm sm:text-base">
                        {currentChat.customer_name || "Cliente"}
                      </h2>
                      {currentChat.is_human_controlled ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                          Humano Atendendo
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                          🤖 Bot IA Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 font-mono">
                      WhatsApp: +{currentChat.phone}
                    </p>
                  </div>
                </div>

                {/* Controles de Atendimento */}
                <div className="flex items-center gap-2 flex-wrap">
                  {currentChat.is_human_controlled ? (
                    <Button
                      size="sm"
                      onClick={() => handleToggleHumanControl(false)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                    >
                      <Robot size={15} weight="fill" />
                      <span>Reativar Robô IA</span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleHumanControl(true)}
                      className="text-stone-700 border-stone-300 text-xs gap-1"
                      title="Pausar o bot e atender manualmente pelo chat"
                    >
                      <User size={15} weight="bold" />
                      <span>Assumir Atendimento</span>
                    </Button>
                  )}

                  {currentChat.latest_order && currentChat.latest_order.status === "Em Análise" && (
                    <Button
                      size="sm"
                      onClick={() => handleApproveOrder(currentChat.latest_order.order_id)}
                      className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1 shadow-sm font-semibold"
                    >
                      <CheckCircle size={15} weight="bold" />
                      <span>Aprovar Pedido</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Banner se o pedido estiver Em Análise */}
              {currentChat.latest_order && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={18} className="text-amber-600" weight="duotone" />
                    <div>
                      <span className="font-semibold">
                        Pedido #{currentChat.latest_order.order_id.slice(-6)}:
                      </span>{" "}
                      <Badge className="text-[10px] bg-amber-100 text-amber-900 border-amber-300">
                        {currentChat.latest_order.status}
                      </Badge>{" "}
                      • Total: <strong>{BRL(currentChat.latest_order.total || 0)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingOrder(currentChat.latest_order);
                        setEditOrderOpen(true);
                      }}
                      className="text-xs h-7 text-stone-700 hover:text-stone-900 gap-1"
                    >
                      <PencilSimple size={14} /> Editar
                    </Button>
                    {currentChat.latest_order.status === "Em Análise" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveOrder(currentChat.latest_order.order_id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 font-semibold"
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectOrder(currentChat.latest_order.order_id)}
                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-7 font-semibold"
                        >
                          Recusar
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteOrder(currentChat.latest_order.order_id)}
                      className="text-red-500 hover:bg-red-50 text-xs h-7"
                      title="Excluir Pedido"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}

              {/* Histórico de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Tag de indicação que é um bot atendendo */}
                <div className="text-center my-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <Robot size={15} weight="fill" />
                    Atendente Virtual Marmita Hub Ativo no WhatsApp
                  </span>
                </div>

                {!currentChat.messages || currentChat.messages.length === 0 ? (
                  <div className="p-12 text-center text-stone-400 text-sm">
                    Nenhuma mensagem registrada nesta conversa.
                  </div>
                ) : (
                  currentChat.messages.map((m) => {
                    const isCustomer = m.sender === "customer";
                    const isBot = m.sender === "bot";
                    const isAttendant = m.sender === "attendant";

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                      >
                        {/* Tag acima da mensagem */}
                        <div className="flex items-center gap-1 text-[10px] text-stone-400 mb-0.5 px-1">
                          {isBot && (
                            <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                              <Robot size={13} weight="fill" /> Bot Atendente
                            </span>
                          )}
                          {isAttendant && (
                            <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                              <User size={13} weight="bold" /> Atendente Humano
                            </span>
                          )}
                          {isCustomer && (
                            <span className="text-stone-600 font-medium">
                              {currentChat.customer_name || "Cliente"}
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            {m.timestamp
                              ? new Date(m.timestamp).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>

                        {/* Balão da Mensagem */}
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                            isCustomer
                              ? "bg-white border border-stone-200 text-stone-900 rounded-tl-sm"
                              : isAttendant
                              ? "bg-blue-600 text-white rounded-tr-sm"
                              : "bg-[#005c4b] text-white rounded-tr-sm"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Caixa de Entrada de Mensagem */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
              >
                <Input
                  placeholder={
                    currentChat.is_human_controlled
                      ? "Digite uma mensagem como atendente humano..."
                      : "Digite uma mensagem para o cliente via WhatsApp..."
                  }
                  value={outgoingText}
                  onChange={(e) => setOutgoingText(e.target.value)}
                  disabled={sending}
                  className="text-xs sm:text-sm"
                />
                <Button
                  type="submit"
                  disabled={sending || !outgoingText.trim()}
                  className="shrink-0 gap-1 bg-[#C5533B] hover:bg-[#A9432D] text-white"
                >
                  <PaperPlaneTilt size={16} weight="bold" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
              <WhatsappLogo size={56} className="text-stone-300 mb-2" weight="duotone" />
              <p className="font-medium text-stone-600">Selecione uma conversa ao lado</p>
              <p className="text-xs text-stone-400">
                Você poderá ler as mensagens, assumir o atendimento ou aprovar pedidos.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Modal QR Code Conectar WhatsApp */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg text-stone-900 flex items-center justify-center gap-2">
              <QrCode size={22} weight="bold" className="text-[#C5533B]" />
              Conectar WhatsApp do Restaurante
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4">
            {isConnected ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <CheckCircle size={40} className="mx-auto text-emerald-600" weight="fill" />
                <h3 className="font-bold text-emerald-900 text-sm">WhatsApp Pareado com Sucesso!</h3>
                <p className="text-xs text-emerald-800">
                  Número conectado: +{waStatus.phone || "Conectado"}
                </p>
              </div>
            ) : waStatus.qr_code ? (
              <div className="space-y-3">
                <div className="p-3 bg-white border border-stone-300 rounded-2xl shadow-sm inline-block">
                  <img
                    src={waStatus.qr_code}
                    alt="QR Code WhatsApp"
                    className="w-60 h-60 mx-auto object-contain"
                  />
                </div>
                <p className="text-xs text-stone-600">
                  Abra o <strong>WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho</strong> e aponte a câmera.
                </p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                <QrCode size={48} className="mx-auto text-stone-300" weight="duotone" />
                <p className="text-xs text-stone-500">
                  Clique no botão abaixo para gerar o QR Code de pareamento.
                </p>
                <Button
                  onClick={handleGenerateQR}
                  className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1.5"
                >
                  <QrCode size={16} weight="bold" /> Gerar QR Code Agora
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQrModalOpen(false);
                navigate("/configuracoes");
              }}
              className="text-xs"
            >
              Abrir Configurações Completas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para Simular Mensagem do Cliente */}
      <Dialog open={simModalOpen} onOpenChange={setSimModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-900 font-display">
              <Sparkle size={20} className="text-amber-500" weight="fill" /> Simular Mensagem de Cliente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSimulateMessage} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-stone-600 font-semibold">Nome do Cliente</Label>
              <Input
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-stone-600 font-semibold">Telefone</Label>
              <Input
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                placeholder="Ex: 11988887777"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-stone-600 font-semibold">Mensagem do Cliente</Label>
              <textarea
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                rows={4}
                className="w-full mt-1 p-2 text-xs border rounded-md focus:ring-1 focus:ring-stone-400"
                placeholder="Ex: Gostaria de pedir uma marmita M para entrega na Rua das Flores..."
              />
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-stone-500">
              <button
                type="button"
                onClick={() => setSimMessage("Gostaria de falar com um atendente humano por favor")}
                className="bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded"
              >
                + Testar Transbordo Humano
              </button>
              <button
                type="button"
                onClick={() =>
                  setSimMessage(
                    "Quero 1 Marmita Tradicional M para entregar na Rua Brasil 100 e pago no Pix"
                  )
                }
                className="bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded"
              >
                + Testar Pedido Completo
              </button>
              <button
                type="button"
                onClick={() => setSimMessage("Onde vocês ficam localizados? Posso retirar aí?")}
                className="bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded"
              >
                + Testar Localização da Loja
              </button>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setSimModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#C5533B] hover:bg-[#A9432D] text-white">
                Enviar Simulação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Editar Pedido Vinculado */}
      {editingOrder && (
        <Dialog open={editOrderOpen} onOpenChange={setEditOrderOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#F9F8F6]">
            <DialogHeader>
              <DialogTitle className="text-stone-900 font-display font-bold flex items-center justify-between">
                <span>Editar Pedido #{editingOrder.order_id.slice(-6)}</span>
                <Badge variant="outline" className="text-xs">
                  {editingOrder.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-700 font-semibold">Nome do Cliente</Label>
                  <Input
                    value={editingOrder.customer_name || ""}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, customer_name: e.target.value })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                </div>

                <div>
                  <Label className="text-xs text-stone-700 font-semibold">Status do Pedido</Label>
                  <Input
                    value={editingOrder.status || "Novo"}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, status: e.target.value })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-700 font-semibold">Endereço de Entrega</Label>
                <Input
                  value={editingOrder.address || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, address: e.target.value })}
                  className="mt-1 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-stone-700 font-semibold">Taxa de Entrega (R$)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editingOrder.delivery_fee || 0}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, delivery_fee: Number(e.target.value) })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-stone-700 font-semibold">Forma de Pagamento</Label>
                  <Input
                    value={editingOrder.payment_method || ""}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, payment_method: e.target.value })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-stone-700 font-semibold">Observações do Pedido</Label>
                <Input
                  value={editingOrder.notes || ""}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  className="mt-1 text-xs bg-white"
                />
              </div>

              {/* Gerenciador de Itens Anotados */}
              <div className="space-y-2 border p-3 rounded-xl bg-white border-stone-200">
                <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                  <Label className="text-xs text-stone-900 font-bold uppercase tracking-wider">
                    Itens Anotados no WhatsApp ({editingOrder.items?.length || 0})
                  </Label>
                  <span className="text-xs font-bold text-stone-900 font-display">
                    Total: {BRL((editingOrder.items || []).reduce((acc, i) => acc + (i.price * i.quantity), 0) + (editingOrder.delivery_fee || 0))}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(editingOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-stone-50 p-2 rounded-lg border border-stone-200">
                      <div className="flex-1 pr-2">
                        <span className="font-semibold text-stone-800 text-xs">{it.name}</span>
                        <div className="text-[11px] text-stone-500">
                          {BRL(it.price)} un. • Total: <strong className="text-stone-900">{BRL(it.price * it.quantity)}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 text-stone-700"
                          onClick={() => {
                            const newItems = editingOrder.items.map((item, i) =>
                              i === idx ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
                            );
                            setEditingOrder({ ...editingOrder, items: newItems });
                          }}
                        >
                          -
                        </Button>
                        <span className="font-bold text-xs w-4 text-center">{it.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 text-stone-700"
                          onClick={() => {
                            const newItems = editingOrder.items.map((item, i) =>
                              i === idx ? { ...item, quantity: item.quantity + 1 } : item
                            );
                            setEditingOrder({ ...editingOrder, items: newItems });
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRejectOrder(editingOrder.order_id)}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                >
                  Recusar Pedido
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleDeleteOrder(editingOrder.order_id)}
                  className="text-red-500 hover:bg-red-50 text-xs"
                >
                  Excluir
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditOrderOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveEditedOrder}
                  className="bg-[#C5533B] hover:bg-[#A9432D] text-white"
                >
                  Salvar Alterações
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
