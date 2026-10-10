import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import JSZip from "jszip";
import {
  getWhatsAppStatus,
  startWhatsAppBot,
  forceReconnectWhatsApp,
  disconnectWhatsApp,
  simulateWhatsAppConnect,
  simulateQRCode,
  simulateCustomerMessage,
  simulatePixReceiptValidation,
  getWhatsAppHealth,
  checkWhatsAppHealth,
  startHealthCheckMonitor,
  notifyClientOrderStatus,
  sendManualChatMessage,
} from "./whatsapp/bot.js";
import {
  getAllChats,
  getChat,
  getNotifications,
  markNotificationRead,
  clearAllNotifications,
  toggleChatHumanMode,
} from "./whatsapp/orderService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "marmita-hub-secret-key-12345";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const aiClient = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// ---------------- In-Memory Data Store ----------------
interface User {
  user_id: string;
  email: string;
  name: string;
  password_hash: string;
  picture: string;
  role: string;
  auth_provider: string;
  created_at: string;
  day_state?: "open" | "closed";
  day_opened_at?: string;
  last_close_at?: string;
}

interface ProductAdditional {
  name: string;
  price: number;
}

interface Product {
  product_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  active: boolean;
  additionals: ProductAdditional[];
  created_at: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  additionals: ProductAdditional[];
  notes?: string;
}

interface Order {
  order_id: string;
  user_id: string;
  customer_name: string;
  customer_phone?: string;
  delivery_type: "Entrega" | "Retirada";
  address?: string;
  items: OrderItem[];
  payment_method: "Dinheiro" | "Cartão Crédito" | "Cartão Débito" | "Pix" | "Outro" | "Pendente";
  delivery_fee: number;
  surcharge: number;
  discount: number;
  notes?: string;
  status: "Em Análise" | "Novo" | "Em Preparo" | "Pronto" | "Em Entrega" | "Concluído" | "Cancelado";
  delivery_zone_id?: string;
  archived: boolean;
  archived_at?: string;
  total: number;
  created_at: string;
  updated_at: string;
}

interface DeliveryZone {
  zone_id: string;
  user_id: string;
  name: string;
  fee: number;
}

interface Customer {
  customer_id: string;
  user_id: string;
  name: string;
  phone: string;
  address?: string;
  delivery_zone_id?: string;
  notes?: string;
  created_at: string;
}

interface DayClose {
  close_id: string;
  user_id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  valid_orders: number;
  cancelled_orders: number;
  revenue: number;
  avg_ticket: number;
  by_payment: { method: string; total: number; count: number }[];
  by_type: { type: string; total: number; count: number }[];
  top_products: { name: string; quantity: number; total: number }[];
}

interface UploadedFile {
  file_id: string;
  user_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size: number;
  data: Buffer;
  created_at: string;
}

// Stores
const users = new Map<string, User>();
const sessions = new Map<string, { user_id: string; expires_at: Date }>();
const products = new Map<string, Product>();
const orders = new Map<string, Order>();
const deliveryZones = new Map<string, DeliveryZone>();
const customers = new Map<string, Customer>();
const dayCloses = new Map<string, DayClose>();
const files = new Map<string, UploadedFile>();

// Store Demand & WhatsApp Automation State
let acceptingOrders = true;
let highDemandMessage =
  "No momento nossos pedidos estão temporariamente pausados devido à alta demanda na cozinha para garantir a qualidade de cada refeição! 🍳 Por favor, tente novamente em instantes.";
let scheduledDeliveryEnabled = true;
let scheduledDeliveryFee = 5.0;
let scheduledDeliveryHours = "Almoço: 11:30 às 13:30 | Jantar: 18:30 às 20:30";
let pixKey = "11999999999 (Celular - Marmita Hub)";
let pixBeneficiary = "Marmita Hub Delivery Ltda";
let storeAddress = "Rua do Sabor, 150 - Centro, São Paulo - SP";
let storeMapsUrl = "https://maps.google.com/?q=Rua+do+Sabor+150+Sao+Paulo";
let businessHours = "Segunda a Sábado das 10h30 às 15h00 e das 18h00 às 22h00";
let globalDayState: "open" | "closed" = "open";
let globalDayOpenedAt: string = new Date().toISOString();
let initialCashBalance: number = 0;
let aiCustomInstructions = `Você é a atendente virtual da loja no WhatsApp.
Seu objetivo é atender os clientes de forma educada, acolhedora, rápida e eficiente.

DIRETRIZES DE ATENDIMENTO:
1. Mensagens exclusivamente escritas: Comunique-se somente através de texto escrito claro, com boa formatação e emojis moderados.
2. Tire dúvidas sobre os produtos cadastrados no cardápio, adicionais e porções.
3. Se o cliente já for cadastrado no sistema, cumprimente pelo nome e confirme se a entrega é no endereço já salvo.
4. Sugira adicionais gostosos para complementar o prato do cliente.
5. Colete com clareza: itens e quantidades, adicionais, observações, forma de entrega e forma de pagamento.
6. Em caso de alta demanda ativa, informe com simpatia que os pedidos estão pausados momentaneamente e não feche o pedido.`;

