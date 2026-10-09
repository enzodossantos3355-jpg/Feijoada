import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { formatOrderConfirmedMessage } from "./config.js";
import {
  processCustomerMessageWithAI,
  processCustomerAudio,
  validatePixReceipt,
  clearChatHistory,
} from "./aiService.js";
import {
  createPendingOrder,
  getPendingOrder,
  clearPendingOrder,
  registerOrderInPDV,
  setConfirmedOrder,
  getConfirmedOrder,
  confirmOrderPaymentInPDV,
} from "./orderService.js";

// Diretório para salvar as credenciais da sessão do WhatsApp
const AUTH_DIR = path.resolve("./whatsapp_auth");

// Instância ativa do socket
let sock = null;
let currentQRDataUrl = null;
let currentStatus = "disconnected"; // "disconnected" | "connecting" | "qr_ready" | "connected"
let connectedPhone = null;

// Callbacks opcionais para avisar o sistema de PDV
let onOrderConfirmedCallback = null;

/**
 * Registra um callback para quando um pedido for confirmado via WhatsApp
 */
export function setOrderConfirmedCallback(callback) {
  onOrderConfirmedCallback = callback;
}

/**
 * Retorna o status atual da conexão e o QR Code em Data URL
 */
export function getWhatsAppStatus() {
  const hasSession = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;
  return {
    status: currentStatus,
    is_connected: currentStatus === "connected",
    qr_code: currentQRDataUrl,
    phone: connectedPhone,
    has_session: hasSession,
  };
}

/**
 * Desconecta e limpa as credenciais do WhatsApp
 */
export async function disconnectWhatsApp() {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {
    console.warn("[WhatsApp] Erro ao fazer logout do socket:", e);
  } finally {
    sock = null;
    currentStatus = "disconnected";
    currentQRDataUrl = null;
    connectedPhone = null;
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  }
  return { success: true };
}

/**
 * Inicia o bot do WhatsApp usando @whiskeysockets/baileys
 */
