import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../../firebase-applet-config.json';

export class AiAccessError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const loginRequired = () => new AiAccessError(401, 'SIGN_IN_REQUIRED', 'Увійдіть повторно для ШІ-розпізнавання.');
const forbidden = () => new AiAccessError(403, 'AI_ACCESS_DENIED', 'ШІ-розпізнавання доступне користувачам із правом редагування.');
interface AuthOptions { request?: typeof fetch; timeoutMs?: number; }
/** Google validates the token; Firestore reads use the same user's rules, never an admin credential. */
export async function authorizeAiRequest(header: string | undefined, options: AuthOptions = {}): Promise<void> {
  if (!header || !/^Bearer [^\s]{1,8192}$/.test(header)) throw loginRequired();
  const token = header.slice(7), request = options.request ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await request(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: controller.signal
    });
    if (response.status === 400 || response.status === 401) throw loginRequired();
    if (!response.ok) throw new Error('Authentication unavailable');
    const data = await response.json(), user = data.users?.[0];
    if (!Array.isArray(data.users) || data.users.length !== 1 || !user?.localId || typeof user.email !== 'string'
      || user.emailVerified !== true || user.disabled === true) throw forbidden();
    const email = user.email.toLowerCase();
    // Match the existing defaultProject owner exception in firestore.rules.
    if (['domagile@gmail.com', 'cubatarara400@gmail.com'].includes(email)) return;
    const id = email.replace(/[^a-z0-9]/g, '_');
    const path = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/documents/projects/defaultProject/whitelist/${id}`;
    const membership = await request(`https://firestore.googleapis.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    });
    if ([401, 403, 404].includes(membership.status)) throw forbidden();
    if (!membership.ok) throw new Error('Membership unavailable');
    const { fields } = await membership.json();
    if (fields?.email?.stringValue?.toLowerCase() !== email || fields?.status?.stringValue !== 'active'
      || !['admin', 'editor', 'researcher'].includes(fields?.role?.stringValue)) throw forbidden();
  } catch (error) {
    if (error instanceof AiAccessError) throw error;
    throw new AiAccessError(503, 'AUTH_UNAVAILABLE', 'Не вдалося перевірити доступ. Спробуйте пізніше.');
  } finally { clearTimeout(timer); }
}

export function aiCors(origins: string[]) {
  const allowed = new Set(origins.filter(Boolean));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('Origin');
    if (!origin) return next();
    res.vary('Origin');
    if (!allowed.has(origin)) { res.status(403).json({ success: false, code: 'ORIGIN_DENIED', error: 'Цей сайт не має доступу до ШІ-сервера.', results: [] }); return; }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  };
}