// Helper utilities
const nowUtc = () => new Date().toISOString();
const generateId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).substring(4)}`;

// Pre-seed default Admin and sample products
const adminId = "user_admin_001";
const adminHashedPassword = bcrypt.hashSync("admin123", 10);
users.set(adminId, {
  user_id: adminId,
  email: "admin@marmita.com",
  name: "Administrador",
  password_hash: adminHashedPassword,
  picture: "",
  role: "admin",
  auth_provider: "local",
  created_at: nowUtc(),
  day_state: "open",
  day_opened_at: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
});

// Seed sample products for admin
const initialProducts: Omit<Product, "product_id" | "user_id" | "created_at">[] = [
  {
    name: "Marmita Tradicional P",
    description: "Arroz, feijão carioca, carne de panela macia, farofa e salada fresca da horta.",
    price: 18.0,
    category: "Marmita",
    image_url: "",
    active: true,
    additionals: [
      { name: "Ovo frito caipira", price: 3.0 },
      { name: "Farofa crocante extra", price: 2.5 },
      { name: "Porção extra de feijão", price: 4.0 },
    ],
  },
  {
    name: "Marmita Tradicional M",
    description: "Nossa marmita mais pedida: bife acebolado ou frango grelhado com guarnições completas.",
    price: 23.0,
    category: "Marmita",
    image_url: "",
    active: true,
    additionals: [
      { name: "Ovo frito caipira", price: 3.0 },
      { name: "Queijo coalho grelhado", price: 5.0 },
      { name: "Batata frita sequinha", price: 6.0 },
    ],
  },
  {
    name: "Marmita Tradicional G",
    description: "Porção reforçada com duas opções de proteína, arroz, feijão, tropeiro e vinagrete.",
    price: 28.0,
    category: "Marmita",
    image_url: "",
    active: true,
    additionals: [
      { name: "Bife extra", price: 8.0 },
      { name: "Ovo frito caipira", price: 3.0 },
      { name: "Bacon crocante", price: 4.5 },
    ],
  },
  {
    name: "Marmita Fit Frango & Legumes",
    description: "Filé de frango grelhado com ervas finas, arroz integral e legumes no vapor.",
    price: 25.0,
    category: "Fitness",
    image_url: "",
    active: true,
    additionals: [
      { name: "Mix de castanhas", price: 4.0 },
      { name: "Purê de batata doce", price: 5.0 },
    ],
  },
  {
    name: "Feijoada Completa (Sexta e Sábado)",
    description: "Feijoada nobre com carnes selecionadas, couve refogada, laranja, torresmo e farofa.",
    price: 32.0,
    category: "Especial",
    image_url: "",
    active: true,
    additionals: [
      { name: "Torresmo extra", price: 5.0 },
      { name: "Molho de pimenta da casa", price: 2.0 },
    ],
  },
  {
    name: "Refrigerante Lata 350ml",
    description: "Coca-Cola, Guaraná Antarctica ou Fanta geladinha.",
    price: 6.0,
    category: "Bebidas",
    image_url: "",
    active: true,
    additionals: [],
  },
  {
    name: "Suco Natural de Laranja 500ml",
    description: "Suco feito na hora com laranjas frescas selecionadas, 100% natural.",
    price: 9.0,
    category: "Bebidas",
    image_url: "",
    active: true,
    additionals: [],
  },
];

initialProducts.forEach((p, idx) => {
  const pid = `prod_${idx + 1001}`;
  products.set(pid, {
    ...p,
    product_id: pid,
    user_id: adminId,
    created_at: nowUtc(),
  });
});

// Seed delivery zones
const initialZones = [
  { name: "Centro", fee: 5.0 },
  { name: "Bairro Novo", fee: 7.0 },
  { name: "Jardins", fee: 10.0 },
  { name: "Vila Mariana", fee: 8.5 },
];
initialZones.forEach((z, idx) => {
  const zid = `zone_${idx + 101}`;
  deliveryZones.set(zid, {
    zone_id: zid,
    user_id: adminId,
    name: z.name,
    fee: z.fee,
  });
});

// Seed sample orders for dashboard
const sampleOrders: Partial<Order>[] = [
  {
    customer_name: "Mariana Silva",
    customer_phone: "(11) 98765-4321",
    delivery_type: "Entrega",
    address: "Rua das Flores, 123 - Centro",
    status: "Em Preparo",
    payment_method: "Pix",
    delivery_fee: 5.0,
    surcharge: 0,
    discount: 0,
    items: [
      {
        product_id: "prod_1002",
        name: "Marmita Tradicional M",
        price: 23.0,
        quantity: 2,
        additionals: [{ name: "Ovo frito caipira", price: 3.0 }],
        notes: "Sem cebola por favor",
      },
      {
        product_id: "prod_1006",
        name: "Refrigerante Lata 350ml",
        price: 6.0,
        quantity: 2,
        additionals: [],
      },
    ],
    total: 69.0,
  },
  {
    customer_name: "Carlos Eduardo",
    customer_phone: "(11) 91234-5678",
    delivery_type: "Retirada",
    address: "Retirada no balcão",
    status: "Novo",
    payment_method: "Cartão Débito",
    delivery_fee: 0,
    surcharge: 0,
    discount: 0,
    items: [
      {
        product_id: "prod_1004",
        name: "Marmita Fit Frango & Legumes",
        price: 25.0,
        quantity: 1,
        additionals: [],
      },
    ],
    total: 25.0,
  },
  {
    customer_name: "Ana Paula Souza",
    customer_phone: "(11) 97788-9900",
    delivery_type: "Entrega",
    address: "Av. Paulista, 1000 - Jardins",
    status: "Concluído",
    payment_method: "Cartão Crédito",
    delivery_fee: 10.0,
    surcharge: 0,
    discount: 0,
    items: [
      {
        product_id: "prod_1003",
        name: "Marmita Tradicional G",
        price: 28.0,
        quantity: 1,
        additionals: [{ name: "Ovo frito caipira", price: 3.0 }],
      },
      {
        product_id: "prod_1007",
        name: "Suco Natural de Laranja 500ml",
        price: 9.0,
        quantity: 1,
        additionals: [],
      },
    ],
    total: 50.0,
  },
];

sampleOrders.forEach((so, idx) => {
  const oid = `ord_${idx + 1001}`;
  orders.set(oid, {
    order_id: oid,
    user_id: adminId,
    customer_name: so.customer_name || "Cliente",
    customer_phone: so.customer_phone || "",
    delivery_type: so.delivery_type || "Entrega",
    address: so.address || "",
    status: so.status || "Novo",
    payment_method: so.payment_method || "Pendente",
    delivery_fee: so.delivery_fee || 0,
    surcharge: so.surcharge || 0,
    discount: so.discount || 0,
    notes: so.notes || "",
    items: so.items || [],
    total: so.total || 0,
    archived: false,
    created_at: nowUtc(),
    updated_at: nowUtc(),
  });
});

// Calculate total for order
function calcTotal(order: {
  items: OrderItem[];
  delivery_fee?: number;
  surcharge?: number;
  discount?: number;
}): number {
  let subtotal = 0;
  for (const item of order.items || []) {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    const addTotal =
      (item.additionals || []).reduce((acc, a) => acc + (a.price || 0), 0) *
      (item.quantity || 1);
    subtotal += itemTotal + addTotal;
  }
  const total =
    subtotal + (order.delivery_fee || 0) + (order.surcharge || 0) - (order.discount || 0);
  return Math.round(total * 100) / 100;
}

// ---------------- Auth Middleware ----------------
interface AuthenticatedRequest extends Request {
  user?: User;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token =
    req.cookies?.access_token ||
    req.cookies?.session_token ||
    (req.query?.auth as string);

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ detail: "Não autenticado" });
  }

  // Check if session token
  const session = sessions.get(token);
  if (session) {
    if (session.expires_at < new Date()) {
      sessions.delete(token);
      return res.status(401).json({ detail: "Sessão expirada" });
    }
    const user = users.get(session.user_id);
    if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
    req.user = user;
    return next();
  }

  // Check JWT
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
    const user = users.get(payload.sub);
    if (!user) return res.status(401).json({ detail: "Usuário não encontrado" });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ detail: "Token inválido ou expirado" });
  }
}

function setJwtCookie(res: Response, token: string) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function createToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, type: "access" }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

// ---------------- API Routes ----------------
const apiRouter = express.Router();

// Root & Health check
apiRouter.get("/", (_req, res) => {
  res.json({ message: "API Marmitaria Online", status: "ok" });
});

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Direct root health endpoint for Render or monitoring services
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ---------------- Store Status & High Demand & WhatsApp ----------------
apiRouter.get("/store/status", (_req, res) => {
  return res.json({
    accepting_orders: acceptingOrders,
    high_demand_message: highDemandMessage,
    scheduled_delivery_enabled: scheduledDeliveryEnabled,
    scheduled_delivery_fee: scheduledDeliveryFee,
    scheduled_delivery_hours: scheduledDeliveryHours,
    ai_custom_instructions: aiCustomInstructions,
    pix_key: pixKey,
    pix_beneficiary: pixBeneficiary,
    store_address: storeAddress,
    store_maps_url: storeMapsUrl,
    business_hours: businessHours,
  });
});

apiRouter.post("/store/toggle-accepting", authMiddleware, (req, res) => {
  acceptingOrders = !acceptingOrders;
  if (req.body?.high_demand_message) {
    highDemandMessage = String(req.body.high_demand_message);
  }
  return res.json({
    accepting_orders: acceptingOrders,
    high_demand_message: highDemandMessage,
    scheduled_delivery_enabled: scheduledDeliveryEnabled,
    scheduled_delivery_fee: scheduledDeliveryFee,
    scheduled_delivery_hours: scheduledDeliveryHours,
    ai_custom_instructions: aiCustomInstructions,
    pix_key: pixKey,
    pix_beneficiary: pixBeneficiary,
    store_address: storeAddress,
    store_maps_url: storeMapsUrl,
    business_hours: businessHours,
  });
});

apiRouter.put("/store/status", authMiddleware, (req, res) => {
  if (typeof req.body?.accepting_orders === "boolean") {
    acceptingOrders = req.body.accepting_orders;
  }
  if (req.body?.high_demand_message) {
    highDemandMessage = String(req.body.high_demand_message);
  }
  if (typeof req.body?.scheduled_delivery_enabled === "boolean") {
    scheduledDeliveryEnabled = req.body.scheduled_delivery_enabled;
  }
  if (req.body?.scheduled_delivery_fee != null) {
    scheduledDeliveryFee = Number(req.body.scheduled_delivery_fee);
  }
  if (req.body?.scheduled_delivery_hours) {
    scheduledDeliveryHours = String(req.body.scheduled_delivery_hours);
  }
  if (req.body?.ai_custom_instructions != null) {
    aiCustomInstructions = String(req.body.ai_custom_instructions);
  }
  if (req.body?.pix_key != null) {
    pixKey = String(req.body.pix_key);
  }
  if (req.body?.pix_beneficiary != null) {
    pixBeneficiary = String(req.body.pix_beneficiary);
  }
  if (req.body?.store_address != null) {
    storeAddress = String(req.body.store_address);
  }
  if (req.body?.store_maps_url != null) {
    storeMapsUrl = String(req.body.store_maps_url);
  }
  if (req.body?.business_hours != null) {
    businessHours = String(req.body.business_hours);
  }
  return res.json({
    accepting_orders: acceptingOrders,
    high_demand_message: highDemandMessage,
    scheduled_delivery_enabled: scheduledDeliveryEnabled,
    scheduled_delivery_fee: scheduledDeliveryFee,
    scheduled_delivery_hours: scheduledDeliveryHours,
    ai_custom_instructions: aiCustomInstructions,
    pix_key: pixKey,
    pix_beneficiary: pixBeneficiary,
    store_address: storeAddress,
    store_maps_url: storeMapsUrl,
    business_hours: businessHours,
  });
});

// WhatsApp Baileys status, QR Code & Control
apiRouter.get("/whatsapp/status", (_req, res) => {
  try {
    const status = getWhatsAppStatus();
    return res.json(status);
  } catch (e: any) {
    return res.json({ status: "disconnected", is_connected: false, qr_code: null, phone: null });
  }
});

// Sistema de verificação de saúde de 5 em 5 minutos do WhatsApp
apiRouter.get("/whatsapp/health", (_req, res) => {
  try {
    const health = getWhatsAppHealth();
    return res.json(health);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

apiRouter.post("/whatsapp/health/check-now", authMiddleware, (_req, res) => {
  try {
    const result = checkWhatsAppHealth();
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

apiRouter.post("/whatsapp/start", authMiddleware, async (_req, res) => {
  try {
    startWhatsAppBot().catch((err) => console.error("[WhatsApp] Erro ao iniciar Baileys:", err));
    return res.json({ success: true, message: "Iniciando Baileys..." });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

apiRouter.post("/whatsapp/force-reconnect", authMiddleware, async (_req, res) => {
  try {
    const result = await forceReconnectWhatsApp();
    return res.json({ success: true, message: "Conexão forçada re-iniciada com sucesso!", status: result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

apiRouter.post("/whatsapp/disconnect", authMiddleware, async (_req, res) => {
  try {
    const result = await disconnectWhatsApp();
    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

apiRouter.post("/whatsapp/simulate-connect", authMiddleware, (req, res) => {
  const phone = req.body?.phone || "5511998765432";
  const result = simulateWhatsAppConnect(phone);
  return res.json(result);
});

apiRouter.post("/whatsapp/simulate-qr", authMiddleware, async (_req, res) => {
  const dataUrl = await simulateQRCode("MarmitaHub-Baileys-" + Date.now());
  return res.json({ qr_code: dataUrl, status: "qr_ready" });
});

apiRouter.post("/whatsapp/simulate-message", authMiddleware, async (req, res) => {
  const { phone = "5511999998888", message = "Bom dia", name = "Cliente Teste" } = req.body || {};
  try {
    const response = await simulateCustomerMessage(phone, message, name);
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/whatsapp/simulate-pix", authMiddleware, async (req, res) => {
  const { phone = "5511999998888", amount = 25.0, name = "Cliente Teste", scenario, image_base64 } = req.body || {};
  try {
    const response = await simulatePixReceiptValidation(phone, amount, name, scenario, image_base64);
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Busca o pedido ativo ou recente de um cliente pelo telefone ou código
apiRouter.get("/whatsapp/active-order", (req, res) => {
  const phone = String(req.query.phone || "").replace(/\D/g, "");
  const code = String(req.query.code || "").trim().toLowerCase();

  let foundOrder: Order | undefined;

  const allOrdersReversed = Array.from(orders.values()).reverse();

  for (const ord of allOrdersReversed) {
    if (code && (ord.notes?.toLowerCase().includes(code) || ord.order_id.toLowerCase().includes(code))) {
      foundOrder = ord;
      break;
    }
    if (phone) {
      const cust = ord.customer_id ? customers.get(ord.customer_id) : null;
      const custPhone = (cust?.phone || "").replace(/\D/g, "");
      const notesPhone = (ord.notes || "").replace(/\D/g, "");
      if (
        (custPhone && (custPhone.endsWith(phone) || phone.endsWith(custPhone))) ||
        (notesPhone && (notesPhone.includes(phone) || phone.includes(notesPhone)))
      ) {
        if (ord.status === "Novo" || ord.status === "Em Preparo") {
          foundOrder = ord;
          break;
        } else if (!foundOrder) {
          foundOrder = ord;
        }
      }
    }
  }

  if (foundOrder) {
    const cust = foundOrder.customer_id ? customers.get(foundOrder.customer_id) : null;
    const matchCode = foundOrder.notes?.match(/#([A-Z0-9-]+)/);
    return res.json({
      order: {
        order_id: foundOrder.order_id,
        order_code: matchCode ? matchCode[1] : foundOrder.order_id,
        total: foundOrder.total,
        status: foundOrder.status,
        customer_name: cust?.name || "Cliente",
        payment_method: foundOrder.payment_method,
        items: foundOrder.items,
      },
    });
  }

  return res.json({ order: null });
});

// Dynamic WhatsApp Catalog Context endpoint
apiRouter.get("/whatsapp/catalog-context", (_req, res) => {
  const activeProducts = Array.from(products.values())
    .filter((p) => p.active)
    .map((p) => ({
      product_id: p.product_id,
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      additionals: p.additionals || [],
    }));

  const allCustomers = Array.from(customers.values()).map((c) => {
    const cleanPhone = (c.phone || "").replace(/\D/g, "");
    const custOrders = Array.from(orders.values()).filter((o) => {
      const oPhone = (o.customer_phone || "").replace(/\D/g, "");
      return (
        (c.customer_id && o.customer_id === c.customer_id) ||
        (cleanPhone && oPhone && (oPhone.endsWith(cleanPhone) || cleanPhone.endsWith(oPhone)))
      );
    });

    const itemCounts = new Map<string, number>();
    const commonNotes = new Set<string>();
    let lastOrder = null;

    for (const ord of custOrders) {
      if (ord.status !== "Cancelado") {
        for (const item of ord.items || []) {
          itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + (item.quantity || 1));
        }
        if (ord.notes && ord.notes.length > 2) {
          const cleanNote = ord.notes.replace(/\[WhatsApp #[^\]]+\]/g, "").trim();
          if (cleanNote) commonNotes.add(cleanNote);
        }
      }
    }

    const sortedItems = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]);
    const favoriteItem = sortedItems.length > 0 ? sortedItems[0][0] : null;

    if (custOrders.length > 0) {
      const sortedByDate = [...custOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      lastOrder = {
        order_id: sortedByDate[0].order_id,
        items: sortedByDate[0].items,
        total: sortedByDate[0].total,
        delivery_type: sortedByDate[0].delivery_type,
        address: sortedByDate[0].address,
        payment_method: sortedByDate[0].payment_method,
        created_at: sortedByDate[0].created_at,
      };
    }

    return {
      customer_id: c.customer_id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      delivery_zone_id: c.delivery_zone_id,
      notes: c.notes,
      order_count: custOrders.length,
      favorite_item: favoriteItem,
      frequent_items: sortedItems.slice(0, 3).map(([name, count]) => `${count}x ${name}`),
      habitual_notes: Array.from(commonNotes).filter(Boolean).slice(0, 2).join("; "),
      last_order: lastOrder,
    };
  });

  // Sintetiza clientes adicionais presentes nos pedidos que ainda não estão salvos na tabela de clientes
  const knownPhones = new Set(allCustomers.map((c) => (c.phone || "").replace(/\D/g, "")));

  for (const ord of Array.from(orders.values())) {
    const rawP = (ord.customer_phone || "").replace(/\D/g, "");
    if (rawP && rawP.length >= 8 && !knownPhones.has(rawP)) {
      knownPhones.add(rawP);

      const custOrders = Array.from(orders.values()).filter((o) => {
        const oPhone = (o.customer_phone || "").replace(/\D/g, "");
        return oPhone && (oPhone.endsWith(rawP) || rawP.endsWith(oPhone));
      });

      const itemCounts = new Map<string, number>();
      const commonNotes = new Set<string>();
      let lastOrder = null;

      for (const o of custOrders) {
        if (o.status !== "Cancelado") {
          for (const item of o.items || []) {
            itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + (item.quantity || 1));
          }
          if (o.notes && o.notes.length > 2) {
            const cleanNote = o.notes.replace(/\[WhatsApp #[^\]]+\]/g, "").trim();
            if (cleanNote) commonNotes.add(cleanNote);
          }
        }
      }

      const sortedItems = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]);
      const favoriteItem = sortedItems.length > 0 ? sortedItems[0][0] : null;

      if (custOrders.length > 0) {
        const sortedByDate = [...custOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        lastOrder = {
          order_id: sortedByDate[0].order_id,
          items: sortedByDate[0].items,
          total: sortedByDate[0].total,
          delivery_type: sortedByDate[0].delivery_type,
          address: sortedByDate[0].address,
          payment_method: sortedByDate[0].payment_method,
          created_at: sortedByDate[0].created_at,
        };
      }

      allCustomers.push({
        customer_id: `cust_syn_${rawP}`,
        name: ord.customer_name || "Cliente WhatsApp",
        phone: ord.customer_phone || rawP,
        address: ord.address || "",
        delivery_zone_id: null,
        notes: "",
        order_count: custOrders.length,
        favorite_item: favoriteItem,
        frequent_items: sortedItems.slice(0, 3).map(([name, count]) => `${count}x ${name}`),
        habitual_notes: Array.from(commonNotes).filter(Boolean).slice(0, 2).join("; "),
        last_order: lastOrder,
      });
    }
  }

  const allZones = Array.from(deliveryZones.values()).map((z) => ({
    zone_id: z.zone_id,
    name: z.name,
    fee: z.fee,
  }));

  return res.json({
    accepting_orders: acceptingOrders,
    is_caixa_open: globalDayState === "open",
    day_state: globalDayState,
    initial_cash_balance: initialCashBalance,
    high_demand_message: highDemandMessage,
    scheduled_delivery_enabled: scheduledDeliveryEnabled,
    scheduled_delivery_fee: scheduledDeliveryFee,
    scheduled_delivery_hours: scheduledDeliveryHours,
    ai_custom_instructions: aiCustomInstructions,
    pix_key: pixKey,
    pix_beneficiary: pixBeneficiary,
    store_address: storeAddress,
    store_maps_url: storeMapsUrl,
    business_hours: businessHours,
    products: activeProducts,
    customers: allCustomers,
    delivery_zones: allZones,
  });
});

// Internal endpoint to save WhatsApp confirmed order into PDV
apiRouter.post("/whatsapp/internal-order", (req, res) => {
  if (globalDayState === "closed") {
    return res.status(400).json({ detail: "Caixa fechado. Pedidos pelo WhatsApp suspensos até a abertura do caixa." });
  }

  const {
    order_code,
    customer_name,
    customer_phone,
    delivery_type = "Entrega",
    address = "",
    items,
    payment_method = "Pendente",
    delivery_fee = 0,
    notes = "",
    total,
  } = req.body || {};

  const user = users.get(adminId) || Array.from(users.values())[0];
  const oid = order_code ? `ord_${order_code.toLowerCase().replace(/[^a-z0-9]/g, "")}` : generateId("ord");

  const orderItems: OrderItem[] = (items || []).map((it: any) => ({
    product_id: it.product_id || generateId("prod"),
    name: it.name,
    price: Number(it.price || 0),
    quantity: Number(it.quantity || 1),
    additionals: it.additionals || [],
    notes: it.notes || "",
  }));

  const calculatedTotal = total != null ? Number(total) : calcTotal({ items: orderItems, delivery_fee });

  const newOrder: Order = {
    order_id: oid,
    user_id: user ? user.user_id : adminId,
    customer_name: String(customer_name || "Cliente WhatsApp").trim(),
    customer_phone: String(customer_phone || "").trim(),
    delivery_type: delivery_type || "Entrega",
    address: String(address || ""),
    items: orderItems,
    payment_method: payment_method || "Pendente",
    delivery_fee: Number(delivery_fee || 0),
    surcharge: 0,
    discount: 0,
    notes: notes ? `[WhatsApp #${order_code}] ${notes}` : `[WhatsApp #${order_code}]`,
    status: req.body?.status || "Em Análise",
    archived: false,
    total: calculatedTotal,
    created_at: nowUtc(),
    updated_at: nowUtc(),
  };

  orders.set(oid, newOrder);

  // Update or create customer if phone provided
  if (customer_phone && customer_name) {
    const cleanPhone = String(customer_phone).trim();
    let existingCus = Array.from(customers.values()).find(
      (c) => c.phone.replace(/\D/g, "") === cleanPhone.replace(/\D/g, "")
    );
    if (existingCus) {
      existingCus.name = customer_name;
      if (address) existingCus.address = address;
    } else {
      const cid = generateId("cus");
      customers.set(cid, {
        customer_id: cid,
        user_id: user ? user.user_id : adminId,
        name: customer_name,
        phone: cleanPhone,
        address,
        created_at: nowUtc(),
      });
    }
  }

  return res.json({ success: true, order: newOrder });
});

