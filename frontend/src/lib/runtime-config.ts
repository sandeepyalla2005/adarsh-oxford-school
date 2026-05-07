type AppEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_API_BASE_URL?: string;
  VITE_MSG91_SENDER_ID?: string;
  VITE_MSG91_ENTITY_ID?: string;
  VITE_MSG91_TEMPLATE_ID?: string;
  VITE_PORTAL_MODE?: string;
};

declare global {
  interface Window {
    __APP_ENV__?: AppEnv;
  }
}

const runtimeEnv = globalThis.window?.__APP_ENV__ ?? {};

const getViteEnv = <T extends keyof AppEnv>(key: T) => {
  if (import.meta.env.DEV) {
    const value = import.meta.env[key];
    return typeof value === "string" ? value : "";
  }
  return runtimeEnv[key] ?? "";
};

export const SUPABASE_URL = getViteEnv("VITE_SUPABASE_URL");
export const SUPABASE_PUBLISHABLE_KEY = getViteEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
export const API_BASE_URL = getViteEnv("VITE_API_BASE_URL");
export const MSG91_SENDER_ID = getViteEnv("VITE_MSG91_SENDER_ID") || "Oxford";
export const MSG91_ENTITY_ID = getViteEnv("VITE_MSG91_ENTITY_ID");
export const MSG91_TEMPLATE_ID = getViteEnv("VITE_MSG91_TEMPLATE_ID");
export const PORTAL_MODE = getViteEnv("VITE_PORTAL_MODE");
