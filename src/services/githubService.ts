/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitHubStorageConfig, Person, PlaceDossier, ResearchNote } from '../types';

const STORAGE_KEY = 'rodovid_github_config';

/**
 * Retrieve GitHub Configuration from LocalStorage
 */
export function getGitHubConfig(): GitHubStorageConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        owner: parsed.owner || '',
        repo: parsed.repo || '',
        branch: parsed.branch || 'main',
        token: parsed.token || '',
        baseFolder: parsed.baseFolder || 'archive',
        isConfigured: Boolean(parsed.owner && parsed.repo && parsed.token)
      };
    }
  } catch (err) {
    console.error('Failed to load GitHub config:', err);
  }

  return {
    owner: '',
    repo: '',
    branch: 'main',
    token: '',
    baseFolder: 'archive',
    isConfigured: false
  };
}

/**
 * Save GitHub Configuration to LocalStorage
 */
export function saveGitHubConfig(config: Partial<GitHubStorageConfig>): GitHubStorageConfig {
  const current = getGitHubConfig();
  const updated: GitHubStorageConfig = {
    owner: (config.owner ?? current.owner).trim(),
    repo: (config.repo ?? current.repo).trim(),
    branch: (config.branch ?? current.branch).trim() || 'main',
    token: (config.token ?? current.token).trim(),
    baseFolder: (config.baseFolder ?? current.baseFolder).trim() || 'archive',
    isConfigured: false
  };
  updated.isConfigured = Boolean(updated.owner && updated.repo && updated.token);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save GitHub config:', err);
  }

  return updated;
}

/**
 * Test GitHub connection and check commit access
 */
export async function testGitHubConnection(config: {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}): Promise<{ success: boolean; message: string; details?: any }> {
  const { owner, repo, branch, token } = config;

  if (!owner?.trim() || !repo?.trim() || !token?.trim()) {
    return {
      success: false,
      message: "Вкажіть логін власника (латиницею без пробілів), назву репозиторію та GitHub Personal Access Token."
    };
  }

  // Check if owner contains invalid characters like Cyrillic or spaces
  if (/[^\w\-\.]/.test(owner.trim())) {
    return {
      success: false,
      message: `«${owner}» містить недопустимі символи. Логін власника на GitHub має складатися з латинських літер і цифр (наприклад, ваш GitHub username).`
    };
  }

  try {
    // 1. Check Repo access
    const repoRes = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!repoRes.ok) {
      if (repoRes.status === 401) {
        return { success: false, message: "Недійсний токен доступу (401 Unauthorized). Перевірте токен або створіть новий у налаштуваннях GitHub." };
      }
      if (repoRes.status === 404) {
        return {
          success: false,
          message: `Репозиторій ${owner}/${repo} не знайдено або токен не має прав «repo» (404 Not Found). Перевірте правильність імені репозиторію або створіть його на GitHub.`
        };
      }
      return { success: false, message: `Помилка доступу до репозиторію: HTTP ${repoRes.status}` };
    }

    const repoData = await repoRes.json();
    const effectiveBranch = branch?.trim() || repoData.default_branch || 'main';

    // 2. Check Branch access if repository has commits
    if (repoData.size > 0) {
      const branchRes = await fetch(`https://api.github.com/repos/${owner.trim()}/${repo.trim()}/branches/${effectiveBranch}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!branchRes.ok && branchRes.status === 404) {
        return {
          success: true,
          message: `Репозиторій знайдено! Гілка «${effectiveBranch}» буде створена автоматично при першому завантаженні (основна гілка: «${repoData.default_branch || 'main'}»).`,
          details: {
            fullName: repoData.full_name,
            isPrivate: repoData.private,
            defaultBranch: repoData.default_branch || 'main'
          }
        };
      }
    }

    return {
      success: true,
      message: `Зв'язок з репозиторієм ${repoData.full_name} (${effectiveBranch}) успішно встановлено! Сховище готове до роботи.`,
      details: {
        fullName: repoData.full_name,
        isPrivate: repoData.private,
        defaultBranch: repoData.default_branch || 'main'
      }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Мережева помилка перевірки зв'язку: ${err.message || String(err)}`
    };
  }
}

/**
 * Fetch GitHub user profile using Personal Access Token
 */
