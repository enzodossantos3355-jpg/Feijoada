export function getAutoPrint() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("marmita_auto_print") === "true";
}

export function setAutoPrint(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem("marmita_auto_print", enabled ? "true" : "false");
}

export function printReceipt(order) {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank", "width=380,height=600");
  if (!printWindow) {
    window.print();
    return;
  }

  const itemsHtml = (order.items || [])
    .map(
      (it) => `
      <div style="display:flex; justify-content:space-between; margin:4px 0; font-size:13px;">
        <span>${it.quantity || 1}x ${it.name || "Item"}</span>
        <span>R$ ${Number(it.price || it.unit_price || 0).toFixed(2)}</span>
      </div>
    `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Comprovante #${order.order_id || order.id || ""}</title>
        <style>
          body {
            font-family: monospace;
            padding: 16px;
            max-width: 340px;
            margin: 0 auto;
            color: #000;
          }
          .title { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 4px; }
          .sub { text-align: center; font-size: 11px; margin-bottom: 12px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
          .total { font-weight: bold; font-size: 15px; margin-top: 6px; }
          .footer { text-align: center; font-size: 11px; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="title">MARMITA HUB</div>
        <div class="sub">Comprovante de Pedido #${order.order_id || order.id || ""}</div>
        <div class="divider"></div>
        <div class="row"><span>Cliente:</span><span>${order.customer_name || "Balcão"}</span></div>
        <div class="row"><span>Telefone:</span><span>${order.customer_phone || "—"}</span></div>
        <div class="row"><span>Tipo:</span><span>${order.delivery_type || "Entrega"}</span></div>
        ${order.address ? `<div class="row"><span>Endereço:</span><span>${order.address}</span></div>` : ""}
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="row total"><span>TOTAL:</span><span>R$ ${Number(order.total || 0).toFixed(2)}</span></div>
        <div class="row"><span>Pagamento:</span><span>${order.payment_method || "Pendente"}</span></div>
        ${order.notes ? `<div class="row" style="margin-top:6px;"><span>Obs:</span><span>${order.notes}</span></div>` : ""}
        <div class="divider"></div>
        <div class="footer">Obrigado pela preferência!<br/>Bom apetite! 🍲</div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
