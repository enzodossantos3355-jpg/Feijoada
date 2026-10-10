import {
  formatOrderInReviewMessage,
  formatOrderApprovedMessage,
  formatOrderReadyMessage,
  formatOrderOutForDeliveryMessage,
  formatOrderCompletedMessage,
  formatHumanHandoffMessage,
} from "./config.js";

// Armazenamento em memória de pedidos em rascunho / análise
const pendingOrders = new Map();
const confirmedOrders = new Map();

// Armazenamento em memória das conversas e atendimentos do WhatsApp
const chats = new Map();

// Fila de notificações para o sistema (com som)
let notifications = [];

/**
 * Cria ou recupera uma conversa do WhatsApp
 */
export function getOrCreateChat(phone, customerName = "") {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const chatId = cleanPhone || String(phone);

  if (!chats.has(chatId)) {
    chats.set(chatId, {
      chat_id: chatId,
      phone: cleanPhone,
      customer_name: customerName || "Cliente",
      status: "bot_active", // "bot_active" | "needs_human" | "human_active" | "in_review" | "completed"
      is_human_controlled: false,
      unread: false,
      unread_count: 0,
      messages: [],
      order_id: null,
      order_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const chat = chats.get(chatId);
  if (customerName && (!chat.customer_name || chat.customer_name === "Cliente")) {
    chat.customer_name = customerName;
  }
  return chat;
}

/**
 * Registra uma mensagem na conversa do WhatsApp
 */
export function addChatMessage(phone, { sender = "customer", text = "", mediaType = "text", pushName = "" }) {
  const chat = getOrCreateChat(phone, pushName);
  const msgObj = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender, // "customer" | "bot" | "attendant"
    text,
    mediaType,
    timestamp: new Date().toISOString(),
  };

  chat.messages.push(msgObj);
  chat.updated_at = msgObj.timestamp;

  if (sender === "customer") {
    chat.unread = true;
    chat.unread_count = (chat.unread_count || 0) + 1;
  }

  // Limita histórico a 50 mensagens por conversa
  if (chat.messages.length > 50) {
    chat.messages.splice(0, chat.messages.length - 50);
  }

  return msgObj;
}

/**
 * Retorna todas as conversas ativas
 */
export function getAllChats() {
  return Array.from(chats.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/**
 * Retorna uma conversa específica
 */
export function getChat(phone) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  return chats.get(cleanPhone) || null;
}

/**
 * Atualiza o status de uma conversa
 */
export function setChatStatus(phone, status, meta = {}) {
  const chat = getOrCreateChat(phone);
  chat.status = status;
  if (meta.order_id) chat.order_id = meta.order_id;
  if (meta.order_code) chat.order_code = meta.order_code;
  if (meta.customer_name) chat.customer_name = meta.customer_name;
  if (typeof meta.is_human_controlled === "boolean") {
    chat.is_human_controlled = meta.is_human_controlled;
  }
  chat.updated_at = new Date().toISOString();
  return chat;
}

/**
 * Alterna entre controle do Bot e Atendente Humano
 */
export function toggleChatHumanMode(phone, enableHuman = true) {
  const chat = getOrCreateChat(phone);
  chat.is_human_controlled = enableHuman;
  chat.status = enableHuman ? "human_active" : "bot_active";
  chat.updated_at = new Date().toISOString();
  return chat;
}

/**
 * Adiciona uma notificação no sistema (com som)
 */
export function addNotification({
  type = "new_order", // "new_order" | "needs_human" | "status_update"
  title,
  message,
  phone = "",
  order_id = "",
  order_code = "",
  customer_name = "",
}) {
  const notif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    title: title || (type === "needs_human" ? "🚨 Atendimento Humano Solicitado" : "🔔 Novo Pedido Anotado"),
    message: message || "Novo evento recebido no WhatsApp.",
    phone,
    order_id,
    order_code,
    customer_name,
    read: false,
    timestamp: new Date().toISOString(),
  };

  notifications.unshift(notif);
  if (notifications.length > 40) {
    notifications.pop();
  }

  console.log(`[Notificação ${type.toUpperCase()}] ${notif.title}: ${notif.message}`);
  return notif;
}

/**
 * Retorna a lista de notificações
 */
export function getNotifications() {
  return notifications;
}

/**
 * Marca notificação como lida
 */
export function markNotificationRead(id) {
  const notif = notifications.find((n) => n.id === id);
  if (notif) notif.read = true;
  return notif;
}

/**
 * Limpa ou marca todas como lidas
 */
export function clearAllNotifications() {
  notifications.forEach((n) => (n.read = true));
  return { success: true };
}

/**
 * Cria pedido pendente / em análise quando a IA identifica pedido completo
 */
export function createPendingOrder(remoteJid, orderData) {
  const cleanPhone = remoteJid.replace(/\D/g, "");
  const orderCode = `PED-${Math.floor(1000 + Math.random() * 9000)}`;

  const pending = {
    ...orderData,
    remoteJid,
    phone: cleanPhone,
    orderCode,
    status: "Em Análise",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pending.summaryMessage = formatOrderInReviewMessage(pending);

  pendingOrders.set(remoteJid, pending);
  pendingOrders.set(cleanPhone, pending);

  // Atualiza a conversa correspondente
  const chat = getOrCreateChat(cleanPhone, orderData.customer_name);
  chat.status = "in_review";
  chat.order_code = orderCode;

  // Dispara notificação com som no sistema de Novo Pedido em Análise
  addNotification({
    type: "new_order",
    title: `🔔 Novo Pedido #${orderCode} em Análise`,
    message: `${orderData.customer_name || "Cliente"} - Total: R$ ${Number(orderData.estimated_total || 0).toFixed(2)} (${orderData.items?.length || 1} itens)`,
    phone: cleanPhone,
    order_code: orderCode,
    customer_name: orderData.customer_name || "Cliente",
  });

  return pending;
}

export function getPendingOrder(phone) {
  const clean = String(phone).replace(/\D/g, "");
  return pendingOrders.get(phone) || pendingOrders.get(clean) || null;
}

export function savePendingOrder(phone, order) {
  const clean = String(phone).replace(/\D/g, "");
  pendingOrders.set(phone, { ...order, updatedAt: new Date().toISOString() });
  pendingOrders.set(clean, { ...order, updatedAt: new Date().toISOString() });
}

export function clearPendingOrder(phone) {
  const clean = String(phone).replace(/\D/g, "");
  pendingOrders.delete(phone);
  pendingOrders.delete(clean);
}

export function getConfirmedOrder(phone) {
  const clean = String(phone).replace(/\D/g, "");
  return confirmedOrders.get(phone) || confirmedOrders.get(clean) || null;
}

export function setConfirmedOrder(phone, order) {
  const clean = String(phone).replace(/\D/g, "");
  confirmedOrders.set(phone, order);
  confirmedOrders.set(clean, order);
}

export function confirmOrder(phone, order) {
  const clean = String(phone).replace(/\D/g, "");
  const confirmed = {
    ...order,
    order_id: order.orderCode || `PED-${Date.now().toString().slice(-6)}`,
    status: "Novo",
    confirmedAt: new Date().toISOString(),
  };
  confirmedOrders.set(phone, confirmed);
  confirmedOrders.set(clean, confirmed);
  pendingOrders.delete(phone);
  pendingOrders.delete(clean);
  return confirmed;
}

/**
 * Grava o pedido anotado pela IA no PDV com status "Em Análise"
 */
export function registerOrderInPDV(pendingOrder, cleanPhone) {
  try {
    const port = process.env.PORT || 3000;
    fetch(`http://127.0.0.1:${port}/api/whatsapp/internal-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_code: pendingOrder.orderCode,
        customer_name: pendingOrder.customer_name,
        customer_phone: cleanPhone,
        delivery_type: pendingOrder.delivery_type || "Entrega",
        address: pendingOrder.delivery_address || "",
        items: pendingOrder.items || [],
        payment_method: pendingOrder.payment_method || "Pendente",
        delivery_fee: pendingOrder.delivery_fee || 0,
        notes: pendingOrder.notes || "",
        status: "Em Análise", // Entra em análise para a equipe conferir e aprovar
        total: pendingOrder.estimated_total || pendingOrder.total || 0,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.order?.order_id) {
          const chat = getOrCreateChat(cleanPhone);
          chat.order_id = data.order.order_id;
          chat.status = "in_review";
        }
      })
      .catch((err) => {
        console.warn("[OrderService] Erro ao cadastrar pedido no PDV:", err.message);
      });
  } catch (e) {
    console.warn("[OrderService] Falha na chamada registerOrderInPDV:", e.message);
  }
}

/**
 * Confirma pagamento de pedido no PDV
 */
export async function confirmOrderPaymentInPDV(orderCode, paidAmount) {
  try {
    const port = process.env.PORT || 3000;
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_code: orderCode,
        paid_amount: paidAmount,
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[OrderService] Erro ao confirmar pagamento no PDV:", e.message);
    return { success: false };
  }
}