// WhatsApp Chats & Conversas separadas
apiRouter.get("/whatsapp/chats", authMiddleware, (_req, res) => {
  try {
    const chatList = getAllChats();
    // Vincula dados atualizados de pedidos correspondentes
    const enhancedChats = chatList.map((ch) => {
      let linkedOrder = null;
      if (ch.order_id && orders.has(ch.order_id)) {
        linkedOrder = orders.get(ch.order_id);
      } else if (ch.order_code) {
        linkedOrder = Array.from(orders.values()).find(
          (o) => o.notes?.includes(ch.order_code) || o.order_id.toLowerCase().includes(ch.order_code.toLowerCase())
        );
      }
      return {
        ...ch,
        linked_order: linkedOrder || null,
      };
    });
    return res.json(enhancedChats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get("/whatsapp/chats/:chat_id", authMiddleware, (req, res) => {
  const { chat_id } = req.params;
  const chat = getChat(chat_id);
  if (!chat) {
    return res.status(404).json({ detail: "Conversa não encontrada" });
  }
  let linkedOrder = null;
  if (chat.order_id && orders.has(chat.order_id)) {
    linkedOrder = orders.get(chat.order_id);
  } else if (chat.order_code) {
    linkedOrder = Array.from(orders.values()).find(
      (o) => o.notes?.includes(chat.order_code) || o.order_id.toLowerCase().includes(chat.order_code.toLowerCase())
    );
  }
  return res.json({ ...chat, linked_order: linkedOrder });
});

apiRouter.post("/whatsapp/chats/:chat_id/message", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { chat_id } = req.params;
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ detail: "Texto da mensagem é obrigatório" });
  }

  const attendantName = req.user?.name || "Atendente";
  try {
    const result = await sendManualChatMessage(chat_id, String(text).trim(), attendantName);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post("/whatsapp/chats/:chat_id/toggle-human", authMiddleware, (req, res) => {
  const { chat_id } = req.params;
  const { enable_human = true } = req.body || {};
  const updatedChat = toggleChatHumanMode(chat_id, Boolean(enable_human));
  return res.json(updatedChat);
});

// Fila de notificações do sistema (com som)
apiRouter.get("/whatsapp/notifications", authMiddleware, (_req, res) => {
  const notifs = getNotifications();
  return res.json(notifs);
});

apiRouter.post("/whatsapp/notifications/:id/read", authMiddleware, (req, res) => {
  const { id } = req.params;
  const updated = markNotificationRead(id);
  return res.json({ success: true, notification: updated });
});

apiRouter.post("/whatsapp/notifications/clear-all", authMiddleware, (_req, res) => {
  clearAllNotifications();
  return res.json({ success: true });
});

// Confirm Pix payment from WhatsApp receipt analysis
apiRouter.post("/whatsapp/confirm-payment", (req, res) => {
  const { order_code, payment_status, paid_amount, phone } = req.body || {};
  let targetOrder: Order | undefined;

  const cleanCode = String(order_code || "").trim().toLowerCase();
  const cleanPhone = String(phone || "").replace(/\D/g, "");

  const allOrdersReversed = Array.from(orders.values()).reverse();

  for (const ord of allOrdersReversed) {
    if (
      cleanCode &&
      (ord.notes?.toLowerCase().includes(cleanCode) ||
        ord.order_id.toLowerCase().includes(cleanCode.replace(/[^a-z0-9]/g, "")))
    ) {
      targetOrder = ord;
      break;
    }
  }

  if (!targetOrder && cleanPhone) {
    for (const ord of allOrdersReversed) {
      const cust = ord.customer_id ? customers.get(ord.customer_id) : null;
      const cPhone = (cust?.phone || "").replace(/\D/g, "");
      const notesPhone = (ord.notes || "").replace(/\D/g, "");
      if (
        (cPhone && (cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone))) ||
        (notesPhone && (notesPhone.includes(cleanPhone) || cleanPhone.includes(notesPhone)))
      ) {
        targetOrder = ord;
        break;
      }
    }
  }

  if (targetOrder) {
    const paidVal = Number(paid_amount || targetOrder.total);
    targetOrder.payment_method = `Pix (Pago R$ ${paidVal.toFixed(2)})`;
    targetOrder.notes = `${targetOrder.notes || ""} [Pix Validado pela IA: R$ ${paidVal.toFixed(2)}]`;
    // Se o pedido ainda estava como "Novo", avança automaticamente para "Em Preparo"
    if (targetOrder.status === "Novo") {
      targetOrder.status = "Em Preparo";
    }
    targetOrder.updated_at = nowUtc();
    return res.json({ success: true, order: targetOrder });
  }

  return res.json({ success: false, message: "Pedido não localizado" });
});

// Auth
apiRouter.post("/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ detail: "Nome, email e senha são obrigatórios" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  for (const u of users.values()) {
    if (u.email.toLowerCase() === cleanEmail) {
      return res.status(400).json({ detail: "Email já cadastrado" });
    }
  }

  const userId = generateId("user");
  const newUser: User = {
    user_id: userId,
    email: cleanEmail,
    name: String(name).trim(),
    password_hash: bcrypt.hashSync(String(password), 10),
    picture: "",
    role: "user",
    auth_provider: "local",
    created_at: nowUtc(),
    day_state: "open",
    day_opened_at: nowUtc(),
  };

  users.set(userId, newUser);

  // Copy initial products to new user
  initialProducts.forEach((p, idx) => {
    const pid = generateId("prod");
    products.set(pid, {
      ...p,
      product_id: pid,
      user_id: userId,
      created_at: nowUtc(),
    });
  });
  // Copy delivery zones
  initialZones.forEach((z) => {
    const zid = generateId("zone");
    deliveryZones.set(zid, {
      zone_id: zid,
      user_id: userId,
      name: z.name,
      fee: z.fee,
    });
  });

  const token = createToken(userId, cleanEmail);
  setJwtCookie(res, token);
  return res.json({
    token,
    user_id: userId,
    email: cleanEmail,
    name: newUser.name,
    picture: "",
    role: newUser.role,
    auth_provider: newUser.auth_provider,
  });
});

apiRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ detail: "Email e senha são obrigatórios" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  let foundUser: User | undefined;
  for (const u of users.values()) {
    if (u.email.toLowerCase() === cleanEmail) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser || !bcrypt.compareSync(String(password), foundUser.password_hash)) {
    return res.status(401).json({ detail: "Credenciais inválidas" });
  }

  const token = createToken(foundUser.user_id, cleanEmail);
  setJwtCookie(res, token);
  return res.json({
    token,
    user_id: foundUser.user_id,
    email: foundUser.email,
    name: foundUser.name,
    picture: foundUser.picture,
    role: foundUser.role,
    auth_provider: foundUser.auth_provider,
  });
});

apiRouter.post("/auth/session", (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) {
    return res.status(400).json({ detail: "session_id obrigatório" });
  }
  // Fallback demo mock session
  const user = users.get(adminId)!;
  const token = createToken(user.user_id, user.email);
  setJwtCookie(res, token);
  return res.json({
    token,
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    auth_provider: "google",
  });
});

apiRouter.get("/auth/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  return res.json({
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    picture: user.picture || "",
    role: user.role || "user",
    auth_provider: user.auth_provider || "local",
  });
});

apiRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("session_token", { path: "/" });
  return res.json({ ok: true });
});

// Products
apiRouter.get("/products", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const userProducts = Array.from(products.values())
    .filter((p) => p.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(userProducts);
});

