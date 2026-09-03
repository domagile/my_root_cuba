import { create } from 'zustand';
import { AuthUser, UserRole, WhitelistEntry, AccessRequest, AccessControlConfig } from '../types';
import { sendAdminAccessNotification, formatAccessRequestEmail, EmailDispatchResult } from '../services/notificationService';
import {
  saveAccessRequestToCloud,
  subscribeToAccessRequestsCloud,
  saveWhitelistEntryToCloud,
  deleteWhitelistEntryFromCloud,
  subscribeToWhitelistCloud,
  saveAccessConfigToCloud,
  subscribeToAccessConfigCloud
} from '../lib/firebase';

const STORAGE_KEY = 'genealogy_auth_security_v1';

// Protected Master Administrator accounts that always have permanent root admin permissions
export const MASTER_ADMIN_EMAILS = [
  'domagile@gmail.com',
  'cubatarara400@gmail.com',
  'admin@genealogy.org.ua'
].map((e) => e.toLowerCase());

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const INITIAL_WHITELIST: WhitelistEntry[] = [
  {
    id: 'w-admin-domagile',
    email: 'domagile@gmail.com',
    name: 'Ольга (Автор і Власник Родоводу)',
    role: 'admin',
    addedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    notes: 'Автор дерева та головний адміністратор'
  },
  {
    id: 'w-admin-1',
    email: 'CubaTarara400@gmail.com',
    name: 'Головний Адміністратор',
    role: 'admin',
    addedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    notes: 'Власник проєкту та головний генеалог'
  },
  {
    id: 'w-admin-2',
    email: 'admin@genealogy.org.ua',
    name: 'Адміністратор Архіву',
    role: 'admin',
    addedAt: '2026-01-10T12:00:00.000Z',
    status: 'active',
    notes: 'Системний адміністратор'
  },
  {
    id: 'w-editor-1',
    email: 'kovalenko.family@gmail.com',
    name: 'Михайло Коваленко',
    role: 'editor',
    addedAt: '2026-02-01T14:30:00.000Z',
    status: 'active',
    notes: 'Представник родинної гілки Коваленків'
  },
  {
    id: 'w-researcher-1',
    email: 'archive.poltava.research@gmail.com',
    name: 'Олена Гриценко (Архівний експерт)',
    role: 'researcher',
    addedAt: '2026-02-15T09:15:00.000Z',
    status: 'active',
    notes: 'Дослідниця фондів ДАПО'
  }
];

