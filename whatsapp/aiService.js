import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AI_BEHAVIOR_PROMPT, STORE_SETTINGS } from "./config.js";
import { getPendingOrder, getConfirmedOrder } from "./orderService.js";
import dotenv from "dotenv";

dotenv.config();

// Modelo principal com alta performance e estabilidade
export const GEMINI_MODEL = "gemini-3.8-flash";

// Lista de modelos Gemini Flash com fallback prioritário e tolerância a falhas
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

/**
 * Executa generateContent com fallback automático e timeout de segurança (evita travamentos)
 */
async function generateWithModelFallback(client, payload, timeoutMs = 25000) {
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      const config = { ...(payload.config || {}) };
      if (model.includes("gemini-3.8-flash") && !config.thinkingConfig) {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const res = await Promise.race([
        client.models.generateContent({
          ...payload,
          config,
          model,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms no modelo ${model}`)), timeoutMs)
        ),
      ]);
      return { response: res, model };
    } catch (err) {
      lastErr = err;
      console.warn(`[AI Service] Modelo ${model} falhou (${err.status || err.message}). Tentando fallback...`);
    }
  }
  throw lastErr;
}

// Armazenamento em memória do histórico de mensagens por usuário do WhatsApp
const chatHistories = new Map();

/**
 * Retorna uma instância do cliente GoogleGenAI dinamicamente com User-Agent exigido
 */
export function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

/**
 * Obtém ou inicializa o histórico de mensagens de um usuário
 */
export function getChatHistory(userId) {
  if (!chatHistories.has(userId)) {
    chatHistories.set(userId, []);
  }
  return chatHistories.get(userId);
}

/**
 * Limpa o histórico de conversa após um pedido ser confirmado ou cancelado
 */
export function clearChatHistory(userId) {
  chatHistories.delete(userId);
}

/**
 * Busca o contexto atualizado do sistema (produtos, clientes, zonas, alta demanda, entrega programada)
 */
export async function fetchSystemContext() {
  try {
    const res = await fetch("http://localhost:3000/api/whatsapp/catalog-context", {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback silencioso se o servidor estiver em boot
  }

  // Fallback padrão com dados estruturados
  return {
    accepting_orders: true,
    high_demand_message: "Nossos pedidos estão temporariamente pausados por alta demanda.",
    scheduled_delivery_enabled: true,
    scheduled_delivery_fee: STORE_SETTINGS.scheduledDelivery.fee,
    scheduled_delivery_hours: STORE_SETTINGS.scheduledDelivery.availableWindows,
    products: [
      {
        product_id: "prod_1001",
        name: "Marmita Tradicional P",
        description: "Arroz, feijão carioca, carne de panela, farofa e salada.",
        price: 18.0,
        category: "Marmita",
        additionals: [
          { name: "Ovo frito caipira", price: 3.0 },
          { name: "Farofa crocante extra", price: 2.5 },
        ],
      },
      {
        product_id: "prod_1002",
        name: "Marmita Tradicional M",
        description: "Bife acebolado ou frango grelhado + guarnições.",
        price: 23.0,
        category: "Marmita",
        additionals: [
          { name: "Ovo frito caipira", price: 3.0 },
          { name: "Queijo coalho grelhado", price: 5.0 },
          { name: "Batata frita sequinha", price: 6.0 },
        ],
      },
      {
        product_id: "prod_1003",
        name: "Marmita Tradicional G",
        description: "Duas proteínas, arroz, feijão, tropeiro e salada.",
        price: 28.0,
        category: "Marmita",
        additionals: [
          { name: "Bife extra", price: 8.0 },
          { name: "Ovo frito caipira", price: 3.0 },
        ],
      },
      {
        product_id: "prod_1004",
        name: "Marmita Fit Frango & Legumes",
        description: "Frango grelhado com legumes no vapor e arroz integral.",
        price: 25.0,
        category: "Fitness",
        additionals: [{ name: "Purê de batata doce", price: 5.0 }],
      },
    ],
    customers: [],
    delivery_zones: [
      { zone_id: "zone_1", name: "Centro", fee: 5.0 },
      { zone_id: "zone_2", name: "Bairros Próximos", fee: 7.0 },
    ],
  };
}

/**
 * Encontra se o remetente já é um cliente cadastrado no app pelo telefone
 */
function matchRegisteredCustomer(rawPhone, customersList) {
  if (!rawPhone || !Array.isArray(customersList)) return null;
  const digits = rawPhone.replace(/\D/g, "");

  return customersList.find((c) => {
    const cDigits = (c.phone || "").replace(/\D/g, "");
    if (!cDigits) return false;
    return (
      digits.endsWith(cDigits) ||
      cDigits.endsWith(digits) ||
      (digits.length >= 8 && cDigits.endsWith(digits.slice(-8)))
    );
  });
}

/**
 * Processa a mensagem do cliente com o Gemini Flash
 */
export async function processCustomerMessageWithAI(userPhone, incomingMessage, pushName = "") {
  const history = getChatHistory(userPhone);
  history.push({ role: "user", text: incomingMessage });

  if (history.length > 16) {
    history.splice(0, history.length - 16);
  }

  const contextData = await fetchSystemContext();
  const registeredCustomer = matchRegisteredCustomer(userPhone, contextData.customers);

  // Formatação do Cardápio real
  const catalogPrompt = (contextData.products || [])
    .map((p, idx) => {
      const adds =
        (p.additionals || []).length > 0
          ? `   Adicionais: ${p.additionals.map((a) => `${a.name} (+R$ ${Number(a.price).toFixed(2)})`).join(", ")}`
          : "   Sem adicionais.";
      return `${idx + 1}. ${p.name} - R$ ${Number(p.price).toFixed(2)} (${p.category || "Marmita"})\n   ${p.description || "Prato artesanal da casa"}\n${adds}`;
    })
    .join("\n\n");

  // Formatação das Zonas e Taxas de Entrega
  const zonesPrompt = (contextData.delivery_zones || [])
    .map((z) => `• ${z.name}: Taxa R$ ${Number(z.fee).toFixed(2)}`)
    .join("\n");

  // Formatação da Entrega Programada
  const scheduledDeliveryPrompt = contextData.scheduled_delivery_enabled
    ? `ENTREGA PROGRAMADA / AGENDADA:
• Disponível: Sim
• Taxa agendada: R$ ${Number(contextData.scheduled_delivery_fee || 5).toFixed(2)}
• Janelas de horários: ${contextData.scheduled_delivery_hours || "11:30 às 13:30 / 18:30 às 20:30"}
• Regra: Se o cliente quiser agendar para horário específico, informe a taxa e registre o horário desejado!`
    : "ENTREGA PROGRAMADA: No momento disponível apenas entrega imediata.";

  // Informações do Cliente Cadastrado
  const customerPrompt = registeredCustomer
    ? `CLIENTE JÁ CADASTRADO NO SISTEMA:
• Nome: ${registeredCustomer.name}
• Telefone cadastrado: ${registeredCustomer.phone}
• Endereço salvo: ${registeredCustomer.address || "Não informado"}
• Observações do cliente: ${registeredCustomer.notes || "Nenhuma"}
(Instrução: Cumprimente pelo nome "${registeredCustomer.name}". Se for entrega e ele não falar outro endereço, pergunte se prefere no endereço já cadastrado dele: "${registeredCustomer.address}")`
    : `CLIENTE NÃO CADASTRADO PREVIAMENTE:
• Nome sugerido pelo WhatsApp: ${pushName || "Cliente"}`;

  // Informações de Alta Demanda
  const demandPrompt = !contextData.accepting_orders
    ? `🚨 ATENÇÃO - STATUS DA LOJA: PAUSADA POR ALTA DEMANDA!
Aviso configurado: "${contextData.high_demand_message}"
REGRA MANDATÓRIA:
- A cozinha está em alta demanda momentânea e NÃO podemos fechar pedidos agora.
- O campo "is_complete" DEVE ser SEMPRE false.
- Responda com simpatia explicando a pausa temporária para manter a qualidade e peça para tentar novamente em alguns minutos!`
    : "STATUS DA LOJA: ACEITANDO PEDIDOS NORMALMENTE.";

  const customInstructionsPrompt = contextData.ai_custom_instructions || AI_BEHAVIOR_PROMPT;

  const pixPrompt = contextData.pix_key
    ? `DADOS DO PIX DA LOJA:
• Chave Pix: ${contextData.pix_key}
• Beneficiário / Titular: ${contextData.pix_beneficiary || "Marmita Hub"}
• REGRA DO PIX: Sempre que o cliente pedir a chave Pix ("qual o pix?", "manda a chave", etc.) ou escolher pagar via Pix, envie a Chave Pix e o titular na sua resposta!`
    : "DADOS DO PIX: Chave Pix a ser informada no fechamento do pedido.";

  const systemInstruction = `
${customInstructionsPrompt}

REGRA FUNDAMENTAL DE ATENDIMENTO HUMANO (NUNCA MANDE MENSAGENS PRONTAS/ROBÓTICAS):
1. NUNCA responda com um texto pronto pré-fabricado ou repetitivo.
2. SAUDAÇÕES SIMPLES: Se a mensagem do cliente for apenas um cumprimento ("bom dia", "boa tarde", "boa noite", "oi", "olá", "e aí"), responda de volta com a respectiva saudação carinhosa e educada, pergunte como ele está e o que deseja pedir hoje! (Ex: "Bom dia! Tudo bem com você? O que você gostaria de pedir hoje? Temos opções deliciosas! 🍲"). NÃO envie listas enormes ou textos prontos.
3. COMPREENSÃO IMEDIATA: Se o cliente já mandar na mensagem o que ele quer (ex: "Quero uma marmita fit com arroz integral para entregar na Rua X e pago no pix"), ENTENDA DE PRIMEIRA! Não faça perguntas redundantes sobre o que ele já informou! Extraia os itens, endereço e forma de pagamento na hora.
4. Se faltar apenas algum dado para fechar (ex: escolheu prato mas não disse endereço ou forma de pagamento), pergunte APENAS o dado faltante de forma direta e gentil.
5. As mensagens devem ser sempre em texto escrito claro, amigável e com quebras de linha confortáveis.

=======================================================
DADOS EM TEMPO REAL CADASTRADOS NO SISTEMA DO PDV:
=======================================================
${demandPrompt}

${customerPrompt}

${pixPrompt}

CARDÁPIO DE PRODUTOS CADASTRADOS NO APP:
${catalogPrompt}

TAXAS DE ENTREGA CADASTRADAS POR REGIÃO:
${zonesPrompt}

${scheduledDeliveryPrompt}

=======================================================
FORMATO OBRIGATÓRIO DE RESPOSTA (JSON):
=======================================================
Você DEVE responder ESTRITAMENTE em formato JSON com a seguinte estrutura:
{
  "reply_text": "Texto natural da sua resposta para o cliente no WhatsApp",
  "is_complete": true ou false,
  "customer_name": "Nome do cliente",
  "items": [
    {
      "product_id": "id do produto se houver",
      "name": "Nome exato do produto",
      "quantity": 1,
      "price": 0.0,
      "additionals": [{"name": "Adicional", "price": 0.0}],
      "notes": "Observação do item"
    }
  ],
  "delivery_type": "Entrega", "Entrega Programada" ou "Retirada",
  "delivery_address": "Endereço completo ou 'Retirada no balcão'",
  "payment_method": "Pix", "Cartão de Crédito", "Cartão de Débito" ou "Dinheiro",
  "notes": "Observações gerais",
  "estimated_total": 0.0
}

REGRAS DO "is_complete":
- "is_complete" DEVE ser true assim que você tiver: prato/itens + endereço ou retirada + forma de pagamento!
- Se a loja estiver pausada por alta demanda, "is_complete" DEVE ser false.
`;

  const conversationContext = history
    .map((msg) => `${msg.role === "user" ? "Cliente" : "Atendente"}: ${msg.text}`)
    .join("\n");

  const aiClient = getAIClient();

  if (aiClient) {
    try {
      const { response, model: usedModel } = await generateWithModelFallback(aiClient, {
        contents: `HISTÓRICO DA CONVERSA:\n${conversationContext}\n\nÚltima mensagem do cliente: "${incomingMessage}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      let rawText = response.text?.trim() || "";
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```json|^```/g, "").replace(/```$/g, "").trim();
      }

      const startIndex = rawText.indexOf("{");
      const endIndex = rawText.lastIndexOf("}");

      if (startIndex !== -1 && endIndex !== -1) {
        const parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));

        if (parsed.reply_text) {
          history.push({ role: "model", text: parsed.reply_text });
        }

        return parsed;
      }
    } catch (err) {
      console.error(`[AI Service - ${GEMINI_MODEL}] Erro ao chamar API Gemini Flash:`, err);
    }
  }

  // Fallback inteligente se Gemini API falhar ou estiver sem internet
  return smartFallbackResponse(history, incomingMessage, contextData, registeredCustomer, pushName);
}

/**
 * Escuta e transcreve mensagem de áudio do WhatsApp com Gemini 3.8 Flash
 */
export async function processCustomerAudio(audioBuffer, audioMimetype, userPhone, pushName = "") {
  const client = getAIClient();
  let transcribedText = "";

  if (client && audioBuffer) {
    try {
      const mime = audioMimetype?.includes("mp4") ? "audio/mp4" : "audio/ogg";
      const { response } = await generateWithModelFallback(client, {
        contents: [
          {
            inlineData: {
              mimeType: mime,
              data: audioBuffer.toString("base64"),
            },
          },
          "Transcreva com fidelidade absoluta o que foi dito neste áudio em português do Brasil. Retorne apenas o texto transcrito, sem introduções ou explicações.",
        ],
      });
      transcribedText = response.text?.trim() || "";
      console.log(`[WhatsApp - Audio] Áudio de ${pushName || userPhone} transcrito com Gemini 3.8 Flash: "${transcribedText}"`);
    } catch (err) {
      console.error("[WhatsApp - Audio] Erro ao transcrever áudio com Gemini Flash:", err);
    }
  }

  if (!transcribedText) {
    return {
      reply_text: "Recebi seu áudio! Poderia repetir ou me dizer por escrito o que deseja, por favor? 😊",
      is_complete: false,
      transcribed_text: "",
    };
  }

  // Processa a mensagem transcrita com o fluxo da IA
  const result = await processCustomerMessageWithAI(userPhone, transcribedText, pushName);
  return {
    ...result,
    transcribed_text: transcribedText,
  };
}

/**
 * Valida comprovante de pagamento Pix (imagem enviada pelo cliente)
 */
export async function validatePixReceipt(imageBuffer, imageMimetype, userPhone, pushName = "", captionText = "") {
  const client = getAIClient();
  const contextData = await fetchSystemContext();
  const cleanPhone = (userPhone || "").replace(/\D/g, "");

  let targetOrder = getPendingOrder(userPhone) || getConfirmedOrder(userPhone);

  // Se não estiver em memória (ex: bot reiniciou), consulta o pedido ativo do PDV
  if (!targetOrder && cleanPhone) {
    try {
      const res = await fetch(`http://localhost:3000/api/whatsapp/active-order?phone=${cleanPhone}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.order) {
          targetOrder = {
            orderCode: data.order.order_code || data.order.order_id,
            total: Number(data.order.total || 0),
            customer_name: data.order.customer_name || pushName,
            items: data.order.items || [],
          };
        }
      }
    } catch (e) {
      console.warn("[WhatsApp - Pix] Erro ao buscar pedido ativo no PDV:", e?.message);
    }
  }

  const expectedTotal = targetOrder ? Number(targetOrder.total || targetOrder.estimated_total || 0) : 0;
  const orderCode = targetOrder ? targetOrder.orderCode : "";

  if (!client || !imageBuffer) {
    return {
      is_valid: false,
      reply_text: "Recebi sua imagem! Poderia confirmar se o comprovante Pix foi enviado no valor total do pedido?",
    };
  }

  try {
    const mime = imageMimetype || "image/jpeg";
    const prompt = `
Você é o auditor e validador oficial de comprovantes de pagamento Pix da Marmita Hub.
Analise detalhadamente a imagem enviada pelo cliente.
DADOS DA LOJA:
- Nome da Loja / Beneficiário: ${STORE_SETTINGS.storeName} (${contextData.pix_beneficiary || "Marmita Hub"})
- Chave Pix: ${contextData.pix_key || STORE_SETTINGS.pixKey}
- Valor esperado do pedido #${orderCode || "atual"}: R$ ${expectedTotal.toFixed(2)}
${captionText ? `- Legenda enviada pelo cliente junto da foto: "${captionText}"` : ""}

SUAS TAREFAS:
1. Verifique se a imagem é um comprovante autêntico de transferência ou pagamento Pix (ou comprovante bancário válido).
2. Verifique se a transação foi EFETIVADA/LIQUIDADA/CONCLUÍDA com sucesso (e NÃO um agendamento futuro ou cancelamento).
3. Identifique com precisão o VALOR pago em R$ (campo "Valor", "Valor Transferido" ou "Valor Pago").
4. Identifique o Beneficiário/Favorecido, o Banco de origem (ex: Nubank, Inter, Itaú, Bradesco, Santander, Caixa, BB, etc.) e o ID/Código da transação se visível.

Responda ESTRITAMENTE em formato JSON:
{
  "is_pix_receipt": true ou false,
  "is_scheduled": true ou false,
  "is_completed": true ou false,
  "paid_amount": 0.0,
  "bank_name": "string",
  "recipient_name": "string",
  "transaction_id": "string",
  "summary": "resumo sucinto da análise"
}
`;

    const { response } = await generateWithModelFallback(client, {
      contents: [
        {
          inlineData: {
            mimeType: mime,
            data: imageBuffer.toString("base64"),
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    let raw = response.text?.trim() || "{}";
    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = { is_pix_receipt: false, paid_amount: 0 };
    }

    console.log(`[WhatsApp - Pix] Análise do comprovante de ${pushName || userPhone}:`, analysis);

    // Validação das regras de negócio
    if (!analysis.is_pix_receipt) {
      return {
        is_valid: false,
        reply_text: "Recebi sua imagem, mas não consegui identificar um comprovante Pix nela. Se você já realizou o pagamento, poderia nos enviar a foto ou arquivo do comprovante bancário por favor? 🧾",
        analysis,
      };
    }

    if (analysis.is_scheduled) {
      return {
        is_valid: false,
        reply_text: `⚠️ *Atenção:* Identificamos que este comprovante é um *Agendamento de Pix* para uma data futura, e não uma transferência imediata realizada hoje.\nPara que a cozinha possa preparar seu pedido #${orderCode || ""}, por favor realize o pagamento imediato e nos envie o comprovante! 👍`,
        analysis,
      };
    }

    const paid = Number(analysis.paid_amount || 0);

    // Se temos um pedido aguardando conferência do valor:
    if (expectedTotal > 0) {
      // Margem de tolerância de 5 centavos para arredondamento
      if (paid >= expectedTotal - 0.05) {
        return {
          is_valid: true,
          paid_amount: paid,
          expected_total: expectedTotal,
          order_code: orderCode,
          bank_name: analysis.bank_name || "Banco",
          reply_text: `✅ *COMPROVANTE PIX VALIDADO COM SUCESSO!* 🎉\n━━━━━━━━━━━━━━━━━━\n💰 *Valor recebido:* R$ ${paid.toFixed(2).replace(".", ",")}\n📋 *Pedido:* #${orderCode || "Confirmado"}\n🏦 *Instituição:* ${analysis.bank_name || "Comprovante Bancário"}\n━━━━━━━━━━━━━━━━━━\nSeu pagamento foi confirmado no sistema e a cozinha já está preparando o seu pedido! Obrigado pela preferência! 🍲😋`,
          analysis,
        };
      } else {
        const diff = expectedTotal - paid;
        return {
          is_valid: false,
          paid_amount: paid,
          expected_total: expectedTotal,
          order_code: orderCode,
          bank_name: analysis.bank_name || "Banco",
          reply_text: `⚠️ *Atenção no valor do comprovante Pix:*\n━━━━━━━━━━━━━━━━━━\nIdentificamos o comprovante no valor de *R$ ${paid.toFixed(2).replace(".", ",")}*.\nPorém, o valor total do pedido #${orderCode} é de *R$ ${expectedTotal.toFixed(2).replace(".", ",")}*.\n\nFalta o valor de *R$ ${diff.toFixed(2).replace(".", ",")}*.\n━━━━━━━━━━━━━━━━━━\nPoderia por gentileza realizar a complementação e nos enviar o novo comprovante para que a cozinha possa iniciar o preparo? 😊`,
          analysis,
        };
      }
    }

    // Se não há pedido pendente identificado, mas comprovante Pix válido foi enviado:
    return {
      is_valid: true,
      paid_amount: paid,
      bank_name: analysis.bank_name || "Banco",
      reply_text: `✅ *Comprovante Pix recebido!* Identificamos a transferência de *R$ ${paid.toFixed(2).replace(".", ",")}* (${analysis.bank_name || "Banco"}). Já estamos localizando o seu pedido no sistema para confirmar o preparo! 👍`,
      analysis,
    };
  } catch (err) {
    console.error("[WhatsApp - Pix] Erro ao analisar imagem do comprovante com Gemini Flash:", err);
    return {
      is_valid: false,
      reply_text: "Recebi seu comprovante Pix! Já estou repassando para a conferência da nossa equipe. 👍",
    };
  }
}

/**
 * Fallback natural inteligente (nunca robótico ou com mensagem decorada fixa)
 */
function smartFallbackResponse(history, incomingMessage, contextData, customer, pushName) {
  const text = incomingMessage.toLowerCase().trim();
  const name = customer ? customer.name : pushName ? pushName.split(" ")[0] : "";
  const nameGreeting = name ? `, ${name}` : "";

  if (!contextData.accepting_orders) {
    const msg = `Olá${nameGreeting}! 😊\n${contextData.high_demand_message}`;
    history.push({ role: "model", text: msg });
    return {
      reply_text: msg,
      is_complete: false,
      customer_name: name || "Cliente",
      items: [],
      delivery_type: "Entrega",
      delivery_address: "",
      payment_method: "Pendente",
      notes: "",
      estimated_total: 0,
    };
  }

  // Cumprimentos simples
  if (text === "bom dia" || text.startsWith("bom dia")) {
    const reply = `Bom dia${nameGreeting}! Tudo bem? Como posso te ajudar hoje? O que você gostaria de pedir? 🍲`;
    history.push({ role: "model", text: reply });
    return { reply_text: reply, is_complete: false, items: [], delivery_type: "Entrega" };
  }

  if (text === "boa tarde" || text.startsWith("boa tarde")) {
    const reply = `Boa tarde${nameGreeting}! Tudo bem? O que você deseja pedir hoje no almoço? 🍛`;
    history.push({ role: "model", text: reply });
    return { reply_text: reply, is_complete: false, items: [], delivery_type: "Entrega" };
  }

  if (text === "boa noite" || text.startsWith("boa noite")) {
    const reply = `Boa noite${nameGreeting}! Tudo bem? O que você gostaria de pedir para o jantar hoje? 🍲`;
    history.push({ role: "model", text: reply });
    return { reply_text: reply, is_complete: false, items: [], delivery_type: "Entrega" };
  }

  if (text === "oi" || text === "olá" || text === "ola" || text === "opa") {
    const reply = `Olá${nameGreeting}! Tudo bem? Em que posso te ajudar hoje? Deseja ver o cardápio ou fazer um pedido? 😊`;
    history.push({ role: "model", text: reply });
    return { reply_text: reply, is_complete: false, items: [], delivery_type: "Entrega" };
  }

  // Dúvidas sobre Pix
  if (text.includes("pix") || text.includes("chave")) {
    const pixKey = contextData.pix_key || "11999999999 (Celular)";
    const pixBenef = contextData.pix_beneficiary ? `\n*Titular:* ${contextData.pix_beneficiary}` : "";
    const pixMsg = `Nossa chave Pix é:\n🔑 *${pixKey}*${pixBenef}\n\nAssim que você realizar a transferência, pode nos enviar o comprovante por aqui mesmo para validarmos! 👍`;
    history.push({ role: "model", text: pixMsg });
    return { reply_text: pixMsg, is_complete: false, items: [], payment_method: "Pix" };
  }

  // Dúvidas sobre Entrega Programada
  if (text.includes("programada") || text.includes("agendar") || text.includes("horário")) {
    const schedMsg = `Sim! Temos *Entrega Programada* com taxa de R$ ${Number(contextData.scheduled_delivery_fee || 5).toFixed(2)}.\n⏰ Janelas disponíveis: ${contextData.scheduled_delivery_hours}.\nPara qual horário você gostaria de agendar?`;
    history.push({ role: "model", text: schedMsg });
    return { reply_text: schedMsg, is_complete: false, items: [], delivery_type: "Entrega Programada" };
  }

  // Tenta extrair produtos do catálogo se a pessoa já mandou o que quer
  const matchedItems = [];
  let estimatedTotal = 0;
  for (const prod of contextData.products || []) {
    if (text.includes(prod.name.toLowerCase()) || text.includes(prod.name.toLowerCase().replace("marmita ", ""))) {
      matchedItems.push({
        product_id: prod.product_id,
        name: prod.name,
        price: prod.price,
        quantity: 1,
        additionals: [],
        notes: "",
      });
      estimatedTotal += Number(prod.price || 0);
    }
  }

  // Se encontrou itens
  if (matchedItems.length > 0) {
    const hasAddress = text.includes("rua") || text.includes("av") || text.includes("bairro") || Boolean(customer?.address);
    const hasPayment = text.includes("pix") || text.includes("cartão") || text.includes("cartao") || text.includes("dinheiro");

    if (hasAddress && hasPayment) {
      return {
        reply_text: "Perfeito! Já entendi o seu pedido. Gerando confirmação...",
        is_complete: true,
        customer_name: customer?.name || name || "Cliente",
        items: matchedItems,
        delivery_type: text.includes("retirada") ? "Retirada" : "Entrega",
        delivery_address: customer?.address || "Endereço informado",
        payment_method: text.includes("pix") ? "Pix" : text.includes("cart") ? "Cartão" : "Dinheiro",
        estimated_total: estimatedTotal,
      };
    }

    const itemNames = matchedItems.map((i) => i.name).join(", ");
    const reply = `Anotado: *${itemNames}*! 🍲\nVocê prefere entrega ou retirada no balcão? E qual será a forma de pagamento (Pix, Cartão ou Dinheiro)?`;
    history.push({ role: "model", text: reply });
    return {
      reply_text: reply,
      is_complete: false,
      customer_name: name || "Cliente",
      items: matchedItems,
      estimated_total: estimatedTotal,
    };
  }

  // Resposta natural e conversacional
  const naturalReply = `Olá${nameGreeting}! Como posso te ajudar hoje? Me diga qual prato você gostaria de pedir ou se tem alguma dúvida sobre nosso cardápio! 🍲`;
  history.push({ role: "model", text: naturalReply });
  return {
    reply_text: naturalReply,
    is_complete: false,
    customer_name: name || "Cliente",
    items: [],
    delivery_type: "Entrega",
    delivery_address: "",
    payment_method: "Pendente",
    notes: "",
    estimated_total: 0,
  };
}