apiRouter.post("/products", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { name, description = "", price, category = "Marmita", image_url = "", active = true, additionals = [] } =
    req.body || {};

  if (!name || price == null) {
    return res.status(400).json({ detail: "Nome e preço são obrigatórios" });
  }

  const pid = generateId("prod");
  const newProduct: Product = {
    product_id: pid,
    user_id: userId,
    name: String(name).trim(),
    description: String(description || ""),
    price: Number(price),
    category: String(category || "Marmita"),
    image_url: String(image_url || ""),
    active: Boolean(active),
    additionals: Array.isArray(additionals) ? additionals : [],
    created_at: nowUtc(),
  };

  products.set(pid, newProduct);
  return res.json(newProduct);
});

apiRouter.put("/products/:product_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { product_id } = req.params;
  const existing = products.get(product_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Produto não encontrado" });
  }

  const updated: Product = {
    ...existing,
    ...req.body,
    product_id: existing.product_id,
    user_id: existing.user_id,
  };

  products.set(product_id, updated);
  return res.json(updated);
});

apiRouter.delete("/products/:product_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { product_id } = req.params;
  const existing = products.get(product_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Produto não encontrado" });
  }

  products.delete(product_id);
  return res.json({ ok: true });
});

// Orders
apiRouter.get("/orders", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { status, archived } = req.query;

  let userOrders = Array.from(orders.values()).filter((o) => o.user_id === userId);

  if (status) {
    userOrders = userOrders.filter((o) => o.status === status);
  }

  if (archived === "true") {
    userOrders = userOrders.filter((o) => o.archived === true);
  } else if (archived === "false" || archived === undefined) {
    userOrders = userOrders.filter((o) => !o.archived);
  }

  userOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return res.json(userOrders);
});

apiRouter.post("/orders", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  if (globalDayState === "closed" || user.day_state === "closed") {
    return res.status(400).json({ detail: "Caixa do dia fechado! Abra o caixa para registrar pedidos." });
  }

  const {
    customer_name,
    customer_phone = "",
    delivery_type = "Entrega",
    address = "",
    items,
    payment_method = "Pendente",
    delivery_fee = 0,
    surcharge = 0,
    discount = 0,
    notes = "",
    status = "Novo",
    delivery_zone_id,
  } = req.body || {};

  if (!customer_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ detail: "Pedido precisa de nome do cliente e pelo menos um item" });
  }

  const oid = generateId("ord");
  const total = calcTotal({ items, delivery_fee, surcharge, discount });

  const newOrder: Order = {
    order_id: oid,
    user_id: user.user_id,
    customer_name: String(customer_name).trim(),
    customer_phone: String(customer_phone || ""),
    delivery_type: delivery_type || "Entrega",
    address: String(address || ""),
    items,
    payment_method: payment_method || "Pendente",
    delivery_fee: Number(delivery_fee || 0),
    surcharge: Number(surcharge || 0),
    discount: Number(discount || 0),
    notes: String(notes || ""),
    status: status || "Novo",
    delivery_zone_id: delivery_zone_id || undefined,
    archived: false,
    total,
    created_at: nowUtc(),
    updated_at: nowUtc(),
  };

  orders.set(oid, newOrder);

  // Auto-save/update customer if phone provided
  if (customer_phone && customer_name) {
    const cleanPhone = String(customer_phone).trim();
    let existingCus = Array.from(customers.values()).find(
      (c) => c.user_id === user.user_id && c.phone === cleanPhone
    );
    if (existingCus) {
      existingCus.name = customer_name;
      if (address) existingCus.address = address;
    } else {
      const cid = generateId("cus");
      customers.set(cid, {
        customer_id: cid,
        user_id: user.user_id,
        name: customer_name,
        phone: cleanPhone,
        address,
        created_at: nowUtc(),
      });
    }
  }

  return res.json(newOrder);
});

apiRouter.put("/orders/:order_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  const total = calcTotal(req.body);
  const updated: Order = {
    ...existing,
    ...req.body,
    order_id: existing.order_id,
    user_id: existing.user_id,
    total,
    updated_at: nowUtc(),
  };

  orders.set(order_id, updated);
  return res.json(updated);
});

apiRouter.post("/orders/:order_id/approve", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  // Altera status de "Em Análise" para "Novo" (ou "Em Preparo")
  existing.status = "Novo";
  existing.updated_at = nowUtc();
  orders.set(order_id, existing);

  // Notifica o cliente no WhatsApp que o pedido foi conferido e aprovado!
  const phone = existing.customer_phone || "";
  if (phone) {
    try {
      await notifyClientOrderStatus(phone, "Aprovado", existing);
    } catch (e: any) {
      console.warn("[Orders] Falha ao notificar aprovação de pedido no WhatsApp:", e.message);
    }
  }

  return res.json(existing);
});

apiRouter.patch("/orders/:order_id/status", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const { status } = req.body || {};
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  existing.status = status;
  existing.updated_at = nowUtc();
  orders.set(order_id, existing);

  // Avisa automaticamente o cliente no WhatsApp de acordo com o status atualizado
  // (Pronto: avisa que está pronto; Em Entrega: avisa que saiu para entrega; Concluído: avisa e manda o resumo)
  const phone = existing.customer_phone || "";
  if (phone && ["Pronto", "Em Entrega", "Concluído"].includes(status)) {
    try {
      await notifyClientOrderStatus(phone, status, existing);
    } catch (e: any) {
      console.warn(`[Orders] Falha ao notificar status "${status}" no WhatsApp:`, e.message);
    }
  }

  return res.json(existing);
});

apiRouter.patch("/orders/:order_id/payment", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const { payment_method } = req.body || {};
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  existing.payment_method = payment_method;
  existing.updated_at = nowUtc();
  orders.set(order_id, existing);
  return res.json(existing);
});

apiRouter.patch("/orders/:order_id/unarchive", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  existing.archived = false;
  delete existing.archived_at;
  existing.updated_at = nowUtc();
  orders.set(order_id, existing);
  return res.json(existing);
});

apiRouter.patch("/orders/:order_id/archive", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  existing.archived = true;
  existing.archived_at = nowUtc();
  existing.updated_at = nowUtc();
  orders.set(order_id, existing);
  return res.json(existing);
});

apiRouter.delete("/orders/:order_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { order_id } = req.params;
  const existing = orders.get(order_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Pedido não encontrado" });
  }

  orders.delete(order_id);
  return res.json({ ok: true });
});

// Delivery Zones
apiRouter.get("/delivery-zones", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const zones = Array.from(deliveryZones.values())
    .filter((z) => z.user_id === userId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return res.json(zones);
});

apiRouter.post("/delivery-zones", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { name, fee } = req.body || {};
  if (!name || fee == null) {
    return res.status(400).json({ detail: "Nome e taxa são obrigatórios" });
  }

  const zid = generateId("zone");
  const newZone: DeliveryZone = {
    zone_id: zid,
    user_id: userId,
    name: String(name).trim(),
    fee: Number(fee),
  };

  deliveryZones.set(zid, newZone);
  return res.json(newZone);
});

apiRouter.put("/delivery-zones/:zone_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { zone_id } = req.params;
  const existing = deliveryZones.get(zone_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Zona não encontrada" });
  }

  const updated: DeliveryZone = {
    ...existing,
    ...req.body,
    zone_id: existing.zone_id,
    user_id: existing.user_id,
  };

  deliveryZones.set(zone_id, updated);
  return res.json(updated);
});

apiRouter.delete("/delivery-zones/:zone_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { zone_id } = req.params;
  const existing = deliveryZones.get(zone_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Zona não encontrada" });
  }

  deliveryZones.delete(zone_id);
  return res.json({ ok: true });
});

// Customers
apiRouter.get("/customers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const q = String(req.query.q || "").toLowerCase().trim();

  let userCustomers = Array.from(customers.values()).filter((c) => c.user_id === userId);

  if (q) {
    userCustomers = userCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );
  }

  userCustomers.sort((a, b) => a.name.localeCompare(b.name));
  return res.json(userCustomers);
});