export async function startWhatsAppBot() {
  if (currentStatus === "connected" && sock) {
    return { success: true, already_connected: true };
  }

  currentStatus = "connecting";

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version = [2, 3000, 1015901307];
    let isLatest = false;
    try {
      const vResult = await fetchLatestBaileysVersion();
      if (vResult?.version) {
        version = vResult.version;
        isLatest = vResult.isLatest;
      }
    } catch (vErr) {
      console.warn("[WhatsApp] Aviso ao buscar versão recente do Baileys:", vErr.message);
    }

    console.log(`[WhatsApp] Usando Baileys v${version.join(".")} (é a mais recente: ${isLatest})`);

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Marmita Hub PDV", "Chrome", "1.0.0"],
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
    });

  // Atualização das credenciais
  sock.ev.on("creds.update", saveCreds);

  // Monitora o status da conexão
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentStatus = "qr_ready";
      try {
        currentQRDataUrl = await QRCode.toDataURL(qr, {
          width: 320,
          margin: 2,
          color: { dark: "#1C1917", light: "#FFFFFF" },
        });
      } catch (qrErr) {
        console.error("[WhatsApp] Erro ao gerar imagem do QR Code:", qrErr);
      }

      console.log("\n=======================================================");
      console.log("📲 ESCANEIE O QR CODE NO TERMINAL OU NO APP WEB:");
      console.log("=======================================================\n");
      qrcodeTerminal.generate(qr, { small: true });
      console.log("\n(Abra o WhatsApp > Aparelhos conectados > Conectar um aparelho)\n");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const reason = lastDisconnect?.error?.output?.payload?.message || "Desconhecido";

      currentStatus = "disconnected";
      currentQRDataUrl = null;
      connectedPhone = null;

      console.log(`[WhatsApp] Conexão fechada. Motivo: ${reason}. Reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(startWhatsAppBot, 4000);
      } else {
        console.log("[WhatsApp] Sessão encerrada (logged out).");
      }
    } else if (connection === "open") {
      currentStatus = "connected";
      currentQRDataUrl = null;
      connectedPhone = sock?.user?.id ? sock.user.id.split(":")[0].replace(/\D/g, "") : "Conectado";

      console.log("=======================================================");
      console.log(`✅ WHATSAPP CONECTADO COM SUCESSO! Telefone: ${connectedPhone}`);
      console.log("=======================================================");
    }
  });

  // Escuta novas mensagens recebidas
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      // Ignora mensagens enviadas por nós mesmos
      if (msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      // O bot atende exclusivamente conversas individuais com clientes (@s.whatsapp.net).
      // Ignora canais/newsletters (@newsletter), grupos (@g.us), transmissões (@broadcast) e status.
      if (
        !remoteJid.endsWith("@s.whatsapp.net") ||
        remoteJid.endsWith("@newsletter") ||
        remoteJid.endsWith("@g.us") ||
        remoteJid.endsWith("@broadcast") ||
        remoteJid === "status@broadcast"
      ) {
        continue;
      }

      const pushName = msg.pushName || "Cliente";

      // 1. Mensagem de Áudio enviada pelo cliente
      if (msg.message?.audioMessage) {
        console.log(`[WhatsApp] Recebeu ÁUDIO de ${pushName} (${remoteJid})`);
        try {
          await handleCustomerAudio(remoteJid, msg, pushName);
        } catch (err) {
          console.error(`[WhatsApp] Erro ao processar áudio de ${remoteJid}:`, err);
          await sock.sendMessage(remoteJid, {
            text: "Ops! Não consegui ouvir seu áudio com clareza. Você poderia mandar por escrito ou gravar novamente, por favor? 😊",
          });
        }
        continue;
      }

      // 2. Mensagem de Imagem enviada pelo cliente (possível comprovante Pix)
      if (msg.message?.imageMessage) {
        console.log(`[WhatsApp] Recebeu IMAGEM de ${pushName} (${remoteJid})`);
        try {
          await handleCustomerImage(remoteJid, msg, pushName);
        } catch (err) {
          console.error(`[WhatsApp] Erro ao processar imagem de ${remoteJid}:`, err);
          await sock.sendMessage(remoteJid, {
            text: "Recebi sua imagem! Já estou encaminhando para conferência da nossa equipe. 👍",
          });
        }
        continue;
      }

      // 2b. Mensagem de Documento/Arquivo enviada pelo cliente (ex: comprovante PDF do banco)
      if (msg.message?.documentMessage) {
        console.log(`[WhatsApp] Recebeu DOCUMENTO de ${pushName} (${remoteJid})`);
        try {
          await handleCustomerDocument(remoteJid, msg, pushName);
        } catch (err) {
          console.error(`[WhatsApp] Erro ao processar documento de ${remoteJid}:`, err);
          await sock.sendMessage(remoteJid, {
            text: "Recebi seu arquivo de comprovante! Já estou encaminhando para conferência da nossa equipe. 👍",
          });
        }
        continue;
      }

      // 3. Mensagem em Texto
      const messageText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";

      const cleanText = messageText.trim();
      if (!cleanText) continue;

      console.log(`[WhatsApp] Mensagem de ${pushName} (${remoteJid}): "${cleanText}"`);

      try {
        await handleCustomerMessage(remoteJid, cleanText, pushName);
      } catch (err) {
        console.error(`[WhatsApp] Erro ao processar mensagem de ${remoteJid}:`, err);
        await sock.sendMessage(remoteJid, {
          text: "Ops! Tive um pequeno imprevisto aqui. Você poderia repetir sua última mensagem, por favor? 😊",
        });
      }
    }
  });

    return sock;
  } catch (err) {
    console.error("[WhatsApp] Erro ao inicializar o socket do Baileys:", err);
    currentStatus = "disconnected";
    throw err;
  }
}

/**
 * Simula a geração de um QR Code para testes e homologação
 */
export async function simulateQRCode(customPayload = "MarmitaHub-Baileys-Session-Pairing-Test") {
  currentStatus = "qr_ready";
  try {
    currentQRDataUrl = await QRCode.toDataURL(customPayload, {
      width: 320,
      margin: 2,
      color: { dark: "#1C1917", light: "#FFFFFF" },
    });
    return currentQRDataUrl;
  } catch (err) {
    console.error("[WhatsApp] Erro ao gerar QR Code simulado:", err);
    return null;
  }
}

/**
 * Simula a conexão bem sucedida com o WhatsApp (para teste/demonstração)
 */
export function simulateWhatsAppConnect(phone = "5511998765432") {
  currentStatus = "connected";
  connectedPhone = phone;
  currentQRDataUrl = null;
  return { status: currentStatus, is_connected: true, phone: connectedPhone };
}

/**
 * Trata o fluxo da mensagem recebida (mensagens exclusivamente escritas)
 */
async function handleCustomerMessage(remoteJid, messageText, pushName) {
  // Simula digitando
  await sock.sendPresenceUpdate("composing", remoteJid);

  const pendingOrder = getPendingOrder(remoteJid);
  const lowerText = messageText.toLowerCase().trim();

  // -------------------------------------------------------------
  // CENÁRIO 1: O cliente tem um pedido aguardando e digitou "1"
  // -------------------------------------------------------------
  if (pendingOrder) {
    const isConfirmation =
      lowerText === "1" ||
      lowerText === "sim" ||
      lowerText === "confirmar" ||
      lowerText === "confirmo" ||
      lowerText === "pode confirmar";

    if (isConfirmation) {
      console.log(`[WhatsApp] Pedido #${pendingOrder.orderCode} CONFIRMADO por ${pushName}!`);

      // Dispara a mensagem final de confirmação escrita
      const confirmationMsg = formatOrderConfirmedMessage(pendingOrder.orderCode);
      await sock.sendMessage(remoteJid, { text: confirmationMsg });

      // Grava o pedido diretamente no sistema de PDV
      const cleanPhone = remoteJid.replace("@s.whatsapp.net", "");
      await registerOrderInPDV(pendingOrder, cleanPhone);

      // Salva no histórico de pedidos confirmados para validação de comprovante Pix
      setConfirmedOrder(remoteJid, pendingOrder);

      // Notifica o PDV (se callback registrado)
      if (onOrderConfirmedCallback) {
        try {
          await onOrderConfirmedCallback({
            ...pendingOrder,
            phone: cleanPhone,
            confirmedAt: new Date().toISOString(),
          });
        } catch (callbackErr) {
          console.error("[WhatsApp] Erro ao salvar pedido no PDV:", callbackErr);
        }
      }

      // Limpa os estados da conversa e do rascunho
      clearPendingOrder(remoteJid);
      clearChatHistory(remoteJid);
      return;
    }

    // Se o cliente quiser cancelar
    if (lowerText === "cancelar" || lowerText === "cancela") {
      clearPendingOrder(remoteJid);
      clearChatHistory(remoteJid);
      await sock.sendMessage(remoteJid, {
        text: "Sem problemas! O seu pedido foi cancelado. Se quiser fazer um novo pedido, é só me chamar! 😉",
      });
      return;
    }

    // Se não for "1" nem cancelamento, ele quer alterar algo
    clearPendingOrder(remoteJid);
  }

  // -------------------------------------------------------------
  // CENÁRIO 2: Conversa com a IA para tirar dúvidas e extrair dados
  // -------------------------------------------------------------
  const aiResult = await processCustomerMessageWithAI(remoteJid, messageText, pushName);

  // -------------------------------------------------------------
  // CENÁRIO 3: Pedido COMPLETO -> Gera CÓDIGO e dispara resumo formatado
  // -------------------------------------------------------------
  if (aiResult.is_complete) {
    console.log(`[WhatsApp] IA identificou pedido COMPLETO para ${pushName}! Gerando código e resumo...`);

    // Cria o pedido pendente com CÓDIGO ÚNICO e mensagem de resumo formatada
    const newPendingOrder = createPendingOrder(remoteJid, {
      ...aiResult,
      customer_name: aiResult.customer_name || pushName,
    });

    console.log(`[WhatsApp] Disparando resumo do pedido #${newPendingOrder.orderCode}`);

    // Dispara a mensagem formatada de confirmação pelo WhatsApp exatamente como solicitado
    await sock.sendMessage(remoteJid, {
      text: newPendingOrder.summaryMessage,
    });
    return;
  }

  // -------------------------------------------------------------
  // CENÁRIO 4: Dúvida ou pedido incompleto -> IA responde somente em texto
  // -------------------------------------------------------------
  const replyMessage =
    aiResult.reply_text ||
    "Entendido! Me conta mais detalhes: qual o tamanho da marmita e se prefere entrega ou retirada?";

  await sock.sendMessage(remoteJid, {
    text: replyMessage,
  });
}

