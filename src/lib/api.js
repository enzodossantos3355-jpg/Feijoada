import axios from "axios";

export const BACKEND_URL = "/api";

const api = axios.create({
  baseURL: BACKEND_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("marmita_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function BRL(value = 0) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

BRL.format = function (value = 0) {
  return BRL(value);
};

export function formatApiErrorDetail(error) {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  return error?.message || "Erro de conexão com o servidor.";
}

export default api;