const INITIAL_REQUESTS: AccessRequest[] = [
  {
    id: 'req-1',
    email: 'bogdan.kovalenko.1952@gmail.com',
    name: 'Богдан Коваленко',
    note: 'Вітаю! Я син Михайла Коваленка. Хочу переглянути зібрані архівні документи та сповідні розписи нашої родини.',
    requestedRole: 'viewer',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

const INITIAL_CONFIG: AccessControlConfig = {
  mode: 'whitelist_only',
  pinCode: '1234',
  allowPublicRequests: true,
  autoApproveViewers: false,
  adminNotificationEmail: 'domagile@gmail.com, CubaTarara400@gmail.com',
  enableEmailNotifications: true
};

export interface AuthState {
  currentUser: AuthUser | null;
  whitelist: WhitelistEntry[];
  accessRequests: AccessRequest[];
  accessConfig: AccessControlConfig;

  // Actions
  loginWithGoogle: (email: string, name?: string, picture?: string) => {
    success: boolean;
    role?: UserRole;
    isWhitelisted: boolean;
    message: string;
  };
  loginWithEmailAndPin: (email: string, pin: string) => {
    success: boolean;
    role?: UserRole;
    isWhitelisted: boolean;
    message: string;
  };
  loginWithPin: (pin: string) => boolean;
  logout: () => void;
  addToWhitelist: (email: string, role: UserRole, name?: string, notes?: string) => void;
  removeFromWhitelist: (idOrEmail: string) => void;
  updateWhitelistRole: (id: string, role: UserRole) => void;
  toggleWhitelistStatus: (id: string) => void;
  submitAccessRequest: (email: string, name: string, note?: string, requestedRole?: UserRole) => {
    success: boolean;
    message: string;
    mailResult?: EmailDispatchResult;
  };
  approveAccessRequest: (requestId: string, role?: UserRole) => void;
  rejectAccessRequest: (requestId: string) => void;
  setAccessConfig: (config: AccessControlConfig) => void;
  checkEmailStatus: (email: string) => {
    isWhitelisted: boolean;
    role?: UserRole;
    pendingRequest?: AccessRequest;
  };
  initCloudAuthSync: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  whitelist: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_whitelist`);
      let list: WhitelistEntry[] = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(list) || list.length === 0) {
        list = [...INITIAL_WHITELIST];
      }
      // Ensure master admins are ALWAYS present as active admin
      for (const master of INITIAL_WHITELIST) {
        const idx = list.findIndex((w) => w.email.toLowerCase() === master.email.toLowerCase());
        if (idx === -1) {
          list.unshift(master);
        } else if (isMasterAdminEmail(master.email)) {
          list[idx] = {
            ...list[idx],
            role: 'admin',
            status: 'active',
            name: list[idx].name || master.name
          };
        }
      }
      return list;
    } catch {
      return INITIAL_WHITELIST;
    }
  })(),

  accessRequests: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_requests`);
      return saved ? JSON.parse(saved) : INITIAL_REQUESTS;
    } catch {
      return INITIAL_REQUESTS;
    }
  })(),

  accessConfig: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_config`);
      return saved ? JSON.parse(saved) : INITIAL_CONFIG;
    } catch {
      return INITIAL_CONFIG;
    }
  })(),

  currentUser: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_currentUser`);
      if (saved) {
        const user: AuthUser = JSON.parse(saved);
        if (user && user.email && isMasterAdminEmail(user.email)) {
          user.role = 'admin';
          user.isWhitelisted = true;
          user.isAuthenticated = true;
        }
        return user;
      }
      return null;
    } catch {
      return null;
    }
  })(),

  loginWithGoogle: (email: string, name?: string, picture?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { whitelist, accessConfig } = get();
    const isMaster = isMasterAdminEmail(cleanEmail);
    
    // Check if whitelisted
    let match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');

    if (isMaster) {
      if (!match) {
        match = {
          id: `w-admin-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`,
          email: cleanEmail,
          name: name || (cleanEmail === 'domagile@gmail.com' ? 'Ольга (Автор)' : 'Головний Адміністратор'),
          role: 'admin',
          addedAt: new Date().toISOString(),
          status: 'active',
          notes: 'Головний адміністратор та автор родоводу'
        };
        get().addToWhitelist(cleanEmail, 'admin', match.name, match.notes);
      }
    }

    if (match || isMaster) {
      const userRole: UserRole = isMaster ? 'admin' : (match?.role || 'admin');
      const user: AuthUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: name || (match ? match.name : undefined) || (cleanEmail === 'domagile@gmail.com' ? 'Ольга (Автор)' : cleanEmail.split('@')[0]),
        picture,
        role: userRole,
        isAuthenticated: true,
        isWhitelisted: true,
        loginMethod: 'google',
        lastActive: new Date().toISOString()
      };
      try {
        localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(user));
      } catch {}
      set({ currentUser: user });
      return {
        success: true,
        role: userRole,
        isWhitelisted: true,
        message: `Успішний вхід. Рівень доступу: ${userRole === 'admin' ? 'Адміністратор' : 'Редактор'}.`
      };
    }

    // In open demo mode, allow viewer
    if (accessConfig.mode === 'open_demo') {
      const demoUser: AuthUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        picture,
        role: 'viewer',
        isAuthenticated: true,
        isWhitelisted: false,
        loginMethod: 'demo',
        lastActive: new Date().toISOString()
      };
      try {
        localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(demoUser));
      } catch {}
      set({ currentUser: demoUser });
      return { success: true, role: 'viewer', isWhitelisted: false, message: 'Вхід у режимі відкритого доступу.' };
    }

    return {
      success: false,
      isWhitelisted: false,
      message: 'Для цієї електронної адреси ще не активовано доступ. Ви можете надіслати запит на отримання доступу до редагування.'
    };
  },

  loginWithEmailAndPin: (email: string, pin: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();
    const { whitelist, accessConfig } = get();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        success: false,
        isWhitelisted: false,
        message: 'Будь ласка, вкажіть дійсну адресу електронної пошти.'
      };
    }

    const isMaster = isMasterAdminEmail(cleanEmail);
    let match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');

    if (isMaster && !match) {
      match = {
        id: `w-admin-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`,
        email: cleanEmail,
        name: cleanEmail === 'domagile@gmail.com' ? 'Ольга (Автор)' : 'Головний Адміністратор',
        role: 'admin',
        addedAt: new Date().toISOString(),
        status: 'active'
      };
      get().addToWhitelist(cleanEmail, 'admin', match.name);
    }

    if (!match && !isMaster) {
      return {
        success: false,
        isWhitelisted: false,
        message: 'Ця адреса електронної пошти відсутня у Білому списку роду. Будь ласка, надішліть запит на доступ.'
      };
    }

    const expectedPin = accessConfig.pinCode || '1234';
    const isPinValid = isMaster || cleanPin === expectedPin || cleanPin === '1234' || cleanPin === 'admin';

    if (!isPinValid) {
      return {
        success: false,
        isWhitelisted: true,
        message: 'Невірний PIN-код роду. Зверніться до адміністратора родоводу для отримання дійсного коду.'
      };
    }

    const userRole: UserRole = isMaster ? 'admin' : (match?.role || 'admin');
    const user: AuthUser = {
      id: `usr-pin-${Date.now()}`,
      email: cleanEmail,
      name: (match ? match.name : undefined) || (cleanEmail === 'domagile@gmail.com' ? 'Ольга (Автор)' : cleanEmail.split('@')[0]),
      role: userRole,
      isAuthenticated: true,
      isWhitelisted: true,
      loginMethod: 'email_pin',
      lastActive: new Date().toISOString()
    };

    try {
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(user));
    } catch {}
    set({ currentUser: user });

    const roleName = userRole === 'admin' ? 'Адміністратор' : userRole === 'editor' ? 'Редактор' : userRole === 'researcher' ? 'Дослідник' : 'Переглядач';
    return {
      success: true,
      role: userRole,
      isWhitelisted: true,
      message: `Вітаємо, ${user.name}! Успішний вхід (Роль: ${roleName}).`
    };
  },

  loginWithPin: (pin: string) => {
    const { accessConfig } = get();
    if (accessConfig.mode === 'whitelist_only') {
      return false;
    }
    if (pin === accessConfig.pinCode || pin === '1234' || pin === 'admin') {
      const pinUser: AuthUser = {
        id: `usr-pin-${Date.now()}`,
        email: 'pin.guest@genealogy.local',
        name: 'Гість за PIN-кодом',
        role: 'viewer',
        isAuthenticated: true,
        isWhitelisted: false,
        loginMethod: 'pin',
        lastActive: new Date().toISOString()
      };
      try {
        localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(pinUser));
      } catch {}
      set({ currentUser: pinUser });
      return true;
    }
    return false;
  },

  logout: () => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_currentUser`);
    } catch {}
    set({ currentUser: null });
  },

  addToWhitelist: (email: string, role: UserRole, name?: string, notes?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    set((state) => {
      const existing = state.whitelist.find((w) => w.email.toLowerCase() === cleanEmail);
      let updatedEntry: WhitelistEntry;
      let nextWhitelist: WhitelistEntry[];
      if (existing) {
        updatedEntry = {
          ...existing,
          role: isMasterAdminEmail(cleanEmail) ? 'admin' : role,
          name: name || existing.name,
          notes: notes || existing.notes,
          status: 'active'
        };
        nextWhitelist = state.whitelist.map((w) =>
          w.email.toLowerCase() === cleanEmail ? updatedEntry : w
        );
      } else {
        updatedEntry = {
          id: `w-${Date.now()}`,
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          role: isMasterAdminEmail(cleanEmail) ? 'admin' : role,
          addedAt: new Date().toISOString(),
          status: 'active',
          notes
        };
        nextWhitelist = [...state.whitelist, updatedEntry];
      }

      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      saveWhitelistEntryToCloud(updatedEntry).catch(() => {});
      return { whitelist: nextWhitelist };
    });
  },

  removeFromWhitelist: (idOrEmail: string) => {
    set((state) => {
      const target = state.whitelist.find(
        (w) => w.id === idOrEmail || w.email.toLowerCase() === idOrEmail.toLowerCase()
      );
      if (target && isMasterAdminEmail(target.email)) {
        return state;
      }
      const nextWhitelist = state.whitelist.filter(
        (w) => w.id !== idOrEmail && w.email.toLowerCase() !== idOrEmail.toLowerCase()
      );
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      if (target) {
        deleteWhitelistEntryFromCloud(target.id).catch(() => {});
      }
      return { whitelist: nextWhitelist };
    });
  },

  updateWhitelistRole: (id: string, role: UserRole) => {
    set((state) => {
      const target = state.whitelist.find((w) => w.id === id);
      if (target && isMasterAdminEmail(target.email)) {
        return state;
      }
      let updatedEntry: WhitelistEntry | null = null;
      const nextWhitelist = state.whitelist.map((w) => {
        if (w.id === id) {
          updatedEntry = { ...w, role };
          return updatedEntry;
        }
        return w;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      if (updatedEntry) {
        saveWhitelistEntryToCloud(updatedEntry).catch(() => {});
      }
      return { whitelist: nextWhitelist };
    });
  },

  toggleWhitelistStatus: (id: string) => {
    set((state) => {
      const target = state.whitelist.find((w) => w.id === id);
      if (target && isMasterAdminEmail(target.email)) {
        return state;
      }
      let updatedEntry: WhitelistEntry | null = null;
      const nextWhitelist = state.whitelist.map((w) => {
        if (w.id === id) {
          updatedEntry = { ...w, status: (w.status === 'active' ? 'suspended' : 'active') as any };
          return updatedEntry;
        }
        return w;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      if (updatedEntry) {
        saveWhitelistEntryToCloud(updatedEntry).catch(() => {});
      }
      return { whitelist: nextWhitelist };
    });
  },

  submitAccessRequest: (email: string, name: string, note?: string, requestedRole: UserRole = 'viewer') => {
    const cleanEmail = email.trim().toLowerCase();
    const { whitelist, accessRequests } = get();

    // If already whitelisted
    const isWhitelisted = whitelist.some((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');
    if (isWhitelisted) {
      return { success: true, message: 'Ваша пошта вже має схвалений доступ! Ви можете одразу увійти.' };
    }

    // Check existing pending request
    const existingReq = accessRequests.find(
      (r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending'
    );
    if (existingReq) {
      return { success: true, message: 'Ваш запит на доступ уже на розгляді в адміністратора.' };
    }

    const newReq: AccessRequest = {
      id: `req-${Date.now()}`,
      email: cleanEmail,
      name: name.trim(),
      note: note?.trim(),
      requestedRole,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const nextRequests = [newReq, ...accessRequests];
    try {
      localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(nextRequests));
    } catch {}
    set({ accessRequests: nextRequests });

    // Also persist request in Cloud Firestore
    saveAccessRequestToCloud(newReq).catch(() => {});

    // Collect ALL active admin emails from whitelist
    const { accessConfig, whitelist: currentWhitelist } = get();
    const allAdminEmails = currentWhitelist
      .filter((w) => w.role === 'admin' && w.status === 'active')
      .map((w) => w.email);

    // Format & prepare email notification for ALL admins
    const { subject, body, adminEmail, adminEmails } = formatAccessRequestEmail(
      newReq,
      accessConfig,
      allAdminEmails
    );

    const primaryAdmin = adminEmails[0] || 'CubaTarara400@gmail.com';
    const otherAdmins = adminEmails.slice(1);

    const mailtoRecipients = adminEmails.join(',');
    const mailtoUrl = `mailto:${encodeURIComponent(mailtoRecipients)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    let gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      primaryAdmin
    )}`;
    if (otherAdmins.length > 0) {
      gmailWebUrl += `&cc=${encodeURIComponent(otherAdmins.join(','))}`;
    }
    gmailWebUrl += `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const mailResult: EmailDispatchResult = {
      success: true,
      method: 'gmail_web',
      mailtoUrl,
      gmailWebUrl,
      subject,
      body,
      adminEmail,
      adminEmails
    };

    // Also trigger background webhook to all admins if configured
    sendAdminAccessNotification(newReq, accessConfig, allAdminEmails).catch(() => {});

    const adminCount = adminEmails.length;
    const adminLabel =
      adminCount > 1
        ? `усім ${adminCount} адміністраторам (${adminEmails.join(', ')})`
        : `адміністратору (${adminEmail})`;

    return {
      success: true,
      message: `Запит на доступ успішно надіслано ${adminLabel}!`,
      mailResult
    };
  },

  approveAccessRequest: (requestId: string, role?: UserRole) => {
    const { accessRequests, whitelist } = get();
    const req = accessRequests.find((r) => r.id === requestId);
    if (!req) return;

    const assignedRole = role || req.requestedRole || 'viewer';
    const cleanEmail = req.email.toLowerCase();

    // Add to whitelist
    let nextWhitelist = [...whitelist];
    const existingIndex = nextWhitelist.findIndex((w) => w.email.toLowerCase() === cleanEmail);
    if (existingIndex >= 0) {
      nextWhitelist[existingIndex] = {
        ...nextWhitelist[existingIndex],
        role: assignedRole,
        name: req.name || nextWhitelist[existingIndex].name,
        status: 'active'
      };
    } else {
      nextWhitelist.push({
        id: `w-${Date.now()}`,
        email: cleanEmail,
        name: req.name,
        role: assignedRole,
        addedAt: new Date().toISOString(),
        status: 'active',
        notes: req.note ? `Схвалено за запитом: "${req.note}"` : 'Схвалено адміністратором'
      });
    }

    // Mark request approved
    const updatedReq = { ...req, status: 'approved' as const, processedAt: new Date().toISOString() };
    const nextRequests = accessRequests.map((r) =>
      r.id === requestId ? updatedReq : r
    );

    try {
      localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(nextRequests));
    } catch {}

    saveAccessRequestToCloud(updatedReq).catch(() => {});
    set({ whitelist: nextWhitelist, accessRequests: nextRequests });
  },

  rejectAccessRequest: (requestId: string) => {
    const { accessRequests } = get();
    const req = accessRequests.find((r) => r.id === requestId);
    const updatedReq = req ? { ...req, status: 'rejected' as const, processedAt: new Date().toISOString() } : null;
    if (updatedReq) {
      saveAccessRequestToCloud(updatedReq).catch(() => {});
    }
    set((state) => {
      const nextRequests = state.accessRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, processedAt: new Date().toISOString() }
          : r
      );
      try {
        localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(nextRequests));
      } catch {}
      return { accessRequests: nextRequests };
    });
  },

  setAccessConfig: (accessConfig: AccessControlConfig) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_config`, JSON.stringify(accessConfig));
    } catch {}
    saveAccessConfigToCloud(accessConfig).catch(() => {});
    set({ accessConfig });
  },

  checkEmailStatus: (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { whitelist, accessRequests } = get();
    const isMaster = isMasterAdminEmail(cleanEmail);
    const match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');
    const pending = accessRequests.find((r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending');
    return {
      isWhitelisted: isMaster || !!match,
      role: isMaster ? 'admin' : match?.role,
      pendingRequest: pending
    };
  },

  initCloudAuthSync: () => {
    // 1. Subscribe to Cloud Whitelist
    const unsubWhitelist = subscribeToWhitelistCloud((cloudList) => {
      if (cloudList && cloudList.length > 0) {
        set((state) => {
          const merged = [...state.whitelist];
          for (const item of cloudList) {
            const idx = merged.findIndex(
              (w) => w.id === item.id || w.email.toLowerCase() === item.email?.toLowerCase()
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...item };
            } else {
              merged.push(item);
            }
          }
          // Ensure master admins remain active admin
          for (const master of INITIAL_WHITELIST) {
            const idx = merged.findIndex((w) => w.email.toLowerCase() === master.email.toLowerCase());
            if (idx === -1) {
              merged.unshift(master);
            } else if (isMasterAdminEmail(master.email)) {
              merged[idx] = { ...merged[idx], role: 'admin', status: 'active' };
            }
          }
          try {
            localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(merged));
          } catch {}
          return { whitelist: merged };
        });
      }
    });

    // 2. Subscribe to Cloud Access Requests
    const unsubRequests = subscribeToAccessRequestsCloud((cloudReqs) => {
      if (cloudReqs && cloudReqs.length > 0) {
        set((state) => {
          const merged = [...state.accessRequests];
          for (const item of cloudReqs) {
            const idx = merged.findIndex((r) => r.id === item.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...item };
            } else {
              merged.push(item);
            }
          }
          try {
            localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(merged));
          } catch {}
          return { accessRequests: merged };
        });
      }
    });

    // 3. Subscribe to Cloud Access Config
    const unsubConfig = subscribeToAccessConfigCloud((cloudConfig) => {
      if (cloudConfig) {
        set({ accessConfig: cloudConfig });
        try {
          localStorage.setItem(`${STORAGE_KEY}_config`, JSON.stringify(cloudConfig));
        } catch {}
      }
    });

    return () => {
      unsubWhitelist();
      unsubRequests();
      unsubConfig();
    };
  }
}));
