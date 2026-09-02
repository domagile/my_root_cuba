import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Send,
  Users,
  Eye,
  KeyRound,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import { useAuthStore, ROOT_ADMIN_EMAILS } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import { getThemeConfig } from '../utils/theme';
import { UserRole } from '../types';
import { signInWithGoogle } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFeatureName?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  targetFeatureName
}) => {
  const themePalette = useUIStore((s) => s.themePalette);
  const openContactModal = useUIStore((s) => s.openContactModal);
  const theme = getThemeConfig(themePalette);

  const {
    loginWithGoogle,
    loginWithEmailAndPin,
    quickAdminLogin,
    submitAccessRequest,
    whitelist,
    currentUser,
    logout
  } = useAuthStore();

  const [tab, setTab] = useState<'google' | 'email_pin' | 'request'>('google');
  
  // Whitelist Checker state
  const [emailInput, setEmailInput] = useState('fastagile7@gmail.com');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Email & PIN state
  const [pinEmail, setPinEmail] = useState('fastagile7@gmail.com');
  const [pinCode, setPinCode] = useState('1234');
  const [isPinLoading, setIsPinLoading] = useState(false);

  // Request Access State
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqRole, setReqRole] = useState<UserRole>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Firebase Google Popup Loading
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const handleFirebaseGoogle = async () => {
    setIsGoogleLoading(true);
    setFeedback(null);
    try {
      const { user, error } = await signInWithGoogle();
      if (user && user.email) {
        const res = loginWithGoogle(user.email, user.displayName || undefined, user.photoURL || undefined);
        if (res.success) {
          setFeedback({ type: 'success', message: res.message || `Вітаємо, ${user.displayName || user.email}! Доступ підтверджено.` });
          setTimeout(() => {
            onClose();
          }, 800);
        } else {
          setFeedback({ 
            type: 'error', 
            message: res.message || `Пошта ${user.email} не знайдена у Білому списку (Whitelist).` 
          });
          setReqEmail(user.email);
          if (user.displayName) setReqName(user.displayName);
          setTab('request');
        }
      } else if (error) {
        setFeedback({ 
          type: 'error', 
          message: `${error}. Якщо спливаюче вікно блокується браузером, скористайтеся вкладкою «Вхід за Email та PIN» або швидким входом адміністратора нижче.` 
        });
      }
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: err?.message || 'Помилка авторизації Google. Скористайтеся входом за Email/PIN.' 
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPinLoading(true);
    setFeedback(null);
    try {
      const res = loginWithEmailAndPin(pinEmail, pinCode);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Помилка авторизації' });
    } finally {
      setIsPinLoading(false);
    }
  };

  const handleQuickAdminLogin = (email: string = 'fastagile7@gmail.com') => {
    setFeedback(null);
    const user = quickAdminLogin(email);
    setFeedback({
      type: 'success',
      message: `Успішний вхід як Головний Адміністратор (${user.email})! Повний доступ до родоводу та налаштувань активовано.`
    });
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleCheckEmailInWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    const target = emailInput.trim().toLowerCase();
    if (!target || !target.includes('@')) {
      setFeedback({ type: 'error', message: 'Введіть коректну адресу електронної пошти.' });
      return;
    }

    const isRoot = ROOT_ADMIN_EMAILS.includes(target);
    const { whitelist } = useAuthStore.getState();
    const entry = whitelist.find((w) => w.email.toLowerCase() === target && w.status === 'active');

    if (isRoot || entry) {
      const roleTitle = isRoot ? 'Головний Адміністратор' : entry?.role === 'admin' ? 'Адміністратор' : entry?.role === 'editor' ? 'Редактор' : 'Дослідник';
      setFeedback({
        type: 'success',
        message: `✓ Адресу ${target} підтверджено у Білому списку (Роль: ${roleTitle}). Ви можете увійти через Google або за PIN-кодом (1234).`
      });
      setPinEmail(target);
    } else {
      setFeedback({
        type: 'error',
        message: `Адреси ${target} немає в активному Білому списку. Заповніть форму запиту, щоб адміністратор надав вам доступ.`
      });
      setReqEmail(target);
      setTab('request');
    }
  };

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqEmail.trim() || !reqEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Вкажіть дійсну адресу електронної пошти.' });
      return;
    }
    if (!reqName.trim()) {
      setFeedback({ type: 'error', message: "Будь ласка, вкажіть ваше ім'я або родинну лінію." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = submitAccessRequest(reqEmail, reqName, reqNote, reqRole);
      if (res.success) {
        setRequestSent(true);
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Не вдалося надіслати запит.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className={`w-full max-w-lg ${theme.cardBg} border ${theme.cardBorder} rounded-2xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]`}>
        
        {/* Header */}
        <div className={`p-5 ${theme.surfaceBg} border-b ${theme.borderSubtle} flex items-center justify-between gap-3 shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme.cardTitle}`}>
                {currentUser?.isAuthenticated ? 'Обліковий запис дослідника' : 'Вхід та доступ до родоводу'}
              </h3>
              <p className="text-xs opacity-75">
                {targetFeatureName
                  ? `Розділ «${targetFeatureName}» доступний авторизованим дослідникам`
                  : 'Керування доступом та правами редагування родовідного архіву'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white ${theme.cardBgHover} transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Session Info (if already logged in) */}
        {currentUser?.isAuthenticated && (
          <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Ви увійшли як: </span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">{currentUser.email}</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase">
                  {currentUser.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                setFeedback({ type: 'info', message: 'Ви вийшли з облікового запису.' });
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Вийти
            </button>
          </div>
        )}

        {/* Public Notice Banner */}
        <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Публічний режим:</strong> Дерево відкрите для читання усім.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              openContactModal();
            }}
            className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 hover:underline shrink-0 cursor-pointer"
            title="Шукаєте спільних предків? Напишіть автору"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Шукаєте предків? domagile@gmail.com</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-black/5 dark:border-white/10 px-5 pt-3 gap-3 shrink-0 overflow-x-auto">
          <button
            onClick={() => {
              setTab('google');
              setFeedback(null);
            }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'google'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <span>Google Вхід</span>
          </button>
          <button
            onClick={() => {
              setTab('email_pin');
              setFeedback(null);
            }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'email_pin'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Email + PIN / Пароль</span>
          </button>
          <button
            onClick={() => {
              setTab('request');
              setFeedback(null);
            }}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              tab === 'request'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            Подати запит на доступ
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                  : 'bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Quick Admin Access Box */}
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Швидкий вхід адміністратора
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono">
                fastagile7@gmail.com
              </span>
            </div>
            <p className="text-[11px] opacity-80 leading-relaxed">
              Якщо ви власник або адміністратор цього архіву, натисніть для миттєвого входу з повними правами:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleQuickAdminLogin('fastagile7@gmail.com')}
                className="flex-1 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Увійти як fastagile7@gmail.com</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdminLogin('CubaTarara400@gmail.com')}
                className="py-2 px-3 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-semibold transition-all cursor-pointer"
                title="Вхід як CubaTarara400@gmail.com"
              >
                CubaTarara400
              </button>
            </div>
          </div>

          {tab === 'google' ? (
            <div className="space-y-4">
              <div className="text-xs opacity-80 leading-relaxed">
                Авторизуйтеся через Google, якщо ваш обліковий запис внесено до Білого списку або є адміністратором:
              </div>

              {/* Real Google Button */}
              <button
                type="button"
                onClick={handleFirebaseGoogle}
                disabled={isGoogleLoading}
                className={`w-full py-3 px-4 rounded-xl border ${theme.cardBorder} hover:border-emerald-500 font-semibold text-xs flex items-center justify-center gap-2.5 shadow-sm transition-all cursor-pointer bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>{isGoogleLoading ? 'Перевірка Google акаунту...' : 'Увійти через Google'}</span>
              </button>

              {/* Email Whitelist Checker */}
              <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-2">
                <div className="text-[11px] opacity-70">
                  Бажаєте перевірити, чи ваша пошта є у Білому списку?
                </div>
                <form onSubmit={handleCheckEmailInWhitelist} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="ваша.пошта@gmail.com"
                      className={`w-full py-2 pl-8 pr-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner font-mono`}
                    />
                    <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                  >
                    Перевірити
                  </button>
                </form>
              </div>
            </div>
          ) : tab === 'email_pin' ? (
            <form onSubmit={handleEmailPinSubmit} className="space-y-3.5">
              <div className="text-xs opacity-80 leading-relaxed">
                Введіть вашу електронну пошту та системний PIN-код роду (за замовчуванням <strong>1234</strong> або <strong>admin</strong>):
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  Електронна пошта: *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={pinEmail}
                    onChange={(e) => setPinEmail(e.target.value)}
                    placeholder="fastagile7@gmail.com"
                    className={`w-full py-2 pl-8 pr-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner font-mono`}
                  />
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  PIN-код роду або пароль: *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="1234"
                    className={`w-full py-2 pl-8 pr-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner font-mono`}
                  />
                  <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
                </div>
                <div className="text-[10px] opacity-60 mt-1">
                  Стандартний код: 1234 (або admin для швидкого входу)
                </div>
              </div>

              <button
                type="submit"
                disabled={isPinLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isPinLoading ? 'Вхід...' : 'Увійти за Email та PIN'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendRequest} className="space-y-3.5">
              {requestSent ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-base">Запит успішно надіслано!</h4>
                  <p className="text-xs opacity-75 max-w-sm mx-auto">
                    Адміністратор родоводу отримає повідомлення про ваш запит на доступ для пошти <strong>{reqEmail}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md cursor-pointer hover:bg-emerald-500 transition-colors mt-2"
                  >
                    Зрозуміло
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1 opacity-80">
                      Ваше ім'я та родинна гілка: *
                    </label>
                    <input
                      type="text"
                      required
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Олександр Коваленко (гілка з Полтавщини)"
                      className={`w-full py-2 px-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 opacity-80">
                      Ваша електронна пошта: *
                    </label>
                    <input
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className={`w-full py-2 px-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner font-mono`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 opacity-80">
                      Бажана роль:
                    </label>
                    <select
                      value={reqRole}
                      onChange={(e) => setReqRole(e.target.value as UserRole)}
                      className={`w-full py-2 px-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner`}
                    >
                      <option value="editor">Редактор (внесення осіб, дат та зв'язків)</option>
                      <option value="researcher">Дослідник (архівні джерела та коментарі)</option>
                      <option value="viewer">Переглядач (повний перегляд без редагування)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 opacity-80">
                      Коментар для адміністратора:
                    </label>
                    <textarea
                      rows={2}
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="Я родич по лінії прадіда Івана. Хочу допомогти з наповненням дат та фотографій."
                      className={`w-full py-2 px-3 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-xs focus:outline-none focus:border-emerald-500 shadow-inner resize-none`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Надсилання...' : 'Надіслати запит адміністратору'}</span>
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

