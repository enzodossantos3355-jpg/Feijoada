import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, ShoppingBag, Utensils, BarChart3, Settings, LogOut, Bot, Archive } from "lucide-react";

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Pedidos", path: "/pedidos", icon: ShoppingBag },
    { label: "Cardápio", path: "/produtos", icon: Utensils },
    { label: "Relatórios", path: "/relatorios", icon: BarChart3 },
    { label: "Armazenamento & Caixas", path: "/armazenamento", icon: Archive },
    { label: "Configurações & IA", path: "/configuracoes", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex">
      <aside className="w-64 bg-stone-900 text-stone-100 flex flex-col border-r border-stone-800">
        <div className="p-6 border-b border-stone-800 flex items-center gap-3">
          <div className="p-2.5 bg-[#C5533B] text-white rounded-xl font-bold text-xl shadow-md">🍱</div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-white font-display">Marmita Hub</h1>
            <p className="text-xs text-stone-400">Gestão Inteligente</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path === "/dashboard" && location.pathname === "/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#C5533B] text-white shadow-sm font-semibold"
                    : "text-stone-400 hover:text-stone-100 hover:bg-stone-800/80"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-sm font-medium text-stone-200 truncate">{user?.name || "Operador"}</p>
              <p className="text-xs text-stone-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="p-2 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg transition-colors flex-shrink-0"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-stone-200 bg-white/80 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-stone-700 font-medium">
            <Bot className="w-5 h-5 text-emerald-600" />
            <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-semibold border border-emerald-200/80">
              IA Gemini Conectada & Ativa
            </span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto">{children || <Outlet />}</div>
      </main>
    </div>
  );
}

export default Layout;
