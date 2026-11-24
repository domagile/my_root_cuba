/** Reject failures, demo responses and unbounded waits before callers store AI data. */
export async function requestAiJson(endpoint: string,payload: unknown,timeoutMs=60_000): Promise<any> {
  const controller=new AbortController();
  const timer=setTimeout(() => controller.abort(),timeoutMs);
  try {
    const response=await fetch(endpoint,{
      method: 'POST',headers: { 'Content-Type': 'application/json' },
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
