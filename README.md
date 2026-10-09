# Marmita Hub - Guia de Publicação no Render

Este projeto foi totalmente adaptado para publicação em produção no [Render](https://render.com). O servidor Node.js/Express roda o backend (APIs de pedidos, cardápio, PDV, autenticação e Bot do WhatsApp com IA) e serve o frontend SPA compilado pelo Vite.

---

## 🚀 Opção 1: Publicação Manual via Web Service no Render (Recomendado)

1. Crie uma conta no [Render](https://dashboard.render.com).
2. Suba o código deste repositório para o seu **GitHub** ou **GitLab**.
3. No painel do Render, clique em **New +** e selecione **Web Service**.
4. Conecte o repositório do seu projeto.
5. Configure os seguintes campos:
   - **Name**: `marmita-hub` (ou o nome que preferir)
   - **Region**: `Oregon (US West)` ou `Ohio (US East)`
   - **Branch**: `main`
   - **Root Directory**: Deixe em branco (raiz)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (ou `Starter` para manter o bot sempre acordado sem hibernação de 15 minutos)

---

## 🔑 Credenciais e Variáveis de Ambiente Necessárias no Render

No painel do seu Web Service no Render, vá na aba **Environment** e adicione as seguintes variáveis:

| Variável | Obrigatória? | Valor Recomendado / Descrição |
| :--- | :---: | :--- |
| `NODE_ENV` | **Sim** | `production` |
| `JWT_SECRET` | **Sim** | Uma chave longa e aleatória (ex: gere com `openssl rand -hex 32` ou qualquer sequência segura de 32+ caracteres) |
| `GEMINI_API_KEY` | **Sim** | Sua chave de API do Google Gemini AI (obtenha gratuitamente no [Google AI Studio](https://aistudio.google.com/app/apikey)) |
| `PORT` | Automática | O Render define automaticamente (geralmente `10000`). O código já detecta `process.env.PORT`. |
| `WHATSAPP_AUTH_DIR` | Opcional | `./whatsapp_auth` (ou `/data/whatsapp_auth` se usar Persistent Disk) |
| `VITE_BACKEND_URL` | Opcional | Deixe vazio! Como o frontend e a API rodam no mesmo serviço, o app usa chamadas relativas `/api`. |

---

## 📄 Opção 2: Deploy com 1 Clique via Render Blueprint (`render.yaml`)

O repositório já inclui o arquivo `render.yaml`.
1. No painel do Render, clique em **New +** -> **Blueprint**.
2. Conecte o repositório.
3. O Render lerá o `render.yaml` automaticamente, configurando os comandos de build, start e variáveis.
4. Preencha apenas o valor da `GEMINI_API_KEY` quando solicitado pelo painel.
5. Clique em **Apply**.

---

## 📱 Como Conectar e Usar o WhatsApp no Render

1. Após o deploy finalizar, acesse a URL gerada pelo Render (ex: `https://marmita-hub.onrender.com`).
2. Faça login ou crie sua conta de administrador/atendente.
3. Acesse a aba **WhatsApp** no menu lateral.
4. Clique em **Conectar WhatsApp**.
5. O sistema gerará o **QR Code** na tela em tempo real.
6. Abra o WhatsApp no seu celular, vá em **Aparelhos Conectados > Conectar um aparelho** e aponte para o QR Code na tela.
7. O status mudará para **Conectado** e a inteligência artificial começará a responder seus clientes automaticamente!

> 💡 **Dica sobre planos no Render**:
> No plano gratuito (*Free Tier*), o Render suspende a máquina após 15 minutos sem requisições HTTP e o disco é efêmero. Para um bot de WhatsApp que precisa responder 24/7 sem interrupções e manter a sessão conectada sem reescanear o QR Code, recomenda-se o plano **Starter ($7/mês)** com um **Persistent Disk** montado em `/data` e a variável `WHATSAPP_AUTH_DIR=/data/whatsapp_auth`.

---

## 🛠️ Comandos Locais de Teste

- Modo Desenvolvimento: `npm run dev`
- Compilar Frontend para Produção: `npm run build`
- Iniciar Servidor em Modo Produção: `npm start`
