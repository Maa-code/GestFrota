/**
 * Cliente HTTP para a API GestFrota com suporte automático a cookies de sessão HttpOnly
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Envia e recebe cookie HttpOnly
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.erro || data?.message || `Erro HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
