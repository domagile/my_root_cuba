/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitConfig } from '../types';

export async function pushProjectToGithub(
  config: GitConfig,
  projectData: any
): Promise<{ success: boolean; message: string; commitUrl?: string }> {
  try {
    if (!config.token || !config.repoUrl) {
      return {
        success: false,
        message: 'Необхідно вказати URL репозиторію та GitHub Personal Access Token.'
      };
    }

    // Parse repository owner and repo name from URL (e.g. https://github.com/owner/repo or owner/repo)
    let repoPath = config.repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').trim();
    const parts = repoPath.split('/');
    if (parts.length < 2) {
      return {
        success: false,
        message: 'Невірний формат посилання на репозиторій. Очікується: https://github.com/owner/repo'
      };
    }

    const [owner, repo] = parts;
    const branch = config.branch || 'main';
    const filePath = 'genealogy_backup.json';
    const contentStr = JSON.stringify(projectData, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));

    // 1. Get file SHA if already exists
    let sha: string | undefined;
    try {
      const getFileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getFileRes.ok) {
        const fileInfo = await getFileRes.json();
        sha = fileInfo.sha;
      }
    } catch {
      // file might not exist yet
    }

    // 2. Put / update file
    const commitMessage = `Auto backup genealogy project data [${new Date().toLocaleString('uk-UA')}]`;
    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage,
        content: contentBase64,
        branch: branch,
        sha: sha
      })
    });

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      return {
        success: false,
        message: errJson.message || `Помилка GitHub API (${putRes.status}): ${putRes.statusText}`
      };
    }

    const resJson = await putRes.json();
    return {
      success: true,
      message: 'Дані успішно збережено у репозиторій GitHub!',
      commitUrl: resJson.commit?.html_url
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Не вдалося синхронізувати з GitHub.'
    };
  }
}
