import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ForkKnife } from "@phosphor-icons/react";

export default function Register() {
  const { register, formatApiErrorDetail } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Conta criada com sucesso!");
      navigate("/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(formatApiErrorDetail ? formatApiErrorDetail(detail) : detail || "Falha ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center gap-2 justify-center mb-1">
            <div className="h-8 w-8 rounded-lg bg-[#C5533B] flex items-center justify-center text-white">
              <ForkKnife size={18} weight="duotone" />
            </div>
            <h1 className="font-display text-2xl font-bold text-stone-900">Marmita Hub</h1>
          </div>
          <h2 className="text-xl font-semibold text-stone-800">Crie sua conta</h2>
          <p className="text-sm text-stone-500">Comece a gerenciar sua marmitaria hoje mesmo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nome da Marmitaria / Responsável</Label>
            <Input
              id="name"
              required
              placeholder="Ex: Marmitas da Vó Ana"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="contato@marmitaria.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full font-medium">
            {loading ? "Cadastrando..." : "Criar Conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-stone-500">
          Já tem conta?{" "}
          <Link to="/login" className="text-[#C5533B] font-medium hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
}
