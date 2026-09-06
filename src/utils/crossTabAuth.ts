/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthUser } from '../types';

const CHANNEL_NAME = 'genealogy_cross_tab_auth_v1';
const STORAGE_KEY = 'genealogy_auth_security_v1_currentUser';

interface AuthBroadcastMessage {
  type: 'REQUEST_CURRENT_AUTH' | 'SYNC_AUTH_USER' | 'AUTH_LOGOUT';
  user?: AuthUser | null;
  timestamp: number;
}

/**
 * Encodes a user session into a compact, safe base64 token for seamless cross-tab transfer.
 */
export function encodeSessionToken(user: AuthUser): string {
  try {
    const payload = {
      id: user.id,
      email: user.email?.trim().toLowerCase(),
      name: user.name,
      role: user.role,
      isWhitelisted: user.isWhitelisted,
      picture: user.picture,
      loginMethod: user.loginMethod,
      ts: Date.now()
    };
    const jsonStr = JSON.stringify(payload);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.warn('Failed to encode auth session token:', e);
    return '';
  }
}

/**
 * Decodes and validates a session token.
 */
export function decodeSessionToken(token: string): AuthUser | null {
  try {
    if (!token || typeof token !== 'string') return null;
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const data = JSON.parse(jsonStr);

    if (data && data.email && typeof data.email === 'string') {
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (typeof data.ts === 'number' && Date.now() - data.ts < MAX_AGE_MS) {
        return {
          id: data.id || `usr-${Date.now()}`,
          email: data.email.trim().toLowerCase(),
          name: data.name,
          role: data.role || 'viewer',
          isWhitelisted: typeof data.isWhitelisted === 'boolean' ? data.isWhitelisted : true,
          picture: data.picture,
          isAuthenticated: true,
          loginMethod: data.loginMethod || 'google',
          lastActive: new Date().toISOString()
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('Failed to decode auth session token:', e);
    return null;
  }
}

/**
 * Extracts and cleans the session token from the current URL if present.
 */
export function extractSessionTokenFromUrl(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('_auth_t') || url.searchParams.get('_auth_session');
    if (!token) return null;

    const user = decodeSessionToken(token);
    if (user) {
      // Remove token from address bar cleanly without page reload
      url.searchParams.delete('_auth_t');
      url.searchParams.delete('_auth_session');
      const cleanSearch = url.search ? url.search : '';
      window.history.replaceState({}, document.title, `${url.pathname}${cleanSearch}${url.hash}`);
      return user;
    }
  } catch (e) {
    console.warn('Error extracting auth token from URL:', e);
  }
  return null;
}

let activeChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!activeChannel) {
    try {
      activeChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      activeChannel = null;
    }
  }
  return activeChannel;
}

/**
 * Broadcasts an auth login event to all adjacent tabs.
 */
export function broadcastAuthLogin(user: AuthUser): void {
  const ch = getBroadcastChannel();
  if (ch) {
    ch.postMessage({
      type: 'SYNC_AUTH_USER',
      user,
      timestamp: Date.now()
    } as AuthBroadcastMessage);
  }
}

/**
 * Broadcasts an auth logout event to all adjacent tabs.
 */
export function broadcastAuthLogout(): void {
  const ch = getBroadcastChannel();
  if (ch) {
    ch.postMessage({
      type: 'AUTH_LOGOUT',
      timestamp: Date.now()
    } as AuthBroadcastMessage);
  }
}

interface CrossTabSyncOptions {
  getCurrentUser: () => AuthUser | null;
  onUserReceived: (user: AuthUser) => void;
  onLogout: () => void;
}

/**
 * Initializes cross-tab auth state synchronization via BroadcastChannel and Storage Events.
 */
export function initCrossTabAuthSync(options: CrossTabSyncOptions): () => void {
  if (typeof window === 'undefined') return () => {};

  const ch = getBroadcastChannel();

  const handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
    try {
      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'REQUEST_CURRENT_AUTH') {
        const currentUser = options.getCurrentUser();
        if (currentUser && currentUser.isAuthenticated) {
          ch?.postMessage({
            type: 'SYNC_AUTH_USER',
            user: currentUser,
            timestamp: Date.now()
          } as AuthBroadcastMessage);
        }
      } else if (data.type === 'SYNC_AUTH_USER' && data.user && data.user.isAuthenticated) {
        options.onUserReceived(data.user);
      } else if (data.type === 'AUTH_LOGOUT') {
        options.onLogout();
      }
    } catch (err) {
      console.warn('Error handling cross-tab auth message:', err);
    }
  };

  if (ch) {
    ch.addEventListener('message', handleMessage);
    // Request current auth from any already open adjacent tab
    ch.postMessage({
      type: 'REQUEST_CURRENT_AUTH',
      timestamp: Date.now()
    } as AuthBroadcastMessage);
  }

  // Also listen to storage events as a reliable fallback
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      if (e.newValue) {
        try {
          const user: AuthUser = JSON.parse(e.newValue);
          if (user && user.isAuthenticated) {
            options.onUserReceived(user);
          }
        } catch {}
      } else {
        options.onLogout();
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (ch) {
      ch.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
  };
}
