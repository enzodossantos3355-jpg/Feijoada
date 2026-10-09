const pendingOrders = new Map();
const confirmedOrders = new Map();

export function getPendingOrder(phone) {
  return pendingOrders.get(phone) || null;
}

export function savePendingOrder(phone, order) {
  pendingOrders.set(phone, { ...order, updatedAt: new Date().toISOString() });
}

export function clearPendingOrder(phone) {
  pendingOrders.delete(phone);
}

export function getConfirmedOrder(phone) {
  return confirmedOrders.get(phone) || null;
}

export function confirmOrder(phone, order) {
  const confirmed = {
    ...order,
    order_id: `PED-${Date.now().toString().slice(-6)}`,
    status: "Confirmado",
    confirmedAt: new Date().toISOString(),
  };
  confirmedOrders.set(phone, confirmed);
  pendingOrders.delete(phone);
  return confirmed;
}
