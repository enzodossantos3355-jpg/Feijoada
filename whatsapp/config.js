export const STORE_SETTINGS = {
  name: "Marmitaria Bom Sabor",
  phone: "5511999998888",
  pixKey: "11999998888",
  deliveryFee: 5.0,
  address: "Rua do Sabor, 150 - Centro, São Paulo - SP",
  mapsUrl: "https://maps.google.com/?q=Rua+do+Sabor+150+Sao+Paulo",
  businessHours: "Segunda a Sábado das 10h30 às 15h00 e das 18h00 às 22h00",
  scheduledDelivery: {
    fee: 3.0,
    availableWindows: ["11:30 - 12:30", "12:30 - 13:30", "18:30 - 19:30"],
  },
};

export const BOT_TAG = "";

export const AI_BEHAVIOR_PROMPT = `Você é a atendente virtual simpática, ágil e acolhedora da Marmitaria Bom Sabor.
Responda sempre em português do Brasil com entusiasmo leve e emojis adequados.
Ao apresentar pratos, destaque sabores e ingredientes.`;

/**
 * Mensagem enviada quando a IA anota o pedido completo: entra em análise pela equipe
 */
export function formatOrderInReviewMessage(order) {
  const code = order.orderCode || order.order_id || "PEDIDO";
  const itemsText = (order.items || [])
    .map((it) => {
      const adds = (it.additionals || []).length > 0
        ? `\n   + Adicionais: ${it.additionals.map((a) => a.name).join(", ")}`
        : "";
      const obs = it.notes ? `\n   (Obs: ${it.notes})` : "";
      return `• *${it.quantity || 1}x ${it.name}* - R$ ${(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2).replace(".", ",")}${adds}${obs}`;
    })
    .join("\n");

  const total = Number(order.estimated_total || order.total || 0).toFixed(2).replace(".", ",");
  const deliveryType = order.delivery_type || "Entrega";
  const address = order.delivery_address || order.address || "Balcão";
  const payment = order.payment_method || "A combinar";

  return `📋 *RESUMO DO SEU PEDIDO (#${code})*
━━━━━━━━━━━━━━━━━━
${itemsText}
━━━━━━━━━━━━━━━━━━
🛵 *Tipo:* ${deliveryType}
📍 *Endereço:* ${address}
💳 *Pagamento:* ${payment}
💰 *Total Estimado:* R$ ${total}
━━━━━━━━━━━━━━━━━━

⏳ *SEU PEDIDO ESTÁ EM ANÁLISE!*
Nossa equipe está conferindo os itens e a disponibilidade na cozinha.
Assim que for aprovado, avisaremos você por aqui imediatamente! 😊👍`;
}

/**
 * Mensagem enviada quando o operador aprova o pedido no PDV
 */
export function formatOrderApprovedMessage(order) {
  const code = order.orderCode || order.order_id || "";
  return `🎉 *PEDIDO APROVADO COM SUCESSO!*
━━━━━━━━━━━━━━━━━━
Olá! O seu pedido *#${code}* foi conferido e *APROVADO* pela nossa equipe! ✅
A cozinha já está preparando suas marmitas com todo capricho! 🍲🔥

Você receberá novas atualizações assim que estiver pronto! Obrigado pela preferência!`;
}

/**
 * Mensagem enviada quando o status do pedido muda para "Pronto"
 */
export function formatOrderReadyMessage(order) {
  const code = order.orderCode || order.order_id || "";
  const isRetirada = (order.delivery_type || "").toLowerCase().includes("retirada");

  if (isRetirada) {
    return `🍽️ *SEU PEDIDO ESTÁ PRONTO PARA RETIRADA!*
━━━━━━━━━━━━━━━━━━
O seu pedido *#${code}* já está prontinho, quentinho e embalado no balcão! 😋
Pode vir retirar quando quiser! Estamos te esperando.`;
  }

  return `🍽️ *SEU PEDIDO ESTÁ PRONTO!*
━━━━━━━━━━━━━━━━━━
O seu pedido *#${code}* acabou de ficar pronto na cozinha! 🍲
Estamos embalando com cuidado e aguardando o entregador para a saída.`;
}

/**
 * Mensagem enviada quando o status do pedido muda para "Em Entrega"
 */
export function formatOrderOutForDeliveryMessage(order) {
  const code = order.orderCode || order.order_id || "";
  const address = order.address || order.delivery_address || "seu endereço";

  return `🛵💨 *SEU PEDIDO SAIU PARA ENTREGA!*
━━━━━━━━━━━━━━━━━━
O pedido *#${code}* já está a caminho com nosso entregador!
📍 *Destino:* ${address}

Por favor, fique atento à campainha ou interfone. Bom apetite em breve! 📦😋`;
}

/**
 * Mensagem enviada quando o status do pedido muda para "Concluído"
 */
export function formatOrderCompletedMessage(order) {
  const code = order.orderCode || order.order_id || "";
  const itemsText = (order.items || [])
    .map((it) => `• ${it.quantity || 1}x ${it.name}`)
    .join("\n");
  const total = Number(order.total || order.estimated_total || 0).toFixed(2).replace(".", ",");
  const payment = order.payment_method || "Confirmado";

  return `🎉 *PEDIDO ENTREGUE E CONCLUÍDO!*
━━━━━━━━━━━━━━━━━━
Esperamos que sua refeição esteja saborosa e quentinha! 🍲❤️

📋 *Resumo do Pedido #${code}:*
${itemsText}
💰 *Total Pago:* R$ ${total}
💳 *Forma de Pagamento:* ${payment}
━━━━━━━━━━━━━━━━━━
Muito obrigado por escolher a Marmita Hub! Tenha um excelente dia e até o próximo pedido! 😊`;
}

/**
 * Mensagem enviada quando o bot transfere o atendimento para atendente humano
 */
export function formatHumanHandoffMessage(reason = "") {
  return `👨‍🍳 *TRANSFERINDO PARA ATENDIMENTO HUMANO*
━━━━━━━━━━━━━━━━━━
Não consegui compreender todos os detalhes ou finalizar o atendimento automaticamente.
Já notifiquei nossa equipe e um de nossos atendentes humanos vai continuar a conversa com você por aqui em instantes!

Por favor, aguarde só um momento. 👍`;
}

/**
 * Retrocompatibilidade
 */
export function formatOrderConfirmedMessage(orderCode) {
  return `✅ *PEDIDO #${orderCode} RECEBIDO!*
Seu pedido foi registrado em nossa fila. Muito obrigado pela preferência! 🍲`;
}