/**
 * Trata mensagem de Áudio enviada pelo cliente no WhatsApp
 */
async function handleCustomerAudio(remoteJid, msg, pushName) {
  // Mostra "gravando áudio..." ou "digitando..."
  await sock.sendPresenceUpdate("composing", remoteJid);

  console.log(`[WhatsApp - Audio] Baixando buffer de áudio de ${pushName}...`);
  let audioBuffer;
  try {
    audioBuffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (dlErr) {
    console.warn(`[WhatsApp - Audio] Não foi possível descriptografar/baixar áudio de ${remoteJid}:`, dlErr.message);
    await sock.sendMessage(remoteJid, {
      text: "Ops! Não consegui ouvir seu áudio com clareza. Você poderia mandar por escrito ou gravar novamente, por favor? 😊",
    });
    return;
  }
  const mimetype = msg.message?.audioMessage?.mimetype || "audio/ogg";

  // Envia para o Gemini Flash ouvir e transcrever o áudio
  const aiResult = await processCustomerAudio(audioBuffer, mimetype, remoteJid, pushName);

  // Se o áudio já continha todos os dados para fechar o pedido
  if (aiResult.is_complete) {
    console.log(`[WhatsApp - Audio] Pedido completo identificado no áudio de ${pushName}! Gerando código...`);
    const newPendingOrder = createPendingOrder(remoteJid, {
      ...aiResult,
      customer_name: aiResult.customer_name || pushName,
    });
    await sock.sendMessage(remoteJid, {
      text: newPendingOrder.summaryMessage,
    });
    return;
  }

  // Resposta natural e conversacional da IA em texto
  const replyMessage =
    aiResult.reply_text ||
    "Entendi seu áudio! Me diga se você prefere entrega ou retirada e qual o endereço, por favor.";

  await sock.sendMessage(remoteJid, {
    text: replyMessage,
  });
}

/**
 * Trata mensagem de Imagem enviada pelo cliente (possível comprovante Pix)
 */
async function handleCustomerImage(remoteJid, msg, pushName) {
  await sock.sendPresenceUpdate("composing", remoteJid);

  console.log(`[WhatsApp - Pix] Baixando imagem de ${pushName}...`);
  let imageBuffer;
  try {
    imageBuffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (dlErr) {
    console.warn(`[WhatsApp - Pix] Não foi possível descriptografar/baixar imagem de ${remoteJid}:`, dlErr.message);
    await sock.sendMessage(remoteJid, {
      text: "Recebi sua imagem, mas não consegui abri-la claramente. Se for um comprovante Pix, poderia reenviá-lo em boa qualidade ou em arquivo PDF, por favor? 🧾",
    });
    return;
  }
  const mimetype = msg.message?.imageMessage?.mimetype || "image/jpeg";
  const caption = msg.message?.imageMessage?.caption || "";

  // Envia para o Gemini Flash analisar se é comprovante Pix e conferir o valor
  const validation = await validatePixReceipt(imageBuffer, mimetype, remoteJid, pushName, caption);

  // Se o comprovante Pix for válido e aprovado
  if (validation.is_valid && validation.order_code) {
    console.log(`[WhatsApp - Pix] Comprovante Pix aprovado para #${validation.order_code}!`);

    // Atualiza status do pedido no PDV
    await confirmOrderPaymentInPDV(validation.order_code, validation.paid_amount);

    // Se o pedido ainda estava aguardando no rascunho, confirma ele
    const pending = getPendingOrder(remoteJid);
    if (pending) {
      const cleanPhone = remoteJid.replace("@s.whatsapp.net", "");
      await registerOrderInPDV(
        {
          ...pending,
          paymentMethod: `Pix (Validado R$ ${validation.paid_amount.toFixed(2)})`,
        },
        cleanPhone
      );
      setConfirmedOrder(remoteJid, pending);
      clearPendingOrder(remoteJid);
      clearChatHistory(remoteJid);
    }
  }

  // Envia resposta explicativa para o cliente
  await sock.sendMessage(remoteJid, {
    text: validation.reply_text,
  });
}

/**
 * Trata documento recebido (ex: PDF ou documento exportado do banco)
 */
async function handleCustomerDocument(remoteJid, msg, pushName) {
  await sock.sendPresenceUpdate("composing", remoteJid);

  console.log(`[WhatsApp - Pix] Baixando documento de ${pushName}...`);
  let docBuffer;
  try {
    docBuffer = await downloadMediaMessage(msg, "buffer", {});
  } catch (dlErr) {
    console.warn(`[WhatsApp - Pix] Não foi possível descriptografar/baixar documento de ${remoteJid}:`, dlErr.message);
    await sock.sendMessage(remoteJid, {
      text: "Recebi seu arquivo, mas não foi possível carregá-lo. Poderia reenviar o comprovante legível por favor? 📄",
    });
    return;
  }
  const mimetype = msg.message?.documentMessage?.mimetype || "application/pdf";
  const caption = msg.message?.documentMessage?.caption || "";

  const validation = await validatePixReceipt(docBuffer, mimetype, remoteJid, pushName, caption);

  if (validation.is_valid && validation.order_code) {
    console.log(`[WhatsApp - Pix] Comprovante em documento aprovado para #${validation.order_code}!`);
    await confirmOrderPaymentInPDV(validation.order_code, validation.paid_amount);

    const pending = getPendingOrder(remoteJid);
    if (pending) {
      const cleanPhone = remoteJid.replace("@s.whatsapp.net", "");
      await registerOrderInPDV(
        {
          ...pending,
          paymentMethod: `Pix (Validado R$ ${validation.paid_amount.toFixed(2)})`,
        },
        cleanPhone
      );
      setConfirmedOrder(remoteJid, pending);
      clearPendingOrder(remoteJid);
      clearChatHistory(remoteJid);
    }
  }

  await sock.sendMessage(remoteJid, {
    text: validation.reply_text,
  });
}

/**
 * Função para simular mensagem de cliente para testes (usada pela interface e testes)
 */
export async function simulateCustomerMessage(phone, messageText, pushName = "Cliente Teste") {
  const remoteJid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
  const result = await processCustomerMessageWithAI(remoteJid, messageText, pushName);

  if (result.is_complete) {
    const pendingOrder = createPendingOrder(remoteJid, {
      ...result,
      customer_name: result.customer_name || pushName,
    });
    return {
      ...result,
      summaryMessage: pendingOrder.summaryMessage,
      orderCode: pendingOrder.orderCode,
    };
  }

  return result;
}

/**
 * Função para simular validação de comprovante Pix para testes
 */
export async function simulatePixReceiptValidation(
  phone,
  amount,
  pushName = "Cliente Teste",
  scenario = null,
  imageBase64 = null
) {
  const cleanDigits = phone.replace(/\D/g, "");
  const remoteJid = `${cleanDigits}@s.whatsapp.net`;

  // Se uma imagem real foi enviada, executa a análise multimodal completa com o Gemini Flash
  if (imageBase64) {
    const buffer = Buffer.from(imageBase64, "base64");
    const validation = await validatePixReceipt(buffer, "image/jpeg", remoteJid, pushName);
    if (validation.is_valid && validation.order_code) {
      await confirmOrderPaymentInPDV(validation.order_code, validation.paid_amount);
    }
    return validation;
  }

  // Cenário de teste: Imagem que não é comprovante
  if (scenario === "invalid") {
    return {
      is_valid: false,
      is_scheduled: false,
      paid_amount: 0,
      reply_text:
        "Recebi sua imagem, mas não consegui identificar um comprovante Pix nela. Se você já realizou o pagamento, poderia nos enviar a foto ou arquivo do comprovante bancário por favor? 🧾",
    };
  }

  // Consulta pedidos em memória ou no PDV
  let pendingOrder = getPendingOrder(remoteJid);
  let confirmedOrder = getConfirmedOrder(remoteJid);
  let targetOrder = pendingOrder || confirmedOrder;

  if (!targetOrder && cleanDigits) {
    try {
      const res = await fetch(`http://localhost:3000/api/whatsapp/active-order?phone=${cleanDigits}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.order) {
          targetOrder = {
            orderCode: data.order.order_code || data.order.order_id,
            total: Number(data.order.total || 0),
            customer_name: data.order.customer_name || pushName,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  const expectedTotal = targetOrder ? Number(targetOrder.total || 0) : 25.0;
  const orderCode = targetOrder ? targetOrder.orderCode : "PED-9821";
  const paid = Number(amount);

  // Cenário de teste: Comprovante Agendado
  if (scenario === "scheduled") {
    return {
      is_valid: false,
      is_scheduled: true,
      paid_amount: paid,
      expected_total: expectedTotal,
      order_code: orderCode,
      reply_text: `⚠️ *Atenção:* Identificamos que este comprovante é um *Agendamento de Pix* para uma data futura, e não uma transferência imediata realizada hoje.\nPara que a cozinha possa preparar seu pedido #${orderCode}, por favor realize o pagamento imediato e nos envie o comprovante! 👍`,
    };
  }

  // Verificação de valor exato ou maior
  if (paid >= expectedTotal - 0.05) {
    if (orderCode) {
      await confirmOrderPaymentInPDV(orderCode, paid);
    }
    return {
      is_valid: true,
      paid_amount: paid,
      expected_total: expectedTotal,
      order_code: orderCode,
      bank_name: "Nubank S.A.",
      reply_text: `✅ *COMPROVANTE PIX VALIDADO COM SUCESSO!* 🎉\n━━━━━━━━━━━━━━━━━━\n💰 *Valor recebido:* R$ ${paid.toFixed(2).replace(".", ",")}\n📋 *Pedido:* #${orderCode}\n🏦 *Instituição:* Nubank S.A.\n━━━━━━━━━━━━━━━━━━\nSeu pagamento foi confirmado no sistema e a cozinha já está preparando o seu pedido! Obrigado pela preferência! 🍲😋`,
    };
  } else {
    // Valor menor que o esperado (informa a diferença)
    const diff = expectedTotal - paid;
    return {
      is_valid: false,
      paid_amount: paid,
      expected_total: expectedTotal,
      order_code: orderCode,
      bank_name: "Banco Inter",
      reply_text: `⚠️ *Atenção no valor do comprovante Pix:*\n━━━━━━━━━━━━━━━━━━\nIdentificamos o comprovante no valor de *R$ ${paid.toFixed(2).replace(".", ",")}*.\nPorém, o valor total do pedido #${orderCode} é de *R$ ${expectedTotal.toFixed(2).replace(".", ",")}*.\n\nFalta o valor de *R$ ${diff.toFixed(2).replace(".", ",")}*.\n━━━━━━━━━━━━━━━━━━\nPoderia por gentileza realizar a complementação e nos enviar o novo comprovante para que a cozinha possa iniciar o preparo? 😊`,
    };
  }
}

/**
 * Função para enviar mensagem manual via WhatsApp pelo sistema
 */
export async function sendWhatsAppMessage(toPhone, text) {
  if (!sock) {
    throw new Error("WhatsApp não está conectado no momento.");
  }

  let cleanNumber = toPhone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = `55${cleanNumber}`;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  return await sock.sendMessage(jid, { text });
}

// =========================================================================
// SISTEMA DE MONITORAMENTO DE SAÚDE: VERIFICAÇÃO DE 5 EM 5 MINUTOS DO WHATSAPP
// =========================================================================
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos = 300.000 ms
let healthCheckTimer = null;
let lastHealthCheckTime = new Date();
let nextHealthCheckTime = new Date(Date.now() + HEALTH_CHECK_INTERVAL_MS);
let healthCheckHistory = [];
let totalHealthChecks = 0;

/**
 * Executa uma verificação da atividade e conectividade do WhatsApp
 */
export function checkWhatsAppHealth() {
  const now = new Date();
  totalHealthChecks += 1;
  lastHealthCheckTime = now;
  nextHealthCheckTime = new Date(now.getTime() + HEALTH_CHECK_INTERVAL_MS);

  const isSocketOpen = Boolean(sock && sock.ws && sock.ws.isOpen);
  const isActive = currentStatus === "connected" || isSocketOpen;

  let message = "";
  let status = "";

  if (currentStatus === "connected") {
    status = "healthy";
    message = `WhatsApp conectado e ativo (+${connectedPhone || "pareado"}). Socket pronto para mensagens.`;
    console.log(`[WhatsApp - Monitor 5min] ✅ Checagem #${totalHealthChecks}: WhatsApp está ATIVO e operacional.`);
  } else if (currentStatus === "qr_ready") {
    status = "qr_pending";
    message = "WhatsApp aguardando leitura do QR Code pelo celular.";
    console.log(`[WhatsApp - Monitor 5min] ⚠️ Checagem #${totalHealthChecks}: WhatsApp aguardando leitura do QR Code.`);
  } else if (currentStatus === "connecting") {
    status = "connecting";
    message = "WhatsApp em processo de inicialização e conexão.";
    console.log(`[WhatsApp - Monitor 5min] 🔄 Checagem #${totalHealthChecks}: Conexão em andamento.`);
  } else {
    status = "disconnected";
    message = "WhatsApp inativo ou desconectado.";
    console.log(`[WhatsApp - Monitor 5min] 🔴 Checagem #${totalHealthChecks}: WhatsApp INATIVO.`);

    // Auto-recuperação: se tem credenciais salvas mas desconectou, tenta reconectar
    const hasSession = fs.existsSync(AUTH_DIR) && fs.readdirSync(AUTH_DIR).length > 0;
    if (hasSession && currentStatus === "disconnected") {
      console.log("[WhatsApp - Monitor 5min] Sessão ativa detectada no disco. Tentando reconexão automática...");
      try {
        startWhatsAppBot();
      } catch (err) {
        console.error("[WhatsApp - Monitor 5min] Falha ao tentar reconectar automaticamente:", err.message);
      }
    }
  }

  const checkRecord = {
    check_number: totalHealthChecks,
    checked_at: now.toISOString(),
    status,
    is_active: isActive,
    phone: connectedPhone,
    message,
  };

  healthCheckHistory.unshift(checkRecord);
  if (healthCheckHistory.length > 20) {
    healthCheckHistory.pop();
  }

  return {
    is_active: isActive,
    status,
    current_state: currentStatus,
    phone: connectedPhone,
    last_checked_at: lastHealthCheckTime.toISOString(),
    next_check_at: nextHealthCheckTime.toISOString(),
    interval_minutes: 5,
    interval_ms: HEALTH_CHECK_INTERVAL_MS,
    total_checks: totalHealthChecks,
    message,
    history: healthCheckHistory,
  };
}

/**
 * Retorna as informações do monitor de saúde sem alterar o agendamento
 */
export function getWhatsAppHealth() {
  const isSocketOpen = Boolean(sock && sock.ws && sock.ws.isOpen);
  const isActive = currentStatus === "connected" || isSocketOpen;
  return {
    is_active: isActive,
    status: currentStatus === "connected" ? "healthy" : currentStatus,
    current_state: currentStatus,
    phone: connectedPhone,
    last_checked_at: lastHealthCheckTime.toISOString(),
    next_check_at: nextHealthCheckTime.toISOString(),
    interval_minutes: 5,
    interval_ms: HEALTH_CHECK_INTERVAL_MS,
    total_checks: totalHealthChecks,
    history: healthCheckHistory,
  };
}

/**
 * Inicia o loop automático de 5 em 5 minutos
 */
export function startHealthCheckMonitor() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }
  // Checagem inicial rápida em 5 segundos
  setTimeout(() => {
    checkWhatsAppHealth();
  }, 5000);

  // Intervalo recorrente de 5 em 5 minutos (300.000 ms)
  healthCheckTimer = setInterval(() => {
    checkWhatsAppHealth();
  }, HEALTH_CHECK_INTERVAL_MS);

  console.log("[WhatsApp] ⏱️ Monitor periódico ativo: verificando o status do WhatsApp a cada 5 minutos.");
}

// Inicia automaticamente o monitor ao inicializar
startHealthCheckMonitor();

