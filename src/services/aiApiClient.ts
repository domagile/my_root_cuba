let aiTokenProvider: (() => Promise<string>) | null = null;
export function setAiTokenProvider(provider: (() => Promise<string>) | null): void { aiTokenProvider = provider; }
export function resolveAiEndpoint(endpoint: string, baseUrl = import.meta.env?.VITE_AI_API_BASE_URL || ''): string {
  if (!endpoint.startsWith('/api/') || endpoint.startsWith('//') || endpoint.includes('\\')) throw new Error('Некоректна адреса ШІ-запиту.');
  if (!baseUrl) return endpoint;
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Некоректна адреса ШІ-сервера.');
  return new URL(endpoint, base).href;
}

/** Reject failures, demo responses and unbounded waits before callers store AI data. */
export async function requestAiJson(endpoint: string,payload: unknown,timeoutMs=60_000): Promise<any> {
  const controller=new AbortController();
  const timer=setTimeout(() => controller.abort(),timeoutMs);
  try {
    const url=resolveAiEndpoint(endpoint);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (aiTokenProvider) {
      const token = await Promise.race([aiTokenProvider(), new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('Authentication timed out')), { once: true });
      })]);
      if (!token) throw new Error('Увійдіть в обліковий запис для ШІ-розпізнавання.');
      headers.Authorization = `Bearer ${token}`;
    }
    const response=await fetch(url,{
      method: 'POST',headers,
      body: JSON.stringify(payload),signal: controller.signal
    });
    let data: any;
    try { data=await response.json(); }
    catch { throw new Error(`Сервер повернув некоректну відповідь (${response.status}).`); }
    if(!response.ok||data?.success!==true||data?.fallback===true) {
      throw new Error(typeof data?.error==='string'? data.error:`Не вдалося виконати ШІ-аналіз (${response.status}).`);
    }
    return data;
  } catch(error) {
    if(controller.signal.aborted) throw new Error('Час очікування ШІ-аналізу вичерпано. Спробуйте ще раз.');
    throw error;
  } finally { clearTimeout(timer); }
}
