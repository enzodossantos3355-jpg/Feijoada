import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ForkKnife } from "@phosphor-icons/react";

export default function Login() {
  const { login, formatApiErrorDetail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo de volta!");
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(formatApiErrorDetail ? formatApiErrorDetail(detail) : detail || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const callbackUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(callbackUrl)}`;
  };

  const searchParams = new URLSearchParams(location.search);
  const errorParam = searchParams.get("error");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-50">
      {/* Imagem Lateral */}
      <div className="hidden lg:flex relative overflow-hidden bg-stone-900">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/3902cf64-244c-4c85-b121-742028aab87f/images/cac5a669c2b1c379a713fded35cbcba22131ce47bdb6e0457b5e90a0ddec9160.png"
          alt="Marmita Brasileira"
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-900/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-lg bg-[#C5533B] flex items-center justify-center">
              <ForkKnife size={22} weight="duotone" className="text-white" />
            </div>
            <span className="font-display text-xl font-bold">Marmita Hub</span>
          </div>
          <p className="text-stone-300 text-sm max-w-md leading-relaxed">
            Gestão operacional ágil, controle de produção na cozinha, expedição rápida e atendimento automatizado via WhatsApp com Inteligência Artificial.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start mb-2">
              <div className="h-8 w-8 rounded-lg bg-[#C5533B] flex items-center justify-center text-white">
                <ForkKnife size={18} weight="duotone" />
              </div>
              <h1 className="font-display text-2xl font-bold text-stone-900">Marmita Hub</h1>
            </div>
            <h2 className="text-xl font-semibold text-stone-800">Acesse sua conta</h2>
            <p className="text-sm text-stone-500">Entre com seu e-mail e senha cadastrados</p>
          </div>

          {errorParam && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              Falha na autenticação. Por favor, tente novamente.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="exemplo@restaurante.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full font-medium">
              {loading ? "Entrando..." : "Entrar no Sistema"}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-stone-50 px-2 text-stone-400">ou continue com</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Entrar com Google
          </Button>

          <p className="text-center text-sm text-stone-500">
            Ainda não tem conta?{" "}
            <Link to="/register" className="text-[#C5533B] font-medium hover:underline">
              Cadastre-se grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
