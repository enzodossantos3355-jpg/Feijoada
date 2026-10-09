import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Bot, CheckCircle2, MessageSquare, Send, Sparkles, ShieldCheck } from "lucide-react";

export function Configuracoes() {
  const [aiStatus, setAiStatus] = useState(null);
  const [testMessage, setTestMessage] = useState("Boa tarde, qual é o cardápio de hoje e quanto custa a entrega?");
  const [testResult, setTestResult] = useState(null);
  const [loadingTest, setLoadingTest] = useState(false);

  useEffect(() => {
    api.get("/ai/status").then(({ data }) => setAiStatus(data)).catch(() => {});
  }, []);

  const handleSimulateAI = async (e) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    setLoadingTest(true);
    setTestResult(null);

    try {
      const { data } = await api.post("/whatsapp/simulate-message", {
        message: testMessage,
        phone: "5511999998888",
      });
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: "Erro ao comunicar com a IA no servidor." });
    } finally {
      setLoadingTest(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações & Inteligência Artificial</h1>
        <p className="text-slate-500 text-sm">Status da integração Gemini API e teste do atendente virtual do WhatsApp.</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-3 bg-emerald-500 text-white rounded-xl">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-emerald-950 text-lg flex items-center gap-2">
            Chave de API do Gemini Integrada e Ativa
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </h3>
          <p className="text-emerald-800 text-sm mt-1 leading-relaxed">
            A chave de API é injetada com segurança no servidor backend através de <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono text-xs">process.env.GEMINI_API_KEY</code>. Nenhuma digitação manual de chave é necessária na interface. O modelo ativo é o <strong>Gemini 3.1 Flash Lite</strong> com tempo de resposta sub-segundo.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-orange-500" />
          <h2 className="font-bold text-slate-900 text-lg">Testar Atendimento com IA (Simulador)</h2>
        </div>
        <p className="text-slate-500 text-sm">
          Simule uma mensagem enviada por um cliente pelo WhatsApp para testar a extração de pedidos e respostas inteligentes.
        </p>

        <form onSubmit={handleSimulateAI} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mensagem do Cliente
            </label>
            <textarea
              rows={3}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loadingTest}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loadingTest ? "Enviando para o Gemini..." : "Simular Resposta da IA"}
          </button>
        </form>

        {testResult && (
          <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-xl space-y-3 font-mono text-xs overflow-x-auto border border-slate-800">
            <p className="text-emerald-400 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Resposta Gerada pelo Gemini Server-Side:
            </p>
            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-slate-200">
              <p className="text-sm font-sans mb-2 text-white font-medium">"{testResult.reply_text}"</p>
              <pre className="text-slate-400 text-xs">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Configuracoes;