export async function fetchGitHubProfile(token: string): Promise<{
  success: boolean;
  login?: string;
  name?: string;
  avatar_url?: string;
  error?: string;
}> {
  if (!token?.trim()) {
    return { success: false, error: 'Вкажіть токен GitHub' };
  }
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, error: 'Недійсний токен доступу (401 Unauthorized). Перевірте правильність токена.' };
      }
      return { success: false, error: `Помилка GitHub API (${res.status})` };
    }
    const data = await res.json();
    return {
      success: true,
      login: data.login,
      name: data.name,
      avatar_url: data.avatar_url
    };
  } catch (err: any) {
    return { success: false, error: `Мережева помилка: ${err.message || String(err)}` };
  }
}

/**
 * Fetch list of user's GitHub repositories
 */
export async function fetchUserRepositories(token: string): Promise<{
  success: boolean;
  repos?: Array<{ name: string; full_name: string; private: boolean; default_branch: string }>;
  error?: string;
}> {
  if (!token?.trim()) {
    return { success: false, error: 'Вкажіть токен' };
  }
  try {
    const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) {
      return { success: false, error: `Не вдалося отримати список репозиторіїв (${res.status})` };
    }
    const data = await res.json();
    const repos = (Array.isArray(data) ? data : []).map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      default_branch: r.default_branch || 'main'
    }));
    return { success: true, repos };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Create a new repository on GitHub for archiving documents
 */
export async function createGitHubRepository(
  token: string,
  name: string,
  isPrivate: boolean = true
): Promise<{ success: boolean; repo?: any; error?: string }> {
  if (!token?.trim() || !name?.trim()) {
    return { success: false, error: 'Вкажіть токен та назву репозиторію' };
  }
  try {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        private: isPrivate,
        auto_init: true,
        description: 'Архів документів та сканів родоводу'
      })
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.message || `Помилка створення репозиторію (${res.status})`
      };
    }
    const data = await res.json();
    return { success: true, repo: data };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sanitize path components for safe Git directory structure
 */
