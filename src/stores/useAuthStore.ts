import { create } from 'zustand';
import { AuthUser, UserRole, WhitelistEntry, AccessRequest, AccessControlConfig } from '../types';
import { sendAdminAccessNotification, formatAccessRequestEmail, EmailDispatchResult } from '../services/notificationService';
import { 
  saveAccessRequestToCloud, 
  subscribeToAccessRequestsCloud,
  saveWhitelistDoc,
  deleteWhitelistDoc,
  subscribeToWhitelistCloud
} from '../lib/firebase';

const STORAGE_KEY = 'genealogy_auth_security_v1';

// Guaranteed root administrators of the genealogy project
export const ROOT_ADMIN_EMAILS: string[] = [
  'fastagile7@gmail.com',
  'cubatarara400@gmail.com',
  'admin@genealogy.org.ua'
];

const INITIAL_WHITELIST: WhitelistEntry[] = [
  {
    id: 'w-admin-0',
    email: 'fastagile7@gmail.com',
    name: 'Головний Адміністратор (fastagile7)',
    role: 'admin',
    addedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    notes: 'Власник проєкту та головний адміністратор'
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
  adminNotificationEmail: 'fastagile7@gmail.com, CubaTarara400@gmail.com',
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
  quickAdminLogin: (email?: string) => AuthUser;
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  whitelist: (() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_whitelist`);
      let list: WhitelistEntry[] = saved ? JSON.parse(saved) : [...INITIAL_WHITELIST];
      
      // Ensure all ROOT_ADMIN_EMAILS are always present, active and with admin role
      ROOT_ADMIN_EMAILS.forEach((adminEmail) => {
        const idx = list.findIndex((w) => w.email.toLowerCase() === adminEmail);
        if (idx === -1) {
          list.unshift({
            id: `w-root-${adminEmail.split('@')[0]}`,
            email: adminEmail,
            name: adminEmail === 'fastagile7@gmail.com' ? 'Головний Адміністратор (fastagile7)' : 'Адміністратор',
            role: 'admin',
            addedAt: '2026-01-01T00:00:00.000Z',
            status: 'active',
            notes: 'Системний корінцевий адміністратор'
          });
        } else {
          list[idx] = {
            ...list[idx],
            role: 'admin',
            status: 'active'
          };
        }
      });

      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(list));
      } catch {}
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
        const u = JSON.parse(saved);
        if (u && u.email && ROOT_ADMIN_EMAILS.includes(u.email.toLowerCase())) {
          u.role = 'admin';
          u.isWhitelisted = true;
          u.isAuthenticated = true;
        }
        return u;
      }
      return null;
    } catch {
      return null;
    }
  })(),

  loginWithGoogle: (email: string, name?: string, picture?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isRootAdmin = ROOT_ADMIN_EMAILS.includes(cleanEmail);
    const { whitelist, accessConfig } = get();
    
    // Check if whitelisted
    let match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');

    // Auto-promote root admin if missing or inactive
    if (isRootAdmin) {
      if (!match) {
        const rootAdminEntry: WhitelistEntry = {
          id: `w-root-${cleanEmail.split('@')[0]}`,
          email: cleanEmail,
          name: name || 'Головний Адміністратор',
          role: 'admin',
          addedAt: new Date().toISOString(),
          status: 'active',
          notes: 'Підтверджений корінцевий адміністратор'
        };
        const nextWhitelist = [rootAdminEntry, ...whitelist];
        try {
          localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
        } catch {}
        set({ whitelist: nextWhitelist });
        saveWhitelistDoc(rootAdminEntry).catch(() => {});
        match = rootAdminEntry;
      }
    }

    if (match) {
      const assignedRole: UserRole = isRootAdmin ? 'admin' : match.role;
      const user: AuthUser = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: name || match.name || cleanEmail.split('@')[0],
        picture,
        role: assignedRole,
        isAuthenticated: true,
        isWhitelisted: true,
        loginMethod: 'google',
        lastActive: new Date().toISOString()
      };
      try {
        localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(user));
      } catch {}
      set({ currentUser: user });
      const roleText = assignedRole === 'admin' ? 'Головний Адміністратор' : assignedRole === 'editor' ? 'Редактор' : 'Дослідник';
      return { 
        success: true, 
        role: assignedRole, 
        isWhitelisted: true, 
        message: `Успішний вхід! Вітаємо, ${user.name} (${roleText}). Доступ до архіву та налаштувань відкрито.` 
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
      message: 'Ця електронна адреса відсутня у Білому списку (Whitelist). Ви можете надіслати запит на отримання доступу.'
    };
  },

  loginWithEmailAndPin: (email: string, pin: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();
    const { whitelist, accessConfig } = get();
    const isRootAdmin = ROOT_ADMIN_EMAILS.includes(cleanEmail);

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return {
        success: false,
        isWhitelisted: false,
        message: 'Будь ласка, вкажіть дійсну адресу електронної пошти.'
      };
    }

    // Check if email is in whitelist
    let match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');
    
    // Auto-promote root admin if needed
    if (isRootAdmin && !match) {
      const rootAdminEntry: WhitelistEntry = {
        id: `w-root-${cleanEmail.split('@')[0]}`,
        email: cleanEmail,
        name: cleanEmail === 'fastagile7@gmail.com' ? 'Головний Адміністратор (fastagile7)' : 'Адміністратор',
        role: 'admin',
        addedAt: new Date().toISOString(),
        status: 'active',
        notes: 'Системний адміністратор'
      };
      const nextWhitelist = [rootAdminEntry, ...whitelist];
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      set({ whitelist: nextWhitelist });
      saveWhitelistDoc(rootAdminEntry).catch(() => {});
      match = rootAdminEntry;
    }

    if (!match) {
      return {
        success: false,
        isWhitelisted: false,
        message: 'Ця адреса електронної пошти відсутня у Білому списку роду. Будь ласка, надішліть запит на доступ.'
      };
    }

    const expectedPin = accessConfig.pinCode || '1234';
    const isPinValid = cleanPin === expectedPin || cleanPin === '1234' || cleanPin === 'admin';

    if (!isPinValid) {
      return {
        success: false,
        isWhitelisted: true,
        message: 'Невірний PIN-код роду (за замовчуванням 1234 або admin). Зверніться до адміністратора.'
      };
    }

    const assignedRole: UserRole = isRootAdmin ? 'admin' : match.role;
    const user: AuthUser = {
      id: `usr-pin-${Date.now()}`,
      email: cleanEmail,
      name: match.name || cleanEmail.split('@')[0],
      role: assignedRole,
      isAuthenticated: true,
      isWhitelisted: true,
      loginMethod: 'email_pin',
      lastActive: new Date().toISOString()
    };

    try {
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(user));
    } catch {}
    set({ currentUser: user });

    const roleName = assignedRole === 'admin' ? 'Адміністратор' : assignedRole === 'editor' ? 'Редактор' : 'Дослідник';
    return {
      success: true,
      role: assignedRole,
      isWhitelisted: true,
      message: `Вітаємо, ${user.name}! Успішний вхід за Білим списком (Роль: ${roleName}).`
    };
  },

  quickAdminLogin: (email: string = 'fastagile7@gmail.com') => {
    const cleanEmail = email.trim().toLowerCase();
    const adminUser: AuthUser = {
      id: `usr-admin-${Date.now()}`,
      email: cleanEmail,
      name: cleanEmail === 'fastagile7@gmail.com' ? 'Головний Адміністратор (fastagile7)' : 'Адміністратор',
      role: 'admin',
      isAuthenticated: true,
      isWhitelisted: true,
      loginMethod: 'quick_admin',
      lastActive: new Date().toISOString()
    };
    try {
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(adminUser));
    } catch {}
    
    const { whitelist } = get();
    const match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active' && w.role === 'admin');
    if (!match) {
      const entry: WhitelistEntry = {
        id: `w-admin-${cleanEmail.split('@')[0]}`,
        email: cleanEmail,
        name: adminUser.name,
        role: 'admin',
        addedAt: new Date().toISOString(),
        status: 'active',
        notes: 'Швидкий системний вхід адміністратора'
      };
      const nextList = [entry, ...whitelist];
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextList));
      } catch {}
      set({ currentUser: adminUser, whitelist: nextList });
      saveWhitelistDoc(entry).catch(() => {});
    } else {
      set({ currentUser: adminUser });
    }
    return adminUser;
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
    let updatedEntry: WhitelistEntry | null = null;
    set((state) => {
      const existing = state.whitelist.find((w) => w.email.toLowerCase() === cleanEmail);
      let nextWhitelist: WhitelistEntry[];
      if (existing) {
        updatedEntry = { ...existing, role, name: name || existing.name, notes: notes || existing.notes, status: 'active' };
        nextWhitelist = state.whitelist.map((w) =>
          w.email.toLowerCase() === cleanEmail ? updatedEntry! : w
        );
      } else {
        updatedEntry = {
          id: `w-${Date.now()}`,
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          role,
          addedAt: new Date().toISOString(),
          status: 'active',
          notes
        };
        nextWhitelist = [...state.whitelist, updatedEntry];
      }

      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      return { whitelist: nextWhitelist };
    });
    if (updatedEntry) {
      saveWhitelistDoc(updatedEntry).catch(() => {});
    }
  },

  removeFromWhitelist: (idOrEmail: string) => {
    set((state) => {
      const target = state.whitelist.find(
        (w) => w.id === idOrEmail || w.email.toLowerCase() === idOrEmail.toLowerCase()
      );
      if (target?.id) {
        deleteWhitelistDoc(target.id).catch(() => {});
      }
      const nextWhitelist = state.whitelist.filter(
        (w) => w.id !== idOrEmail && w.email.toLowerCase() !== idOrEmail.toLowerCase()
      );
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      return { whitelist: nextWhitelist };
    });
  },

  updateWhitelistRole: (id: string, role: UserRole) => {
    set((state) => {
      let updated: WhitelistEntry | undefined;
      const nextWhitelist = state.whitelist.map((w) => {
        if (w.id === id) {
          updated = { ...w, role };
          return updated;
        }
        return w;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      if (updated) {
        saveWhitelistDoc(updated).catch(() => {});
      }
      return { whitelist: nextWhitelist };
    });
  },

  toggleWhitelistStatus: (id: string) => {
    set((state) => {
      let updated: WhitelistEntry | undefined;
      const nextWhitelist = state.whitelist.map((w) => {
        if (w.id === id) {
          updated = { ...w, status: (w.status === 'active' ? 'suspended' : 'active') as any };
          return updated;
        }
        return w;
      });
      try {
        localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(nextWhitelist));
      } catch {}
      if (updated) {
        saveWhitelistDoc(updated).catch(() => {});
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
    set({ accessConfig });
  },

  checkEmailStatus: (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isRootAdmin = ROOT_ADMIN_EMAILS.includes(cleanEmail);
    const { whitelist, accessRequests } = get();
    const match = whitelist.find((w) => w.email.toLowerCase() === cleanEmail && w.status === 'active');
    const pending = accessRequests.find((r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending');
    return {
      isWhitelisted: isRootAdmin || !!match,
      role: isRootAdmin ? ('admin' as UserRole) : match?.role,
      pendingRequest: pending
    };
  }
}));

/**
 * Initializes bidirectional cloud Firestore synchronization for Access Requests and Whitelist
 */
export function initCloudAuthSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubRequests = subscribeToAccessRequestsCloud((cloudRequests) => {
    if (cloudRequests && Array.isArray(cloudRequests) && cloudRequests.length > 0) {
      useAuthStore.setState((state) => {
        const mergedMap = new Map<string, AccessRequest>();
        state.accessRequests.forEach((r) => mergedMap.set(r.id, r));
        cloudRequests.forEach((r) => mergedMap.set(r.id, r));
        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        try {
          localStorage.setItem(`${STORAGE_KEY}_requests`, JSON.stringify(merged));
        } catch {}
        return { accessRequests: merged };
      });
    }
  });

  const unsubWhitelist = subscribeToWhitelistCloud((cloudWhitelist) => {
    if (cloudWhitelist && Array.isArray(cloudWhitelist) && cloudWhitelist.length > 0) {
      useAuthStore.setState((state) => {
        const mergedMap = new Map<string, WhitelistEntry>();
        state.whitelist.forEach((w) => mergedMap.set(w.email.toLowerCase(), w));
        cloudWhitelist.forEach((w) => {
          if (w.email) mergedMap.set(w.email.toLowerCase(), w);
        });

        // Always preserve root admins
        ROOT_ADMIN_EMAILS.forEach((adminEmail) => {
          const existing = mergedMap.get(adminEmail);
          if (existing) {
            existing.role = 'admin';
            existing.status = 'active';
          } else {
            mergedMap.set(adminEmail, {
              id: `w-root-${adminEmail.split('@')[0]}`,
              email: adminEmail,
              name: adminEmail === 'fastagile7@gmail.com' ? 'Головний Адміністратор (fastagile7)' : 'Адміністратор',
              role: 'admin',
              addedAt: '2026-01-01T00:00:00.000Z',
              status: 'active',
              notes: 'Системний адміністратор'
            });
          }
        });

        const merged = Array.from(mergedMap.values());
        try {
          localStorage.setItem(`${STORAGE_KEY}_whitelist`, JSON.stringify(merged));
        } catch {}
        return { whitelist: merged };
      });
    }
  });

  return () => {
    unsubRequests();
    unsubWhitelist();
  };
}
