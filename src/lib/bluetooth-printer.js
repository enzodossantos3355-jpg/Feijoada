export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function getPairedPrinter() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("marmita_bt_printer");
  return raw ? JSON.parse(raw) : null;
}

export async function pairPrinter() {
  if (!isBluetoothSupported()) {
    throw new Error("Bluetooth Web API não é suportada neste navegador.");
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
  });

  const info = { name: device.name || "Impressora Bluetooth", id: device.id };
  localStorage.setItem("marmita_bt_printer", JSON.stringify(info));
  return info;
}

export function clearPairedPrinter() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("marmita_bt_printer");
}
