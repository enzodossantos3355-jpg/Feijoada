import { useState, useEffect } from "react";
import api, { BRL } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, Sparkle, Package, Check, X } from "@phosphor-icons/react";

export default function Produtos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const [form, setForm] = useState({
    name: "",
    category: "Marmita",
    price: "",
    description: "",
    active: true,
    image_url: "",
  });

  const loadProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data || []);
    } catch {
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOpenModal = (prod = null) => {
    if (prod) {
      setEditingProduct(prod);
      setForm({
        name: prod.name || "",
        category: prod.category || "Marmita",
        price: prod.price ? String(prod.price) : "",
        description: prod.description || "",
        active: prod.active ?? true,
        image_url: prod.image_url || "",
      });
    } else {
      setEditingProduct(null);
      setForm({
        name: "",
        category: "Marmita",
        price: "",
        description: "",
        active: true,
        image_url: "",
      });
    }
    setModalOpen(true);
  };

  const handleGenerateAiDescription = async () => {
    if (!form.name.trim()) {
      toast.error("Preencha o nome do prato primeiro");
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await api.post("/ai/generate-description", {
        name: form.name,
        category: form.category,
        tone: "apetitoso e acolhedor",
      });
      if (res.data?.description) {
        setForm((prev) => ({ ...prev, description: res.data.description }));
        toast.success("Descrição apetitosa gerada com IA!");
      }
    } catch {
      toast.error("Falha ao gerar descrição");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: parseFloat(form.price) || 0,
    };

    try {
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct.product_id}`, payload);
        setProducts((prev) =>
          prev.map((p) => (p.product_id === editingProduct.product_id ? res.data : p))
        );
        toast.success("Prato atualizado com sucesso!");
      } else {
        const res = await api.post("/products", payload);
        setProducts((prev) => [...prev, res.data]);
        toast.success("Novo prato adicionado ao cardápio!");
      }
      setModalOpen(false);
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Deseja realmente remover este prato do cardápio?")) return;
    try {
      await api.delete(`/products/${productId}`);
      setProducts((prev) => prev.filter((p) => p.product_id !== productId));
      toast.success("Prato removido");
    } catch {
      toast.error("Erro ao excluir prato");
    }
  };

  const handleToggleActive = async (prod) => {
    try {
      const updated = { ...prod, active: !prod.active };
      await api.put(`/products/${prod.product_id}`, updated);
      setProducts((prev) =>
        prev.map((p) => (p.product_id === prod.product_id ? updated : p))
      );
      toast.success(updated.active ? "Prato ativado" : "Prato pausado");
    } catch {
      toast.error("Erro ao alterar disponibilidade");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900">Cardápio & Marmitas</h1>
          <p className="text-sm text-stone-500">Cadastre os pratos do dia, tamanhos, adicionais e bebidas</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <Plus size={18} weight="bold" /> Adicionar Prato
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="p-12 text-center text-stone-500">Carregando cardápio...</div>
      ) : products.length === 0 ? (
        <Card className="border-stone-200 text-center py-12">
          <CardContent>
            <Package size={48} className="mx-auto text-stone-300 mb-3" weight="duotone" />
            <p className="text-stone-600 font-medium">Nenhum item cadastrado no cardápio</p>
            <Button onClick={() => handleOpenModal()} variant="outline" className="mt-4">
              Cadastrar Primeiro Prato
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((prod) => (
            <Card
              key={prod.product_id}
              className={`border-stone-200 transition-all ${
                !prod.active ? "opacity-60 bg-stone-50" : "bg-white hover:shadow-md"
              }`}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1 border-stone-200">
                        {prod.category || "Marmita"}
                      </Badge>
                      <h3 className="font-semibold text-stone-900 text-lg leading-snug">{prod.name}</h3>
                    </div>
                    <span className="font-display font-bold text-lg text-[#C5533B]">
                      {BRL(prod.price)}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 line-clamp-3 leading-relaxed">
                    {prod.description || "Sem descrição informada."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                  <Button
                    variant={prod.active ? "secondary" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleToggleActive(prod)}
                  >
                    {prod.active ? "Ativo no Cardápio" : "Pausado (Esgotado)"}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-stone-600"
                      onClick={() => handleOpenModal(prod)}
                    >
                      <PencilSimple size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(prod.product_id)}
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Prato */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Prato" : "Novo Prato no Cardápio"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProduct} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome do Prato / Tamanho</Label>
              <Input
                required
                placeholder="Ex: Marmita Tradicional M (Bife Acebolado)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Marmita">Marmita</SelectItem>
                    <SelectItem value="Fitness">Fitness</SelectItem>
                    <SelectItem value="Bebida">Bebida</SelectItem>
                    <SelectItem value="Sobremesa">Sobremesa</SelectItem>
                    <SelectItem value="Adicional">Adicional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="22.50"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Descrição / Guarnições</Label>
                <button
                  type="button"
                  onClick={handleGenerateAiDescription}
                  disabled={generatingAi}
                  className="text-xs text-[#C5533B] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Sparkle size={13} weight="fill" />
                  {generatingAi ? "Gerando..." : "Gerar com IA"}
                </button>
              </div>
              <Textarea
                rows={3}
                placeholder="Ex: Arroz soltinho, feijão carioca cremoso, bife suculento com cebolas douradas, farofa crocante e salada fresca."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar no Cardápio</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
