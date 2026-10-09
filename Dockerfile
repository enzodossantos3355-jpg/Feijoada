FROM node:20-slim

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia todo o código-fonte
COPY . .

# Compila o frontend SPA com Vite
RUN npm run build

# Expõe a porta padrão (Render define PORT dinamicamente)
ENV PORT=10000
ENV NODE_ENV=production
EXPOSE 10000

# Inicia o servidor fullstack (Express + WhatsApp Bot + Frontend SPA)
CMD ["npm", "start"]
