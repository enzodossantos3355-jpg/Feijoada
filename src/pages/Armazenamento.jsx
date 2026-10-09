import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Archive, LockKey, LockKeyOpen, CurrencyDollar, Calendar, CheckCircle,
  Clock, ArrowClockwise, Receipt
} from "@phosphor-icons/react";

export default function Armazenamento() {
  const [dayStatus, setDayStatus] = useState(null);
  const [closes, setCloses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, closesRes] = await Promise.all([
        api.get("/day/status"),
        api.get("/day/closes"),
      ]);
      setDayStatus(statusRes.data || {});
      setCloses(closesRes.data || []);
    } catch {
      toast.error("Erro ao carregar dados do caixa e turnos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDay = async () => {
    setProcessing(true);
    try {
      const res = await api.post("/day/open");
      setDayStatus(res.data);
      toast.success("Caixa do dia aberto com sucesso! Pronto para registrar vendas.");
    } catch {
      toast.error("Erro ao abrir caixa");
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseDay = async () => {
    setProcessing(true);
    try {
      const res = await api.post("/day/close");
      toast.success("Caixa fechado com sucesso! Relatório de fechamento arquivado.");
      setCloseModalOpen(false);
      loadData();
    } catch {
      toast.error("Erro ao fechar caixa");
    } finally {
      setProcessing(false);
    }
  };

  const isOpen = dayStatus?.state === "open";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">Armazenamento & Caixa Diário</h1>
          <p className="text-sm text-stone-500">Controle de abertura, fechamento de turnos e relatórios diários arquivados</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="flex items-center gap-1.5">
          <ArrowClockwise size={16} /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-stone-500">Carregando status do caixa...</div>
      ) : (
        <>
          {/* Status do Caixa Atual */}
          <Card className={`border-2 ${isOpen ? "border-green-500/40 bg-green-50/20" : "border-stone-300 bg-stone-50/50"}`}>
            <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isOpen ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-700"
                }`}>
                  {isOpen ? <LockKeyOpen size={28} weight="duotone" /> : <LockKey size={28} weight="duotone" />}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-stone-900">
                      Caixa do Dia: {isOpen ? "Aberto" : "Fechado"}
                    </h2>
                    <Badge className={isOpen ? "bg-green-600 text-white" : "bg-stone-500 text-white"}>
                      {isOpen ? "Operação Ativa" : "Encerrado"}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-500">
                    {isOpen
                      ? `Turno iniciado em: ${dayStatus?.period_start ? new Date(dayStatus.period_start).toLocaleString("pt-BR") : "Hoje"}`
                      : "Abra o caixa para iniciar o expediente e registrar novos pedidos."}
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                {isOpen ? (
                  <Button
                    variant="destructive"
                    onClick={() => setCloseModalOpen(true)}
                    className="w-full md:w-auto flex items-center gap-2"
                  >
                    <LockKey size={18} weight="bold" /> Encerrar Caixa do Dia
                  </Button>
                ) : (
                  <Button
                    onClick={handleOpenDay}
                    disabled={processing}
                    className="w-full md:w-auto bg-green-700 hover:bg-green-800 text-white flex items-center gap-2"
                  >
                    <LockKeyOpen size={18} weight="bold" /> Abrir Caixa do Dia
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Fechamentos Arquivados */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-stone-900 flex items-center gap-2">
              <Archive size={20} weight="duotone" className="text-[#C5533B]" />
              Fechamentos e Turnos Arquivados
            </h3>

            {closes.length === 0 ? (
              <Card className="border-stone-200 text-center py-12">
                <CardContent>
                  <Receipt size={40} className="mx-auto text-stone-300 mb-2" weight="duotone" />
                  <p className="text-stone-600 font-medium">Nenhum fechamento registrado ainda</p>
                  <p className="text-xs text-stone-400">Os fechamentos de caixa arquivados aparecerão aqui.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {closes.map((c) => (
                  <Card key={c.close_id || c.id} className="border-stone-200 hover:border-stone-300">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-800">
                            Fechamento #{String(c.close_id || c.id).slice(-6)}
                          </span>
                          <span className="text-xs text-stone-400">
                            {c.created_at ? new Date(c.created_at).toLocaleString("pt-BR") : ""}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 mt-1">
                          {c.total_orders || 0} pedidos no turno ({c.valid_orders || 0} entregues, {c.cancelled_orders || 0} cancelados)
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-display text-lg font-bold text-stone-900">
                          {BRL(c.revenue || 0)}
                        </div>
                        <div className="text-xs text-stone-400">
                          Ticket médio: {BRL(c.avg_ticket || 0)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Fechamento de Caixa */}
      <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Fechamento de Caixa</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-stone-600">
              Tem certeza que deseja encerrar o expediente e fechar o caixa do dia?
            </p>
            <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs text-stone-600 space-y-1">
              <p>• O total de pedidos e faturamento de hoje serão arquivados.</p>
              <p>• As métricas do turno serão salvas no banco de dados.</p>
              <p>• Você poderá abrir um novo caixa amanhã a qualquer momento.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseDay}
              disabled={processing}
            >
              {processing ? "Fechando..." : "Confirmar e Fechar Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
