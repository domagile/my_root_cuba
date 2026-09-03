import React, { useState, useEffect } from 'react';
import { Mail, X, HeartHandshake, ExternalLink } from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { useAuthStore } from '../stores/useAuthStore';
import { getThemeConfig } from '../utils/theme';
import { AUTHOR_CONTACT_EMAIL } from './ContactAuthorModal';

interface GuestContactBannerProps {
  onOpenContactModal: () => void;
}

export const GuestContactBanner: React.FC<GuestContactBannerProps> = ({ onOpenContactModal }) => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);
  const currentUser = useAuthStore((s) => s.currentUser);
  const whitelist = useAuthStore((s) => s.whitelist);

  const isWhitelisted = Boolean(
    currentUser?.isAuthenticated &&
    whitelist.some(
      (w) => w.email?.toLowerCase() === currentUser.email?.toLowerCase() &&
             w.status === 'active' &&
             (w.role === 'admin' || w.role === 'editor')
    )
  );

  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('rodovid_guest_banner_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('rodovid_guest_banner_dismissed', 'true');
  };

  // Only show for guests / unregistered visitors who haven't dismissed it in the current session
  if (isWhitelisted || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600/90 via-[#B88E3E] to-amber-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 shadow-sm text-xs z-30 transition-all">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="p-1 rounded-md bg-white/20 shrink-0">
          <HeartHandshake className="w-3.5 h-3.5 text-white" />
        </span>
        <div className="truncate">
          <span className="font-semibold">Шукаєте спільних предків у цьому дереві? </span>
          <span className="hidden md:inline opacity-90">Зв'яжіться з автором для обміну матеріалами: </span>
          <button
            type="button"
            onClick={onOpenContactModal}
            className="underline font-bold hover:text-amber-100 transition-colors cursor-pointer inline-flex items-center gap-1 ml-1"
          >
            <span>{AUTHOR_CONTACT_EMAIL}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenContactModal}
          className="px-2.5 py-1 rounded-md bg-white text-neutral-900 hover:bg-neutral-100 font-bold text-[11px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
          title="Відкрити контакти автора"
        >
          <Mail className="w-3 h-3 text-[#B88E3E]" />
          <span>Написати</span>
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer ml-0.5"
          title="Приховати сповіщення"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
