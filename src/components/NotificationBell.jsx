import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import {
  Bell,
  SpeakerHigh,
  SpeakerSlash,
  CheckCircle,
  Warning,
  ShoppingBag,
  X,
} from "@phosphor-icons/react";
import { playNewOrderSound, playNeedsHumanSound, isSoundEnabled, toggleSound } from "@/lib/sound";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [isOpen, setIsOpen] = useState(false);
  const knownIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/whatsapp/notifications");
      const list = res.data || [];
      setNotifications(list);

      // Na primeira carga, só armazena os IDs existentes para não tocar som antigo em massa
      if (isFirstLoadRef.current) {
        list.forEach((n) => knownIdsRef.current.add(n.id));
        isFirstLoadRef.current = false;
        return;
      }

      // Checa notificações novas não vistas
      const newItems = list.filter((n) => !knownIdsRef.current.has(n.id) && !n.read);

      if (newItems.length > 0) {
        newItems.forEach((item) => {
          knownIdsRef.current.add(item.id);

          if (item.type === "needs_human") {
            playNeedsHumanSound();
            toast.error(item.title, {
              description: item.message,
              action: {
                label: "Abrir Chat",
                onClick: () => navigate("/atendimento"),
              },
              duration: 8000,
            });
          } else {
            playNewOrderSound();
            toast.info(item.title, {
              description: item.message,
              action: {
                label: "Ver Pedidos",
                onClick: () => navigate("/pedidos"),
              },
              duration: 6000,
            });
          }
        });
      }
    } catch {
      // Ignora erro de polling em segundo plano
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3500);
    return () => clearInterval(interval);
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleSound = () => {
    const newState = toggleSound();
    setSoundOn(newState);
    if (newState) {
      toast.success("Notificações com som ativadas!");
    } else {
      toast.info("Som de notificações desativado.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/whatsapp/notifications/clear-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* Botão de Som */}
      <button
        onClick={handleToggleSound}
        className={`p-2 rounded-lg border transition-colors ${
          soundOn
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
            : "bg-stone-100 text-stone-400 border-stone-200 hover:text-stone-600"
        }`}
        title={soundOn ? "Notificações com som ativadas (Clique para mutar)" : "Som desativado (Clique para ativar)"}
      >
        {soundOn ? <SpeakerHigh size={18} weight="bold" /> : <SpeakerSlash size={18} weight="bold" />}
      </button>

      {/* Botão de Sino com Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 transition-colors"
        title="Notificações do WhatsApp"
      >
        <Bell size={18} weight={unreadCount > 0 ? "fill" : "regular"} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de Notificações */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 text-sm">Notificações WhatsApp</span>
              {unreadCount > 0 && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  Marcar lidas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-0.5 rounded"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-stone-400">
                Nenhuma notificação recente.
              </div>
            ) : (
              notifications.slice(0, 15).map((notif) => {
                const isNeedsHuman = notif.type === "needs_human";
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (isNeedsHuman) {
                        navigate("/atendimento");
                      } else {
                        navigate("/pedidos");
                      }
                      setIsOpen(false);
                    }}
                    className={`p-3 text-left transition-colors cursor-pointer hover:bg-stone-50 flex items-start gap-3 ${
                      !notif.read ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isNeedsHuman ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isNeedsHuman ? <Warning size={18} weight="fill" /> : <ShoppingBag size={18} weight="duotone" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-900 leading-snug">{notif.title}</p>
                      <p className="text-xs text-stone-600 line-clamp-2 mt-0.5">{notif.message}</p>
                      <span className="text-[10px] text-stone-400 mt-1 block">
                        {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-stone-100 bg-stone-50 text-center">
            <button
              onClick={() => {
                navigate("/atendimento");
                setIsOpen(false);
              }}
              className="text-xs font-medium text-[#C5533B] hover:underline"
            >
              Ir para Atendimento & Chats WhatsApp →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