function sanitizePathSegment(name: string): string {
  if (!name) return 'Невідомо';
  return name
    .trim()
    .replace(/[\/\\:*?"<>|#%&{}\\<>*?\/$!'":@+`|=]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Automatically generate clean structured path for a person's document:
 * [archive]/[Гілка_Прізвище]/[Покоління_XX]/[ПІБ_Особи]/[Назва_файлу]
 */
export function generatePersonArchivePath(
  person: Person,
  fileName: string,
  baseFolder: string = 'archive'
): string {
  const surname = 
    person.lastName || 
    person.name?.surname || 
    person.maidenName || 
    person.name?.maidenName || 
    'Рід';
  
  const branchFolder = `Гілка_${sanitizePathSegment(surname)}`;
  const genNumber = person.generation || 1;
  const genFolder = `Покоління_${String(genNumber).padStart(2, '0')}`;

  const firstName = person.firstName || person.name?.given || '';
  const patronymic = person.patronymic || person.name?.patronymic || '';
  const fullName = [person.lastName || person.name?.surname || surname, firstName, patronymic].filter(Boolean).join(' ') || person.id;
  const personFolder = sanitizePathSegment(fullName);

  const safeFileName = sanitizePathSegment(fileName);

  return `${baseFolder}/${branchFolder}/${genFolder}/${personFolder}/${safeFileName}`;
}

/**
 * Upload a file directly to GitHub via GitHub Contents API
 */
export async function uploadFileToGitHub(params: {
  config?: GitHubStorageConfig;
  path: string;
  fileBase64: string;
  commitMessage: string;
}): Promise<{
  success: boolean;
  rawUrl?: string;
  htmlUrl?: string;
  path?: string;
  error?: string;
}> {
  const config = params.config || getGitHubConfig();

  if (!config.owner || !config.repo || !config.token) {
    return {
      success: false,
      error: 'GitHub не налаштовано. Вкажіть репозиторій та токен у Налаштуваннях.'
    };
  }

  const { owner, repo, branch, token } = config;
  const cleanPath = params.path.startsWith('/') ? params.path.slice(1) : params.path;

  // Clean base64 data prefix if present (e.g. data:image/jpeg;base64,...)
  let base64Content = params.fileBase64;
  if (base64Content.includes(',')) {
    base64Content = base64Content.split(',')[1];
  }

  try {
    // 1. Check if file already exists at this path to obtain its SHA (for update)
    let existingSha: string | undefined;
    try {
      const getFileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}?ref=${branch || 'main'}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );

      if (getFileRes.ok) {
        const fileInfo = await getFileRes.json();
        existingSha = fileInfo.sha;
      }
    } catch {
      // file doesn't exist yet, proceed with create
    }

    // 2. PUT contents to GitHub
    const putPayload: any = {
      message: params.commitMessage || `Архівний документ: ${cleanPath}`,
      content: base64Content,
      branch: branch || 'main'
    };

    if (existingSha) {
      putPayload.sha = existingSha;
    }

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putPayload)
      }
    );

    if (!putRes.ok) {
      const errorJson = await putRes.json().catch(() => ({}));
      return {
        success: false,
        error: errorJson.message || `Помилка запису в GitHub: HTTP ${putRes.status}`
      };
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch || 'main'}/${cleanPath}`;
    const htmlUrl = `https://github.com/${owner}/${repo}/blob/${branch || 'main'}/${cleanPath}`;

    return {
      success: true,
      rawUrl,
      htmlUrl,
      path: cleanPath
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Помилка мережі при завантаженні на GitHub: ${err.message || String(err)}`
    };
  }
}

/**
 * Universal URL parser to extract Google Drive, GitHub raw, and direct image links
 */
export function parseDocumentViewerUrl(url: string): {
  type: 'gdrive' | 'github' | 'image' | 'pdf' | 'web';
  displayUrl: string;
  previewUrl: string;
  isEmbeddable: boolean;
} {
  if (!url) {
    return { type: 'web', displayUrl: '', previewUrl: '', isEmbeddable: false };
  }

  const trimmed = url.trim();

  // 1. Google Drive Link
  // Handles: drive.google.com/file/d/FILE_ID/view, drive.google.com/open?id=FILE_ID, etc.
  if (trimmed.includes('drive.google.com')) {
    let fileId = '';
    const matchId = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      fileId = matchId[1];
    } else {
      const matchParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchParam && matchParam[1]) {
        fileId = matchParam[1];
      }
    }

    if (fileId) {
      return {
        type: 'gdrive',
        displayUrl: `https://drive.google.com/uc?export=view&id=${fileId}`,
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        isEmbeddable: true
      };
    }
  }

  // 2. GitHub Link
  // Handles: github.com/owner/repo/blob/branch/path -> raw.githubusercontent.com/owner/repo/branch/path
  if (trimmed.includes('github.com') && trimmed.includes('/blob/')) {
    const rawUrl = trimmed
      .replace('https://github.com/', 'https://raw.githubusercontent.com/')
      .replace('/blob/', '/');
    return {
      type: 'github',
      displayUrl: rawUrl,
      previewUrl: rawUrl,
      isEmbeddable: true
    };
  }

  // 3. Raw GitHub or direct Image
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:image/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.svg') ||
    trimmed.includes('raw.githubusercontent.com')
  ) {
    return {
      type: 'image',
      displayUrl: trimmed,
      previewUrl: trimmed,
      isEmbeddable: true
    };
  }

  // 4. PDF
  if (lower.endsWith('.pdf')) {
    return {
      type: 'pdf',
      displayUrl: trimmed,
      previewUrl: trimmed,
      isEmbeddable: true
    };
  }

  return {
    type: 'web',
    displayUrl: trimmed,
    previewUrl: trimmed,
    isEmbeddable: false
  };
}

/**
 * Upload a text or Markdown file to GitHub
 */
export async function uploadTextToGitHub(params: {
  config?: GitHubStorageConfig;
  path: string;
  textContent: string;
  commitMessage: string;
}): Promise<{
  success: boolean;
  rawUrl?: string;
  htmlUrl?: string;
  path?: string;
  error?: string;
}> {
  // Convert UTF-8 string to base64 safely supporting Cyrillic characters
  const utf8Bytes = new TextEncoder().encode(params.textContent);
  let binary = '';
  const len = utf8Bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64 = btoa(binary);

  return uploadFileToGitHub({
    config: params.config,
    path: params.path,
    fileBase64: base64,
    commitMessage: params.commitMessage
  });
}

/**
 * Save Place Notepad & Dossier to GitHub as Markdown file
 */
