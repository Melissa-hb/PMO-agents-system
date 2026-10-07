/**
 * Resolucion dinamica de URLs segun la red desde la que se accede al frontend.
 * - Red local de la universidad (hostname con 172.16.0.136): se usan las URLs internas.
 * - Red publica (o cualquier otro host): VITE_API_BASE_URL si existe, si no la URL publica.
 */
const LOCAL_IP = '172.16.0.136';
const PUBLIC_IP = '200.3.193.11';

const LOCAL_API_BASE_URL = `http://pmo-platform-back.${LOCAL_IP}.sslip.io`;
const PUBLIC_API_BASE_URL = `http://pmo-platform-back.${PUBLIC_IP}.sslip.io`;

const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

export function isUniversityLocalNetwork(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.includes(LOCAL_IP);
}

export function resolveApiBaseUrl(): string {
  if (isUniversityLocalNetwork()) return LOCAL_API_BASE_URL;
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return stripTrailingSlash(envUrl || PUBLIC_API_BASE_URL);
}

/**
 * Supabase (self-hosted) se expone en ambas redes con el mismo esquema sslip.io:
 * desde la red local se reemplaza la IP publica por la interna en VITE_SUPABASE_URL.
 */
export function resolveSupabaseUrl(): string | undefined {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!envUrl) return envUrl;
  return stripTrailingSlash(isUniversityLocalNetwork() ? envUrl.split(PUBLIC_IP).join(LOCAL_IP) : envUrl);
}