apiRouter.post("/customers", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { name, phone, address = "", delivery_zone_id, notes = "" } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ detail: "Nome é obrigatório" });
  }
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ detail: "Telefone é obrigatório para salvar o cliente" });
  }

  const cleanPhone = String(phone).trim();
  const cleanName = String(name).trim();

  // Dedup by phone
  let existing = Array.from(customers.values()).find(
    (c) => c.user_id === userId && c.phone === cleanPhone
  );

  if (existing) {
    existing.name = cleanName;
    if (address) existing.address = address;
    if (delivery_zone_id) existing.delivery_zone_id = delivery_zone_id;
    if (notes) existing.notes = notes;
    customers.set(existing.customer_id, existing);
    return res.json(existing);
  }

  const cid = generateId("cus");
  const newCus: Customer = {
    customer_id: cid,
    user_id: userId,
    name: cleanName,
    phone: cleanPhone,
    address,
    delivery_zone_id,
    notes,
    created_at: nowUtc(),
  };

  customers.set(cid, newCus);
  return res.json(newCus);
});

apiRouter.put("/customers/:customer_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { customer_id } = req.params;
  const existing = customers.get(customer_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Cliente não encontrado" });
  }

  const updated: Customer = {
    ...existing,
    ...req.body,
    customer_id: existing.customer_id,
    user_id: existing.user_id,
  };

  customers.set(customer_id, updated);
  return res.json(updated);
});

apiRouter.delete("/customers/:customer_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { customer_id } = req.params;
  const existing = customers.get(customer_id);

  if (!existing || existing.user_id !== userId) {
    return res.status(404).json({ detail: "Cliente não encontrado" });
  }

  customers.delete(customer_id);
  return res.json({ ok: true });
});

// Reports summary
apiRouter.get("/reports/summary", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const days = Number(req.query.days) || 7;
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;

  const since = dateFrom || new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const until = dateTo || new Date().toISOString();

  const userOrders = Array.from(orders.values()).filter(
    (o) => o.user_id === userId && o.created_at >= since && o.created_at <= until
  );

  const todayStr = new Date().toISOString().substring(0, 10);
  const todayOrders = userOrders.filter(
    (o) => o.created_at.substring(0, 10) === todayStr && o.status !== "Cancelado"
  );
  const pendingOrders = userOrders.filter(
    (o) => ["Novo", "Em Preparo", "Pronto", "Em Entrega"].includes(o.status) && !o.archived
  );
  const completedOrders = userOrders.filter((o) => o.status === "Concluído");

  const todayRevenue = todayOrders.reduce((acc, o) => acc + o.total, 0);
  const validOrders = userOrders.filter((o) => o.status !== "Cancelado");
  const periodRevenue = validOrders.reduce((acc, o) => acc + o.total, 0);
  const avgTicket = validOrders.length > 0 ? periodRevenue / validOrders.length : 0;

  // By day
  const byDayMap = new Map<string, { day: string; total: number; orders: number }>();
  for (const o of validOrders) {
    const d = o.created_at.substring(0, 10);
    const entry = byDayMap.get(d) || { day: d, total: 0, orders: 0 };
    entry.total += o.total;
    entry.orders += 1;
    byDayMap.set(d, entry);
  }

  // By payment
  const byPaymentMap = new Map<string, { method: string; total: number; count: number }>();
  for (const o of validOrders) {
    const pm = o.payment_method || "Outro";
    const entry = byPaymentMap.get(pm) || { method: pm, total: 0, count: 0 };
    entry.total += o.total;
    entry.count += 1;
    byPaymentMap.set(pm, entry);
  }

  // Top products
  const byProductMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const o of validOrders) {
    for (const item of o.items || []) {
      const entry = byProductMap.get(item.name) || { name: item.name, quantity: 0, total: 0 };
      entry.quantity += item.quantity;
      entry.total += item.quantity * item.price;
      byProductMap.set(item.name, entry);
    }
  }

  const topProducts = Array.from(byProductMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return res.json({
    today_revenue: Math.round(todayRevenue * 100) / 100,
    today_orders: todayOrders.length,
    pending_orders: pendingOrders.length,
    completed_orders: completedOrders.length,
    period_revenue: Math.round(periodRevenue * 100) / 100,
    avg_ticket: Math.round(avgTicket * 100) / 100,
    by_day: Array.from(byDayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
    by_payment: Array.from(byPaymentMap.values()),
    top_products: topProducts,
  });
});

// Day close & management
apiRouter.get("/day/status", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const dayState = globalDayState || user.day_state || "open";
  const dayOpenedAt =
    globalDayOpenedAt || user.day_opened_at || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const lastCloseAt = user.last_close_at || null;

  const userActiveOrders = Array.from(orders.values()).filter(
    (o) => o.user_id === user.user_id && !o.archived
  );

  const openOrders = userActiveOrders.filter(
    (o) => !["Concluído", "Cancelado"].includes(o.status)
  );

  const validOrders = userActiveOrders.filter((o) => o.status !== "Cancelado");

  const revenue = validOrders.reduce((acc, o) => acc + o.total, 0);

  const pendingPayment = userActiveOrders.filter(
    (o) => o.payment_method === "Pendente" && o.status !== "Cancelado"
  ).length;

  // Breakdown por forma de pagamento no caixa atual
  const byPaymentMap = new Map<string, { method: string; total: number; count: number }>();
  for (const o of validOrders) {
    const pm = o.payment_method || "Outro";
    const e = byPaymentMap.get(pm) || { method: pm, total: 0, count: 0 };
    e.total += o.total;
    e.count += 1;
    byPaymentMap.set(pm, e);
  }

  return res.json({
    day_state: dayState,
    is_open: dayState === "open",
    day_opened_at: dayOpenedAt,
    initial_cash_balance: initialCashBalance,
    last_close_at: lastCloseAt,
    period_start: dayOpenedAt,
    now: nowUtc(),
    open_orders: openOrders.length,
    total_orders: userActiveOrders.length,
    revenue: Math.round(revenue * 100) / 100,
    pending_payment_orders: pendingPayment,
    by_payment: Array.from(byPaymentMap.values()),
  });
});

apiRouter.post("/day/open", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const openedAt = nowUtc();
  globalDayState = "open";
  globalDayOpenedAt = openedAt;
  if (req.body?.initial_cash != null) {
    initialCashBalance = Number(req.body.initial_cash) || 0;
  }
  user.day_state = "open";
  user.day_opened_at = openedAt;
  users.set(user.user_id, user);

  return res.json({
    day_state: "open",
    is_open: true,
    day_opened_at: openedAt,
    initial_cash_balance: initialCashBalance,
  });
});

apiRouter.post("/day/close", authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  globalDayState = "closed";
  const periodStart =
    globalDayOpenedAt ||
    user.day_opened_at ||
    user.last_close_at ||
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const periodEnd = nowUtc();

  // Find all active unarchived orders
  const activeOrders = Array.from(orders.values()).filter(
    (o) => o.user_id === user.user_id && !o.archived
  );

  // Mark open ones as Concluído & archive all
  for (const o of activeOrders) {
    if (!["Concluído", "Cancelado"].includes(o.status)) {
      o.status = "Concluído";
    }
    o.archived = true;
    o.archived_at = periodEnd;
    o.updated_at = periodEnd;
    orders.set(o.order_id, o);
  }

  const validOrders = activeOrders.filter((o) => o.status !== "Cancelado");
  const cancelledOrders = activeOrders.filter((o) => o.status === "Cancelado");
  const revenue = validOrders.reduce((acc, o) => acc + o.total, 0);

  // Group by payment
  const byPaymentMap = new Map<string, { method: string; total: number; count: number }>();
  for (const o of validOrders) {
    const pm = o.payment_method || "Outro";
    const e = byPaymentMap.get(pm) || { method: pm, total: 0, count: 0 };
    e.total += o.total;
    e.count += 1;
    byPaymentMap.set(pm, e);
  }

  // Group by type
  const byTypeMap = new Map<string, { total: number; count: number }>();
  byTypeMap.set("Entrega", { total: 0, count: 0 });
  byTypeMap.set("Retirada", { total: 0, count: 0 });
  for (const o of validOrders) {
    const t = o.delivery_type || "Entrega";
    const e = byTypeMap.get(t) || { total: 0, count: 0 };
    e.total += o.total;
    e.count += 1;
    byTypeMap.set(t, e);
  }

  // Top products
  const byProductMap = new Map<string, { name: string; quantity: number; total: number }>();
  for (const o of validOrders) {
    for (const item of o.items || []) {
      const e = byProductMap.get(item.name) || { name: item.name, quantity: 0, total: 0 };
      e.quantity += item.quantity;
      e.total += item.quantity * item.price;
      byProductMap.set(item.name, e);
    }
  }

  const topProducts = Array.from(byProductMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  user.last_close_at = periodEnd;
  user.day_state = "closed";
  users.set(user.user_id, user);

  const closeId = generateId("close");
  const report: DayClose = {
    close_id: closeId,
    user_id: user.user_id,
    created_at: periodEnd,
    period_start: periodStart,
    period_end: periodEnd,
    total_orders: activeOrders.length,
    valid_orders: validOrders.length,
    cancelled_orders: cancelledOrders.length,
    revenue: Math.round(revenue * 100) / 100,
    avg_ticket:
      validOrders.length > 0 ? Math.round((revenue / validOrders.length) * 100) / 100 : 0,
    by_payment: Array.from(byPaymentMap.values()),
    by_type: Array.from(byTypeMap.entries()).map(([k, v]) => ({ type: k, ...v })),
    top_products: topProducts,
  };

  dayCloses.set(closeId, report);
  return res.json({ ...report, orders: activeOrders });
});

