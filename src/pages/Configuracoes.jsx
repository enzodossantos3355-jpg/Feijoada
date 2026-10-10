import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  QrCode,
  WifiHigh,
  WifiSlash,
  ArrowsClockwise,
  Power,
  Robot,
  PaperPlaneTilt,
  Printer,
  MapPin,
  Plus,
  Trash,
  FloppyDisk,
  CheckCircle,
  Clock,
  Sparkle,
  Phone,
  Fire,
  CreditCard,
  Bluetooth,
  Storefront,
} from "@phosphor-icons/react";
import { getAutoPrint, setAutoPrint, printReceipt } from "@/lib/print";
import { pairPrinter, getPairedPrinter, clearPairedPrinter } from "@/lib/bluetooth-printer";

export default function Configuracoes() {
  // Status do WhatsApp Baileys
  const [waStatus, setWaStatus] = useState({
    status: "disconnected",
    is_connected: false,
    qr_code: null,
    phone: null,
  });
  const [loadingWa, setLoadingWa] = useState(false);

  // Status da Loja, IA e Localização
  const [storeStatus, setStoreStatus] = useState({
    accepting_orders: true,
    high_demand_message: "",
    scheduled_delivery_enabled: true,
    scheduled_delivery_fee: 5.0,
    scheduled_delivery_hours: "",
    ai_custom_instructions: "",
    pix_key: "",
    pix_beneficiary: "",
    store_address: "Rua do Sabor, 150 - Centro, São Paulo - SP",
    store_maps_url: "https://maps.google.com/?q=Rua+do+Sabor+150+Sao+Paulo",
    business_hours: "Segunda a Sábado das 10h30 às 15h00 e das 18h00 às 22h00",
  });
  const [savingStore, setSavingStore] = useState(false);

  // Zonas de Entrega
  const [zones, setZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneFee, setNewZoneFee] = useState("");
  const [addingZone, setAddingZone] = useState(false);

  // Impressão
  const [autoPrint, setAutoPrintState] = useState(getAutoPrint());
  const [pairedPrinter, setPairedPrinter] = useState(getPairedPrinter());

  // Simulador IA
  const [testMessage, setTestMessage] = useState("Boa tarde, qual é o cardápio de hoje, onde vocês ficam e quanto custa a entrega no Centro?");
  const [testResult, setTestResult] = useState(null);
  const [loadingTest, setLoadingTest] = useState(false);

  // Carrega status geral
  const loadData = async () => {
    try {
      const [waRes, storeRes, zonesRes] = await Promise.all([
        api.get("/whatsapp/status"),
        api.get("/store/status"),
        api.get("/delivery-zones"),
      ]);
      setWaStatus(waRes.data || {});
      setStoreStatus((prev) => ({ ...prev, ...(storeRes.data || {}) }));
      setZones(zonesRes.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.get("/whatsapp/status").then((r) => setWaStatus(r.data || {})).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Ações do WhatsApp
  const handleStartWhatsApp = async () => {
    setLoadingWa(true);
    try {
      await api.post("/whatsapp/start");
      toast.info("Iniciando serviço do WhatsApp... Aguarde a leitura do QR Code!");
      setTimeout(loadData, 2000);
    } catch {
      toast.error("Erro ao iniciar WhatsApp");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setLoadingWa(true);
    try {
      await api.post("/whatsapp/disconnect");
      toast.success("WhatsApp desconectado com sucesso");
      loadData();
    } catch {
      toast.error("Erro ao desconectar WhatsApp");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleSimulateQR = async () => {
    setLoadingWa(true);
    try {
      const res = await api.post("/whatsapp/simulate-qr");
      setWaStatus((prev) => ({ ...prev, qr_code: res.data.qr_code, status: "qr_ready" }));
      toast.success("QR Code gerado com sucesso! Escaneie no WhatsApp.");
    } catch {
      toast.error("Erro ao gerar QR Code");
    } finally {
      setLoadingWa(false);
    }
  };

  const handleSimulateConnect = async () => {
    setLoadingWa(true);
    try {
      const res = await api.post("/whatsapp/simulate-connect", { phone: "5511998765432" });
      setWaStatus((prev) => ({ ...prev, ...res.data }));
      toast.success("WhatsApp conectado com sucesso (Simulado)!");
    } catch {
      toast.error("Erro ao simular conexão");
    } finally {
      setLoadingWa(false);
    }
  };

  // Salvar Configurações da Loja, IA e Localização
  const handleSaveStoreStatus = async (e) => {
    e?.preventDefault();
    setSavingStore(true);
    try {
      const res = await api.put("/store/status", storeStatus);
      setStoreStatus((prev) => ({ ...prev, ...(res.data || {}) }));
      toast.success("Configurações da Loja, Localização e IA salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingStore(false);
    }
  };

  const handleToggleDemand = async () => {
    try {
      const res = await api.post("/store/toggle-accepting");
      setStoreStatus((prev) => ({ ...prev, ...(res.data || {}) }));
      if (res.data.accepting_orders) {
        toast.success("Loja aberta! Recebendo pedidos normalmente no WhatsApp.");
      } else {
        toast.warning("Loja pausada por Alta Demanda! A IA avisará os clientes.");
      }
    } catch {
      toast.error("Erro ao alterar status de alta demanda");
    }
  };

  // Ações de Zonas de Entrega
  const handleAddZone = async (e) => {
    e.preventDefault();
    if (!newZoneName.trim() || !newZoneFee) return;

    setAddingZone(true);
    try {
      const res = await api.post("/delivery-zones", {
        name: newZoneName.trim(),
        fee: Number(newZoneFee),
      });
      setZones((prev) => [...prev, res.data]);
      setNewZoneName("");
      setNewZoneFee("");
      toast.success("Região de entrega cadastrada!");
    } catch {
      toast.error("Erro ao cadastrar região de entrega");
    } finally {
      setAddingZone(false);
    }
  };

  const handleDeleteZone = async (id) => {
    try {
      await api.delete(`/delivery-zones/${id}`);
      setZones((prev) => prev.filter((z) => z.zone_id !== id));
      toast.success("Região excluída com sucesso");
    } catch {
      toast.error("Erro ao excluir região");
    }
  };

  // Impressora
  const handleToggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrintState(next);
    setAutoPrint(next);
    toast.info(next ? "Auto-impressão de comandas ativada!" : "Auto-impressão desativada.");
  };

  const handlePairPrinter = async () => {
    try {
      const info = await pairPrinter();
      setPairedPrinter(info);
      toast.success(`Impressora "${info.name}" conectada via Bluetooth!`);
    } catch (err) {
      toast.error(err.message || "Erro ao conectar impressora");
    }
  };

  const handleClearPrinter = () => {
    clearPairedPrinter();
    setPairedPrinter(null);
    toast.info("Impressora desconectada.");
  };

  const handleTestPrint = () => {
    printReceipt({
      order_id: "TEST-001",
      customer_name: "Cliente Teste",
      customer_phone: "11999998888",
      delivery_type: "Entrega",
      address: "Rua do Teste, 100",
      payment_method: "Pix",
      total: 35.0,
      items: [{ name: "Marmita Tradicional M", quantity: 1, price: 25.0 }, { name: "Refrigerante", quantity: 1, price: 6.0 }],
      delivery_fee: 4.0,
      notes: "Cupom de teste de impressão",
    });
    toast.success("Comprovante enviado para impressão!");
  };

  // Teste Simulador IA
  const handleSimulateAI = async (e) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    setLoadingTest(true);
    setTestResult(null);

    try {
      const res = await api.post("/whatsapp/simulate-message", {
        message: testMessage,
        phone: "5511999998888",
        name: "Cliente Teste",
      });
      setTestResult(res.data);
    } catch {
      setTestResult({ error: "Erro ao comunicar com a IA." });
    } finally {
      setLoadingTest(false);
    }
  };

  const isConnected = waStatus.is_connected || waStatus.status === "connected";
  const isQrReady = waStatus.status === "qr_ready" && waStatus.qr_code;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">
            Configurações da Loja & IA
          </h1>
          <p className="text-sm text-stone-500">
            QR Code do WhatsApp, Localização do negócio, Diretrizes da IA, Pix e Impressão
          </p>
        </div>

        <Button
          onClick={handleSaveStoreStatus}
          disabled={savingStore}
          className="bg-[#C5533B] hover:bg-[#A9432D] text-white flex items-center gap-2 shadow-sm font-medium"
        >
          <FloppyDisk size={18} weight="bold" />
          <span>{savingStore ? "Salvando..." : "Salvar Configurações"}</span>
        </Button>
      </div>

      {/* 1. SEÇÃO WHATSAPP & QR CODE (PRINCIPAL) */}
      <Card className="border-stone-200 shadow-sm bg-white overflow-hidden">
        <div className="bg-stone-50/80 p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white ${isConnected ? "bg-emerald-600" : "bg-[#C5533B]"}`}>
              {isConnected ? <WifiHigh size={22} weight="bold" /> : <WifiSlash size={22} weight="bold" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Conexão WhatsApp (Baileys)
                </h2>
                {isConnected ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Conectado</Badge>
                ) : isQrReady ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 animate-pulse">Aguardando QR Code</Badge>
                ) : (
                  <Badge className="bg-stone-100 text-stone-600 border-stone-300">Desconectado</Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {isConnected
                  ? `Operando normalmente no número +${waStatus.phone || "Pareado"}`
                  : "Escaneie o código QR com o aplicativo WhatsApp para conectar a IA"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectWhatsApp}
                disabled={loadingWa}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
              >
                <Power size={14} className="mr-1" /> Desconectar
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleStartWhatsApp}
                  disabled={loadingWa}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <WifiHigh size={15} className="mr-1" weight="bold" /> Conectar WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateQR}
                  disabled={loadingWa}
                  className="text-xs"
                  title="Gerar QR Code para escanear"
                >
                  <QrCode size={15} className="mr-1" /> Gerar QR Code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSimulateConnect}
                  disabled={loadingWa}
                  className="text-xs text-stone-500"
                  title="Simular conexão de teste"
                >
                  Simular Conectado
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={loadData} title="Atualizar status">
              <ArrowsClockwise size={16} className="text-stone-500" />
            </Button>
          </div>
        </div>

        <CardContent className="p-6">
          {isConnected ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-2xl">
                  📱
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-950 text-sm">WhatsApp Pareado com Sucesso!</h3>
                  <p className="text-xs text-emerald-800">
                    Número conectado: <strong>+{waStatus.phone || "Pareado"}</strong>. Todas as mensagens recebidas estão sendo atendidas pela IA.
                  </p>
                  <span className="text-[11px] text-emerald-700 mt-1 block">
                    ✓ Bot com tag identificadora e pedidos direcionados automaticamente para análise.
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectWhatsApp}
                className="text-red-700 border-red-200 hover:bg-red-100 text-xs shrink-0"
              >
                Desconectar Aparelho
              </Button>
            </div>
          ) : isQrReady ? (
            <div className="flex flex-col md:flex-row items-center gap-8 justify-center py-4">
              <div className="p-4 bg-white border border-stone-300 rounded-2xl shadow-md text-center shrink-0">
                <img
                  src={waStatus.qr_code}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 mx-auto object-contain"
                />
                <p className="text-xs text-stone-500 mt-2 font-mono">
                  Aponte a câmera do seu WhatsApp agora
                </p>
              </div>

              <div className="max-w-md space-y-3 text-stone-700">
                <h3 className="font-display font-bold text-lg text-stone-900">
                  Como conectar o WhatsApp:
                </h3>
                <ol className="text-sm space-y-2 list-decimal list-inside text-stone-600 leading-relaxed">
                  <li>Abra o <strong>WhatsApp</strong> no seu celular.</li>
                  <li>Toque em <strong>Mais opções</strong> (⋮ no Android) ou <strong>Configurações</strong> (no iPhone).</li>
                  <li>Toque em <strong>Aparelhos conectados</strong> e depois em <strong>Conectar um aparelho</strong>.</li>
                  <li>Aponte a câmera do celular para o QR Code ao lado.</li>
                </ol>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>O código expira em instantes por segurança. Clique em "Gerar QR Code" para atualizar se necessário.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-3 text-stone-500">
              <QrCode size={56} className="mx-auto text-stone-300" weight="duotone" />
              <p className="font-medium text-stone-800 text-base">Nenhum WhatsApp conectado no momento</p>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                Clique no botão abaixo para gerar o QR Code de conexão e iniciar o atendimento automático com inteligência artificial.
              </p>
              <Button
                onClick={handleStartWhatsApp}
                className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs mt-2"
              >
                <QrCode size={16} className="mr-1.5" /> Iniciar e Gerar QR Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. LOCALIZAÇÃO DO NEGÓCIO (NOVO - SOLICITADO PELO USUÁRIO) */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <div className="p-5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Storefront size={22} className="text-[#C5533B]" weight="duotone" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Localização do Negócio & Retirada
              </h2>
              <p className="text-xs text-stone-500">
                Endereço e link que a IA enviará quando o cliente perguntar onde fica ou se pode retirar
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <MapPin size={18} className="text-[#C5533B] shrink-0 mt-0.5" weight="fill" />
            <div>
              <span className="font-semibold block text-stone-900 mb-0.5">
                Como a IA usa a localização no WhatsApp:
              </span>
              Sempre que um cliente enviar perguntas como <em>"onde fica?"</em>, <em>"qual o endereço?"</em>, <em>"posso buscar aí?"</em>, ou <em>"como chego até vocês?"</em>, o robô responderá com o endereço exato, link do Google Maps e os horários cadastrados abaixo.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <MapPin size={15} className="text-[#C5533B]" /> Endereço Completo do Ponto de Retirada *
              </Label>
              <Input
                value={storeStatus.store_address || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, store_address: e.target.value })}
                placeholder="Ex: Rua do Sabor, 150 - Centro, São Paulo - SP"
                className="mt-1 text-xs"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Nome da rua, número, bairro, complemento e cidade.
              </span>
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <Sparkle size={15} className="text-amber-500" /> Link de Localização do Google Maps (Opcional)
              </Label>
              <Input
                value={storeStatus.store_maps_url || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, store_maps_url: e.target.value })}
                placeholder="Ex: https://maps.google.com/?q=..."
                className="mt-1 text-xs"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Link do Google Maps para o cliente abrir a rota com 1 clique no WhatsApp.
              </span>
            </div>
          </div>

          <div>
            <Label className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
              <Clock size={15} className="text-stone-500" /> Horários de Atendimento & Retirada no Balcão
            </Label>
            <Input
              value={storeStatus.business_hours || ""}
              onChange={(e) => setStoreStatus({ ...storeStatus, business_hours: e.target.value })}
              placeholder="Ex: Segunda a Sábado das 10h30 às 15h00 e das 18h00 às 22h00"
              className="mt-1 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. DIRETRIZES DA ATENDENTE IA & ALTA DEMANDA */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <div className="p-5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Robot size={22} className="text-[#C5533B]" weight="duotone" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Atendente Virtual IA & Regras de Atendimento
              </h2>
              <p className="text-xs text-stone-500">
                Controle o comportamento do bot Gemini Flash, pausa por alta demanda e Pix
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Card de Alta Demanda / Pausa de Pedidos */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
              storeStatus.accepting_orders
                ? "bg-stone-50 border-stone-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Fire size={20} className={storeStatus.accepting_orders ? "text-stone-400" : "text-red-600"} weight="fill" />
                <span className="font-semibold text-sm text-stone-900">
                  {storeStatus.accepting_orders ? "Loja Aceitando Pedidos Normalmente" : "🚨 Loja Pausada por Alta Demanda"}
                </span>
                <Badge className={storeStatus.accepting_orders ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                  {storeStatus.accepting_orders ? "Aberto" : "Pausado"}
                </Badge>
              </div>
              <p className="text-xs text-stone-500">
                Se a cozinha estiver cheia, pause momentaneamente para que a IA avise os clientes com simpatia e não feche novos pedidos.
              </p>
            </div>

            <Button
              onClick={handleToggleDemand}
              variant={storeStatus.accepting_orders ? "outline" : "default"}
              size="sm"
              className={storeStatus.accepting_orders ? "text-stone-700" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {storeStatus.accepting_orders ? "Pausar por Alta Demanda" : "Reabrir para Pedidos"}
            </Button>
          </div>

          {!storeStatus.accepting_orders && (
            <div>
              <Label className="text-xs text-stone-700 font-semibold">Mensagem de Alta Demanda (Enviada pela IA)</Label>
              <Textarea
                rows={2}
                value={storeStatus.high_demand_message || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, high_demand_message: e.target.value })}
                className="mt-1 text-xs"
                placeholder="Mensagem explicando a pausa temporária..."
              />
            </div>
          )}

          {/* Dados do Pix da Loja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
            <div>
              <Label className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
                <CreditCard size={16} className="text-stone-500" /> Chave Pix da Loja
              </Label>
              <Input
                value={storeStatus.pix_key || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, pix_key: e.target.value })}
                placeholder="Ex: 11999998888 (Celular) ou CNPJ"
                className="mt-1 text-xs"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Enviada pela IA aos clientes que escolherem pagar via Pix.
              </span>
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Titular / Beneficiário do Pix</Label>
              <Input
                value={storeStatus.pix_beneficiary || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, pix_beneficiary: e.target.value })}
                placeholder="Ex: Marmitaria Bom Sabor Ltda"
                className="mt-1 text-xs"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Usado para validar e conferir comprovantes enviados pelos clientes.
              </span>
            </div>
          </div>

          {/* Entrega Programada */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100">
            <div>
              <Label className="text-xs text-stone-700 font-semibold">Entrega Programada</Label>
              <select
                value={storeStatus.scheduled_delivery_enabled ? "true" : "false"}
                onChange={(e) => setStoreStatus({ ...storeStatus, scheduled_delivery_enabled: e.target.value === "true" })}
                className="w-full mt-1 p-2 text-xs border rounded-lg bg-white border-stone-300"
              >
                <option value="true">Habilitada</option>
                <option value="false">Desabilitada (Apenas Imediata)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Taxa Agendada (R$)</Label>
              <Input
                type="number"
                step="0.5"
                value={storeStatus.scheduled_delivery_fee || 0}
                onChange={(e) => setStoreStatus({ ...storeStatus, scheduled_delivery_fee: Number(e.target.value) })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs text-stone-700 font-semibold">Janelas de Horários</Label>
              <Input
                value={storeStatus.scheduled_delivery_hours || ""}
                onChange={(e) => setStoreStatus({ ...storeStatus, scheduled_delivery_hours: e.target.value })}
                placeholder="Ex: 11:30 às 13:30 / 18:30 às 20:30"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Diretrizes do Atendimento da IA */}
          <div className="pt-2 border-t border-stone-100">
            <Label className="text-xs text-stone-700 font-semibold flex items-center gap-1.5">
              <Robot size={16} className="text-[#C5533B]" /> Instruções Customizadas da Atendente IA
            </Label>
            <Textarea
              rows={5}
              value={storeStatus.ai_custom_instructions || ""}
              onChange={(e) => setStoreStatus({ ...storeStatus, ai_custom_instructions: e.target.value })}
              className="mt-1 text-xs leading-relaxed font-mono"
              placeholder="Instruções para o robô atender no WhatsApp..."
            />
            <span className="text-[11px] text-stone-400 mt-1 block">
              Essas orientações guiam como a IA se expressa, responde saudações, sugere adicionais e tira dúvidas sobre marmitas.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. ZONAS E TAXAS DE ENTREGA */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <div className="p-5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin size={22} className="text-stone-700" weight="duotone" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Bairros e Taxas de Entrega</h2>
              <p className="text-xs text-stone-500">Valores cobrados pelo delivery de acordo com a região informada pelo cliente</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleAddZone} className="flex flex-col sm:flex-row items-end gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <div className="flex-1 w-full">
              <Label className="text-xs text-stone-600">Nome do Bairro / Região</Label>
              <Input
                placeholder="Ex: Centro, Vila Nova, Jardins"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div className="w-full sm:w-36">
              <Label className="text-xs text-stone-600">Taxa de Entrega (R$)</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="0.00"
                value={newZoneFee}
                onChange={(e) => setNewZoneFee(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <Button type="submit" disabled={addingZone || !newZoneName.trim()} className="shrink-0 bg-stone-900 text-white text-xs gap-1">
              <Plus size={15} weight="bold" /> Adicionar Região
            </Button>
          </form>

          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
            {zones.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">Nenhuma região cadastrada ainda.</div>
            ) : (
              zones.map((z) => (
                <div key={z.zone_id} className="p-3.5 flex items-center justify-between bg-white hover:bg-stone-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900 text-sm">{z.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-stone-800 text-sm">{BRL(z.fee)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteZone(z.zone_id)}
                      className="text-stone-400 hover:text-red-600 h-8 w-8"
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. IMPRESSÃO TÉRMICA & BLUETOOTH */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <div className="p-5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Printer size={22} className="text-stone-700" weight="duotone" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Impressão Térmica de Comandas (58mm)</h2>
              <p className="text-xs text-stone-500">Impressão automática de pedidos na cozinha e balcão</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-stone-50/50">
            <div>
              <h3 className="font-semibold text-sm text-stone-900">Auto-Imprimir Comprovante ao Salvar Pedido</h3>
              <p className="text-xs text-stone-500">
                Dispara o comprovante de 58mm automaticamente sempre que um pedido for aprovado ou criado.
              </p>
            </div>
            <Button
              variant={autoPrint ? "default" : "outline"}
              size="sm"
              onClick={handleToggleAutoPrint}
              className={autoPrint ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs" : "text-xs"}
            >
              {autoPrint ? "✓ Auto-Impressão Ativada" : "Desativado"}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-stone-200 bg-white">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bluetooth size={18} className="text-blue-600" weight="bold" />
                <span className="font-semibold text-sm text-stone-900">Impressora Bluetooth Térmica</span>
                {pairedPrinter ? (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">Conectada</Badge>
                ) : (
                  <Badge variant="outline" className="text-stone-500">Não Pareada</Badge>
                )}
              </div>
              <p className="text-xs text-stone-500">
                {pairedPrinter ? `Pareada com: ${pairedPrinter.name}` : "Conecte diretamente impressoras térmicas ESC/POS (Xprinter, Elgin, MTP)."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestPrint} className="text-xs">
                Imprimir Cupom de Teste
              </Button>
              {pairedPrinter ? (
                <Button variant="ghost" size="sm" onClick={handleClearPrinter} className="text-xs text-red-600">
                  Desconectar
                </Button>
              ) : (
                <Button size="sm" onClick={handlePairPrinter} className="bg-stone-900 text-white text-xs">
                  Parear Impressora
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. SIMULADOR DE ATENDIMENTO IA */}
      <Card className="border-stone-200 shadow-sm bg-white">
        <div className="p-5 border-b border-stone-200 bg-stone-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkle size={22} className="text-amber-500" weight="duotone" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">Simulador de Atendimento da IA</h2>
              <p className="text-xs text-stone-500">Teste como a IA responde saudações, pratos, localização e fecha pedidos</p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          <form onSubmit={handleSimulateAI} className="space-y-3">
            <div>
              <Label className="text-xs text-stone-700 font-semibold">Mensagem do Cliente para Teste</Label>
              <Textarea
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="mt-1 text-xs"
                placeholder="Digite a mensagem simulada..."
              />
            </div>

            <Button
              type="submit"
              disabled={loadingTest}
              className="bg-[#C5533B] hover:bg-[#A9432D] text-white text-xs gap-1.5"
            >
              <PaperPlaneTilt size={15} weight="bold" />
              {loadingTest ? "Processando com Gemini..." : "Enviar Mensagem Simulada"}
            </Button>
          </form>

          {testResult && (
            <div className="p-4 bg-stone-900 text-stone-100 rounded-xl space-y-2 text-xs font-mono">
              <p className="text-emerald-400 font-bold flex items-center gap-1.5 font-sans text-sm">
                <CheckCircle size={18} weight="fill" /> Resposta da IA no WhatsApp:
              </p>
              <div className="p-3 bg-stone-950 rounded-lg text-stone-200 whitespace-pre-wrap font-sans leading-relaxed border border-stone-800">
                {testResult.reply_text || testResult.summaryMessage}
              </div>
              <pre className="text-stone-400 text-[11px] overflow-x-auto p-2">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