export async function savePlaceDossierToGitHub(
  placeName: string,
  dossier: Partial<PlaceDossier> | undefined,
  config?: GitHubStorageConfig
): Promise<{ success: boolean; htmlUrl?: string; path?: string; error?: string }> {
  const safeName = sanitizePathSegment(placeName);
  const path = `archive/places/${safeName}.md`;

  const lines: string[] = [];
  lines.push(`# Блокнот населеного пункту: ${placeName}`);
  lines.push('');
  if (dossier?.settlementType) lines.push(`- **Тип:** ${dossier.settlementType}`);
  if (dossier?.historicalName) lines.push(`- **Історична назва:** ${dossier.historicalName}`);
  if (dossier?.district) lines.push(`- **Повіт / Район / Область:** ${dossier.district}`);
  if (dossier?.parishChurch) lines.push(`- **Церковна парафія:** ${dossier.parishChurch}`);
  if (dossier?.foundedYear) lines.push(`- **Рік заснування:** ${dossier.foundedYear}`);
  lines.push(`- **Дата синхронізації:** ${new Date().toLocaleString('uk-UA')}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Вільні записи та історія села/міста:');
  lines.push('');
  lines.push(dossier?.notes || dossier?.historyText || '(Записів у блокноті ще немає)');
  lines.push('');

  if (dossier?.sourceLinks && dossier.sourceLinks.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Архівні джерела та онлайн-метрики:');
    lines.push('');
    dossier.sourceLinks.forEach((src) => {
      const title = src.title || src.url;
      const desc = src.description ? ` — ${src.description}` : '';
      const arch = src.archive ? ` [${src.archive}]` : '';
      lines.push(`- [${title}](${src.url})${arch}${desc}`);
    });
    lines.push('');
  }

  const textContent = lines.join('\n');
  return uploadTextToGitHub({
    config,
    path,
    textContent,
    commitMessage: `Блокнот населеного пункту: ${placeName}`
  });
}

/**
 * Batch save all places to GitHub
 */
export async function saveAllPlacesToGitHub(
  places: Record<string, PlaceDossier>,
  config?: GitHubStorageConfig
): Promise<{ success: boolean; count: number; error?: string }> {
  const cfg = config || getGitHubConfig();
  if (!cfg.isConfigured) {
    return { success: false, count: 0, error: 'GitHub не налаштовано' };
  }

  const list = Object.values(places || {});
  let successCount = 0;

  for (const p of list) {
    if (!p || !p.placeName) continue;
    const res = await savePlaceDossierToGitHub(p.placeName, p, cfg);
    if (res.success) successCount++;
  }

  return { success: true, count: successCount };
}

/**
 * Save Detective Note to GitHub as Markdown file
 */
export async function saveDetectiveNoteToGitHub(
  note: ResearchNote,
  config?: GitHubStorageConfig
): Promise<{ success: boolean; htmlUrl?: string; path?: string; error?: string }> {
  const safeTitle = sanitizePathSegment(note.title || 'Нотатка');
  const path = `archive/detective_notes/${safeTitle}_${note.id}.md`;

  const lines: string[] = [];
  lines.push(`# ${note.title || 'Детективна розкопка'}`);
  lines.push('');
  lines.push(`- **ID розкопки:** ${note.id}`);
  lines.push(`- **Створено:** ${new Date(note.createdAt).toLocaleString('uk-UA')}`);
  lines.push(`- **Оновлено:** ${new Date(note.updatedAt).toLocaleString('uk-UA')}`);
  if (note.tags && note.tags.length > 0) {
    lines.push(`- **Теги:** ${note.tags.join(', ')}`);
  }
  if (note.color && note.color !== 'default') {
    lines.push(`- **Категорія/Колір:** ${note.color}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  if (note.isChecklist && note.checklistItems && note.checklistItems.length > 0) {
    lines.push('## Чекліст розкопок:');
    lines.push('');
    note.checklistItems.forEach((ci) => {
      lines.push(`- [${ci.isCompleted ? 'x' : ' '}] ${ci.text}`);
    });
    lines.push('');
  }

  if (note.content) {
    lines.push('## Зміст розкопки:');
    lines.push('');
    lines.push(note.content);
    lines.push('');
  }

  if (note.linkUrl) {
    lines.push(`**Посилання на джерело:** [${note.linkUrl}](${note.linkUrl})`);
    lines.push('');
  }

  const textContent = lines.join('\n');
  return uploadTextToGitHub({
    config,
    path,
    textContent,
    commitMessage: `Детективні розкопки: ${note.title || note.id}`
  });
}

/**
 * Batch save all Detective Notes to GitHub
 */
export async function saveAllDetectiveNotesToGitHub(
  notes: ResearchNote[],
  config?: GitHubStorageConfig
): Promise<{ success: boolean; count: number; error?: string }> {
  const cfg = config || getGitHubConfig();
  if (!cfg.isConfigured) {
    return { success: false, count: 0, error: 'GitHub не налаштовано' };
  }

  const activeNotes = notes.filter((n) => !n.isTrash);
  let successCount = 0;

  for (const n of activeNotes) {
    const res = await saveDetectiveNoteToGitHub(n, cfg);
    if (res.success) successCount++;
  }

  return { success: true, count: successCount };
}