apiRouter.get("/day/closes", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const list = Array.from(dayCloses.values())
    .filter((dc) => dc.user_id === userId)
    .sort((a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime());
  return res.json(list);
});

apiRouter.get("/day/closes/:close_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { close_id } = req.params;
  const doc = dayCloses.get(close_id);

  if (!doc || doc.user_id !== userId) {
    return res.status(404).json({ detail: "Fechamento não encontrado" });
  }

  const closeOrders = Array.from(orders.values()).filter(
    (o) =>
      o.user_id === userId &&
      o.archived &&
      (o.archived_at === doc.period_end ||
        (o.created_at >= doc.period_start && o.created_at <= doc.period_end))
  );

  return res.json({ ...doc, orders: closeOrders });
});

apiRouter.delete("/day/closes/:close_id", authMiddleware, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.user_id;
  const { close_id } = req.params;
  const doc = dayCloses.get(close_id);

  if (!doc || doc.user_id !== userId) {
    return res.status(404).json({ detail: "Fechamento não encontrado" });
  }

  dayCloses.delete(close_id);
  return res.json({ ok: true });
});

// File upload & serve
apiRouter.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  (req: AuthenticatedRequest, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ detail: "Nenhum arquivo enviado" });
    }

    const userId = req.user!.user_id;
    const fileId = generateId("file");
    const ext = path.extname(file.originalname) || ".png";
    const storagePath = `marmitahub/uploads/${userId}/${fileId}${ext}`;

    const uploadedFile: UploadedFile = {
      file_id: fileId,
      user_id: userId,
      storage_path: storagePath,
      original_filename: file.originalname,
      content_type: file.mimetype,
      size: file.size,
      data: file.buffer,
      created_at: nowUtc(),
    };

    files.set(storagePath, uploadedFile);
    return res.json({
      path: storagePath,
      url: `/api/files/${storagePath}`,
    });
  }
);

apiRouter.get("/files/*", (req, res) => {
  // Extract path following /api/files/
  const filePath = req.params[0] || "";
  const file = files.get(filePath);

  if (!file) {
    return res.status(404).json({ detail: "Arquivo não encontrado" });
  }

  res.setHeader("Content-Type", file.content_type);
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(file.data);
});

// AI Endpoints (Gemini 2.5 Flash via @google/genai, with intelligent local fallback)
apiRouter.post(
  "/ai/product-description",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { name, category = "Marmita", tone = "acolhedor" } = req.body || {};
    if (!name) return res.status(400).json({ detail: "Nome obrigatório" });

    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `Você é um copywriter de marmitaria brasileira. Gere uma descrição curta, apetitosa e direta (máx 2 frases, ~180 caracteres) em português brasileiro para o produto: "${name}", categoria: "${category}", tom: "${tone}". Fale de sabor, ingredientes típicos e sensação. Não invente preços. Não use emojis. Responda APENAS com a descrição, sem aspas e sem prefixos.`,
        });
        const text = response.text?.trim().replace(/^"|"$/g, "") || "";
        if (text) return res.json({ description: text });
      } catch (err) {
        console.warn("Gemini call failed, using fallback:", err);
      }
    }

    // High-quality Brazilian marmita copy fallback
    const descriptions = [
      `Deliciosa porção de ${name}, preparada com tempero caseiro artesanal, ingredientes frescos e aquele sabor inconfundível de comida de mãe.`,
      `${name} com guarnições selecionadas, aroma acolhedor e equilíbrio perfeito para saciar sua fome com muito carinho.`,
      `Feito com amor e tradição brasileira: ${name} fresquinho, suculento e no ponto certo para sua melhor refeição.`,
    ];
    const picked = descriptions[Math.floor(Math.random() * descriptions.length)];
    return res.json({ description: picked });
  }
);

apiRouter.post(
  "/ai/report-insights",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const summary = req.body || {};

    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: `Você é um consultor especialista em marmitarias e delivery. Analise o seguinte resumo do dia (JSON): ${JSON.stringify(
            summary
          )}. Responda em português brasileiro com 3 a 5 bullets curtas (começando com "• "). Destaque faturamento, ticket médio, produto campeão, pagamentos e uma dica prática de melhoria. Sem markdown pesado, apenas bullets simples.`,
        });
        const text = response.text?.trim() || "";
        if (text) return res.json({ insights: text });
      } catch (err) {
        console.warn("Gemini insights call failed, using fallback:", err);
      }
    }

    // Fallback insights calculated from data
    const rev = summary.revenue || summary.period_revenue || 0;
    const total = summary.total_orders || summary.today_orders || 0;
    const avg = summary.avg_ticket || (total > 0 ? rev / total : 0);
    const topProd = summary.top_products?.[0]?.name || "Marmitas Tradicionais";

    const insights = [
      `• Faturamento do período totalizou R$ ${Number(rev).toFixed(2)} com ${total} pedidos realizados.`,
      `• Ticket médio registrado em R$ ${Number(avg).toFixed(2)}, demonstrando boa aceitação do cardápio.`,
      `• O item mais vendido foi "${topProd}", consolidando-se como carro-chefe da cozinha.`,
      `• Mantenha o estoque de marmitas e embalagens reforçado para os horários de pico do almoço.`,
    ].join("\n");

    return res.json({ insights });
  }
);

apiRouter.post("/ai/parse-order", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { text } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ detail: "Texto obrigatório" });
  }

  const userId = req.user!.user_id;
  const userProducts = Array.from(products.values()).filter(
    (p) => p.user_id === userId && p.active
  );

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Você extrai dados de um pedido de marmitaria a partir de uma mensagem de cliente em português.
Responda SOMENTE em JSON válido (sem markdown, sem crases, sem explicações extras) com este schema:
{
  "customer_name": string,
  "customer_phone": string,
  "delivery_type": "Entrega"|"Retirada",
  "address": string,
  "payment_method": "Dinheiro"|"Cartão Crédito"|"Cartão Débito"|"Pix"|"Outro"|"Pendente",
  "items": [{"product_id": string|null, "name": string, "quantity": number}],
  "notes": string
}
Regras:
- Se não souber um campo, use string vazia "".
- delivery_type padrão "Entrega" se houver endereço; "Retirada" se mencionar buscar/balcão.
- payment_method "Pendente" se não especificado.
- Casar itens com catálogo disponível quando possível.
Catálogo: ${JSON.stringify(
          userProducts.map((p) => ({
            product_id: p.product_id,
            name: p.name,
            price: p.price,
          }))
        )}
