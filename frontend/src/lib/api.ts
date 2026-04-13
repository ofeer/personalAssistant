import axios from "axios";

import { supabase } from "./supabase";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

let signingOut = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !signingOut) {
      signingOut = true;
      await supabase.auth.signOut();
      signingOut = false;
    }
    return Promise.reject(error);
  },
);

export { api };