Mensagem do cliente:
"${text}"`,
      });

      let raw = response.text?.trim() || "";
      if (raw.startsWith("```")) {
        raw = raw.replace(/^```json|^```/g, "").replace(/```$/g, "").trim();
      }
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s !== -1 && e !== -1) {
        const parsed = JSON.parse(raw.substring(s, e + 1));
        const catalogMap = new Map(userProducts.map((p) => [p.product_id, p]));
        for (const it of parsed.items || []) {
          if (it.product_id && catalogMap.has(it.product_id)) {
            const cp = catalogMap.get(it.product_id)!;
            it.name = cp.name;
            it.price = cp.price;
          } else {
            // Try match by name
            const found = userProducts.find((p) =>
              p.name.toLowerCase().includes(String(it.name || "").toLowerCase())
            );
            if (found) {
              it.product_id = found.product_id;
              it.name = found.name;
              it.price = found.price;
            } else {
              it.price = 0;
            }
          }
          it.additionals = [];
          it.quantity = Number(it.quantity || 1);
        }
        return res.json(parsed);
      }
    } catch (err) {
      console.warn("AI parse order failed, running smart matcher:", err);
    }
  }

  // Rule-based fallback matcher for speech or text orders
  const lower = String(text).toLowerCase();
  const isRetirada =
    lower.includes("retirar") ||
    lower.includes("retirada") ||
    lower.includes("balcão") ||
    lower.includes("balcao") ||
    lower.includes("buscar");

  let detectedPayment = "Pendente";
  if (lower.includes("pix")) detectedPayment = "Pix";
  else if (lower.includes("dinheiro")) detectedPayment = "Dinheiro";
  else if (lower.includes("crédito") || lower.includes("credito"))
    detectedPayment = "Cartão Crédito";
  else if (lower.includes("débito") || lower.includes("debito"))
    detectedPayment = "Cartão Débito";

  // Try extracting customer name: e.g. "nome: João" or "aqui é o Carlos" or "meu nome é Maria"
  let customerName = "";
  const nameMatch =
    text.match(/(?:nome(?: é)?|aqui é (?:o|a)?|sou (?:o|a)?)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i) ||
    text.match(/^([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s*[-:]/);
  if (nameMatch) {
    customerName = nameMatch[1].trim();
  }

  // Try extracting phone
  let phone = "";
  const phoneMatch = text.match(/(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/);
  if (phoneMatch) {
    phone = phoneMatch[0].trim();
  }

  // Try extracting address
  let address = "";
  const addrMatch = text.match(/(?:rua|av\.?|avenida|travessa|alameda)\s+[^,\n]+(?:,\s*\d+)?/i);
  if (addrMatch) {
    address = addrMatch[0].trim();
  }

  // Match items from catalog
  const matchedItems: OrderItem[] = [];
  for (const prod of userProducts) {
    if (lower.includes(prod.name.toLowerCase())) {
      matchedItems.push({
        product_id: prod.product_id,
        name: prod.name,
        price: prod.price,
        quantity: 1,
        additionals: [],
      });
    }
  }

  if (matchedItems.length === 0 && userProducts.length > 0) {
    // Default to first product if nothing matched
    const first = userProducts[0];
    matchedItems.push({
      product_id: first.product_id,
      name: first.name,
      price: first.price,
      quantity: 1,
      additionals: [],
    });
  }

  return res.json({
    customer_name: customerName || "Cliente Balcão",
    customer_phone: phone,
    delivery_type: isRetirada ? "Retirada" : "Entrega",
    address: isRetirada ? "Retirada no balcão" : address,
    payment_method: detectedPayment,
    items: matchedItems,
    notes: text.length > 100 ? text.substring(0, 100) : "",
  });
});

// ---------------- Backup & Restauração de Dados (.ZIP e .JSON) ----------------
apiRouter.get("/backup/export", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const format = String(req.query.format || "zip").toLowerCase();
  const userId = req.user!.user_id;

  const data = {
    metadata: {
      app: "Marmita Hub PDV & Delivery",
      version: "1.0.0",
      exported_at: nowUtc(),
      user_id: userId,
      user_email: req.user!.email,
    },
    products: Array.from(products.values()),
    orders: Array.from(orders.values()),
    customers: Array.from(customers.values()),
    delivery_zones: Array.from(deliveryZones.values()),
    day_closes: Array.from(dayCloses.values()),
    store_settings: {
      accepting_orders: acceptingOrders,
      high_demand_message: highDemandMessage,
      scheduled_delivery_enabled: scheduledDeliveryEnabled,
      scheduled_delivery_fee: scheduledDeliveryFee,
      scheduled_delivery_hours: scheduledDeliveryHours,
      ai_custom_instructions: aiCustomInstructions,
      pix_key: pixKey,
      pix_beneficiary: pixBeneficiary,
      store_address: storeAddress,
      store_maps_url: storeMapsUrl,
      business_hours: businessHours,
      day_state: globalDayState,
      initial_cash_balance: initialCashBalance,
    },
    chats: getAllChats(),
  };

  const dateStr = new Date().toISOString().substring(0, 10);

  if (format === "json") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="MarmitaHub_Backup_${dateStr}.json"`);
    return res.json(data);
  }

  // Padrão: Exportar como arquivo .ZIP
  try {
    const zip = new JSZip();
    zip.file("backup_metadata.json", JSON.stringify(data.metadata, null, 2));
    zip.file("products.json", JSON.stringify(data.products, null, 2));
    zip.file("orders.json", JSON.stringify(data.orders, null, 2));
    zip.file("customers.json", JSON.stringify(data.customers, null, 2));
    zip.file("delivery_zones.json", JSON.stringify(data.delivery_zones, null, 2));
    zip.file("day_closes.json", JSON.stringify(data.day_closes, null, 2));
    zip.file("store_settings.json", JSON.stringify(data.store_settings, null, 2));
    zip.file("whatsapp_chats.json", JSON.stringify(data.chats, null, 2));
    zip.file("marmita_hub_full_backup.json", JSON.stringify(data, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="MarmitaHub_Backup_${dateStr}.zip"`);
    return res.send(zipBuffer);
  } catch (err: any) {
    return res.status(500).json({ error: "Erro ao gerar arquivo ZIP de backup: " + err.message });
  }
});

apiRouter.post(
  "/backup/import",
  authMiddleware,
  upload.single("file"),
  async (req: AuthenticatedRequest, res) => {
    try {
      let backupData: any = null;

      if (req.file) {
        const filename = req.file.originalname.toLowerCase();
        if (filename.endsWith(".zip") || filename.endsWith(".zap")) {
          const zip = await JSZip.loadAsync(req.file.buffer);
          let jsonStr = "";
          if (zip.file("marmita_hub_full_backup.json")) {
            jsonStr = await zip.file("marmita_hub_full_backup.json")!.async("string");
          } else if (zip.file("products.json")) {
            const prods = JSON.parse(await zip.file("products.json")!.async("string"));
            const ords = zip.file("orders.json") ? JSON.parse(await zip.file("orders.json")!.async("string")) : [];
            const custs = zip.file("customers.json") ? JSON.parse(await zip.file("customers.json")!.async("string")) : [];
            const zones = zip.file("delivery_zones.json") ? JSON.parse(await zip.file("delivery_zones.json")!.async("string")) : [];
            const closes = zip.file("day_closes.json") ? JSON.parse(await zip.file("day_closes.json")!.async("string")) : [];
            const settings = zip.file("store_settings.json") ? JSON.parse(await zip.file("store_settings.json")!.async("string")) : {};
            backupData = {
              products: prods,
              orders: ords,
              customers: custs,
              delivery_zones: zones,
              day_closes: closes,
              store_settings: settings,
            };
          }
          if (jsonStr) backupData = JSON.parse(jsonStr);
        } else {
          backupData = JSON.parse(req.file.buffer.toString("utf-8"));
        }
      } else if (req.body && (req.body.products || req.body.orders || req.body.customers)) {
        backupData = req.body;
      }

      if (!backupData) {
        return res.status(400).json({ detail: "Arquivo ou dados de backup inválidos." });
      }

      const userId = req.user!.user_id;

      // Restauração das coleções no banco em memória
      if (Array.isArray(backupData.products)) {
        products.clear();
        backupData.products.forEach((p: Product) => products.set(p.product_id, { ...p, user_id: userId }));
      }
      if (Array.isArray(backupData.orders)) {
        orders.clear();
        backupData.orders.forEach((o: Order) => orders.set(o.order_id, { ...o, user_id: userId }));
      }
      if (Array.isArray(backupData.customers)) {
        customers.clear();
        backupData.customers.forEach((c: Customer) => customers.set(c.customer_id, { ...c, user_id: userId }));
      }
      if (Array.isArray(backupData.delivery_zones)) {
        deliveryZones.clear();
        backupData.delivery_zones.forEach((z: DeliveryZone) => deliveryZones.set(z.zone_id, { ...z, user_id: userId }));
      }
      if (Array.isArray(backupData.day_closes)) {
        dayCloses.clear();
        backupData.day_closes.forEach((dc: DayClose) => dayCloses.set(dc.close_id, { ...dc, user_id: userId }));
      }

      if (backupData.store_settings) {
        const st = backupData.store_settings;
        if (typeof st.accepting_orders === "boolean") acceptingOrders = st.accepting_orders;
        if (st.high_demand_message) highDemandMessage = st.high_demand_message;
        if (st.pix_key) pixKey = st.pix_key;
        if (st.pix_beneficiary) pixBeneficiary = st.pix_beneficiary;
        if (st.store_address) storeAddress = st.store_address;
        if (st.store_maps_url) storeMapsUrl = st.store_maps_url;
        if (st.business_hours) businessHours = st.business_hours;
        if (st.ai_custom_instructions) aiCustomInstructions = st.ai_custom_instructions;
      }

      return res.json({
        success: true,
        message: "Backup restaurado com sucesso!",
        restored: {
          products: products.size,
          orders: orders.size,
          customers: customers.size,
          delivery_zones: deliveryZones.size,
          day_closes: dayCloses.size,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Erro ao importar backup: " + err.message });
    }
  }
);

apiRouter.post("/backup/send-whatsapp", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { phone } = req.body || {};
  const targetPhone = phone || "5511999998888";

  const summaryText = `📦 *BACKUP DO MARMITA HUB* 📦\n━━━━━━━━━━━━━━━━━━\n🗓️ *Data:* ${new Date().toLocaleDateString("pt-BR")}\n🍛 *Produtos no cardápio:* ${products.size}\n📋 *Total de pedidos:* ${orders.size}\n👥 *Clientes cadastrados:* ${customers.size}\n🚚 *Zonas de entrega:* ${deliveryZones.size}\n💰 *Fechamentos arquivados:* ${dayCloses.size}\n━━━━━━━━━━━━━━━━━━\n✅ Todos os dados estão protegidos e sincronizados no sistema!`;

  try {
    const result = await sendManualChatMessage(targetPhone, summaryText, "Sistema de Backup");
    return res.json({ success: true, message: "Backup enviado para o WhatsApp com sucesso!", result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.use("/api", apiRouter);

// ---------------- Vite / Frontend Middleware ----------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Marmita Hub server ready at http://0.0.0.0:${PORT}`);
    startHealthCheckMonitor();
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
