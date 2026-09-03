import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  UserCheck, 
  Clock, 
  HelpCircle,
  ChevronRight,
  Users,
  Shield,
  FileText,
  GitFork,
  Eye,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useGenealogy } from '../context/GenealogyContext';
import { useUIStore } from '../stores/useUIStore';
import { getThemeConfig } from '../utils/theme';
import { UserRole } from '../types';
import { signInWithGoogle } from '../lib/firebase';

export const AccessLockScreen: React.FC = () => {
  const { themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const {
    loginWithGoogle,
    loginWithEmailAndPin,
    loginWithPin,
    quickAdminLogin,
    submitAccessRequest,
    checkEmailStatus,
    accessConfig,
    whitelist,
    accessRequests
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'request' | 'login' | 'pin'>('request');
  const [emailInput, setEmailInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Request Access Form State
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqRole, setReqRole] = useState<UserRole>('viewer');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [mailData, setMailData] = useState<{
    gmailWebUrl: string;
    mailtoUrl: string;
    adminEmail: string;
    adminEmails?: string[];
  } | null>(null);

  // Check URL parameters on mount (e.g., ?tab=login or ?email=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      const urlTab = params.get('tab');
      if (urlEmail) {
        setReqEmail(urlEmail);
        setEmailInput(urlEmail);
      }
      if (urlTab === 'login') {
        setActiveTab('login');
      }
    } catch {}
  }, []);

  const [isSigningInWithFirebase, setIsSigningInWithFirebase] = useState(false);

  // Real Firebase Google Sign-In Popup
  const handleFirebaseGooglePopup = async () => {
    setIsSigningInWithFirebase(true);
    setFeedback(null);
    try {
      const { user, error } = await signInWithGoogle();
      if (user && user.email) {
        const res = loginWithGoogle(user.email, user.displayName || undefined, user.photoURL || undefined);
        if (res.success) {
          setFeedback({ type: 'success', message: res.message });
        } else {
          setFeedback({ type: 'error', message: res.message });
          setReqEmail(user.email);
          if (user.displayName) setReqName(user.displayName);
          setActiveTab('request');
        }
      } else if (error) {
        setFeedback({ type: 'error', message: error });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Помилка авторизації Google' });
    } finally {
      setIsSigningInWithFirebase(false);
    }
  };

  // Email + Family PIN code Login handler
  const handleEmailAndPinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = emailInput.trim();
    const targetPin = pinInput.trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Будь ласка, вкажіть дійсну адресу електронної пошти.' });
      return;
    }
    if (!targetPin) {
      setFeedback({ type: 'error', message: 'Будь ласка, введіть спільний сімейний PIN-код роду.' });
      return;
    }

    const res = loginWithEmailAndPin(targetEmail, targetPin);
    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
    } else {
      setFeedback({ type: 'error', message: res.message });
      if (!res.isWhitelisted) {
        setReqEmail(targetEmail);
      }
    }
  };

  // Quick Google Sign-In handler
  const handleGoogleLogin = (emailToUse?: string) => {
    const targetEmail = (emailToUse || emailInput).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Будь ласка, вкажіть дійсну адресу електронної пошти.' });
      return;
    }

    const res = loginWithGoogle(targetEmail);
    if (res.success) {
      setFeedback({ type: 'success', message: res.message });
    } else {
      setFeedback({ type: 'error', message: res.message });
      // Pre-fill request form and switch tab so the user can easily request access!
      setReqEmail(targetEmail);
      setActiveTab('request');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    const ok = loginWithPin(pinInput.trim());
    if (!ok) {
      setFeedback({ type: 'error', message: 'Невірний PIN-код. Подайте заявку на доступ через вашу Google пошту.' });
      setPinInput('');
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqEmail.trim() || !reqName.trim()) {
      setFeedback({ type: 'error', message: 'Будь ласка, заповніть ім\'я та адресу Google пошти.' });
      return;
    }

    const res = submitAccessRequest(reqEmail, reqName, reqNote, reqRole);
    if (res.success) {
      setRequestSubmitted(true);
      if (res.mailResult) {
        setMailData({
          gmailWebUrl: res.mailResult.gmailWebUrl,
          mailtoUrl: res.mailResult.mailtoUrl,
          adminEmail: res.mailResult.adminEmail,
          adminEmails: res.mailResult.adminEmails
        });
      }
      setFeedback({ type: 'success', message: res.message });
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleCheckStatusNow = () => {
    setIsCheckingStatus(true);
    setTimeout(() => {
      setIsCheckingStatus(false);
      const emailToCheck = reqEmail.trim() || emailInput.trim();
      if (!emailToCheck) return;

      const status = checkEmailStatus(emailToCheck);
      if (status.isWhitelisted) {
        // Automatically log them in!
        loginWithGoogle(emailToCheck, reqName);
      } else {
        setFeedback({
          type: 'info',
          message: `Запит для ${emailToCheck} все ще на розгляді в адміністратора. Ви отримаєте сповіщення після підтвердження.`
        });
      }
    }, 600);
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center p-4 font-sans overflow-hidden bg-stone-950">
      {/* 1. MOCK BACKGROUND: Blurred and darkened genealogical workspace to create an authentic locked archive feeling */}
      <div className="absolute inset-0 z-0 opacity-25 filter blur-md pointer-events-none select-none overflow-hidden scale-105">
        <div className="h-full w-full p-8 grid grid-cols-12 gap-6 bg-radial from-amber-950/40 via-stone-900 to-black">
          {/* Mock Tree Nodes */}
          <div className="col-span-3 space-y-4">
            <div className="h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 p-3" />
            <div className="h-20 rounded-2xl bg-stone-800 border border-stone-700 p-3" />
            <div className="h-20 rounded-2xl bg-stone-800 border border-stone-700 p-3" />
          </div>
          <div className="col-span-6 space-y-6 flex flex-col items-center justify-center">
            <div className="w-48 h-20 rounded-2xl bg-amber-600/30 border border-amber-500/40" />
            <div className="flex gap-8">
              <div className="w-44 h-16 rounded-xl bg-stone-800/80 border border-stone-700" />
              <div className="w-44 h-16 rounded-xl bg-stone-800/80 border border-stone-700" />
            </div>
            <div className="flex gap-4">
              <div className="w-32 h-14 rounded-lg bg-stone-900 border border-stone-800" />
              <div className="w-32 h-14 rounded-lg bg-stone-900 border border-stone-800" />
              <div className="w-32 h-14 rounded-lg bg-stone-900 border border-stone-800" />
            </div>
          </div>
          <div className="col-span-3 space-y-4">
            <div className="h-32 rounded-2xl bg-stone-800/60 border border-stone-700" />
            <div className="h-40 rounded-2xl bg-stone-800/60 border border-stone-700" />
          </div>
        </div>
      </div>

      {/* Dark frosted overlay */}
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-md pointer-events-none" />

      {/* 2. FOREGROUND: THE ACCESS GATEWAY CARD */}
      <div className="relative z-10 w-full max-w-xl p-6 sm:p-8 rounded-3xl bg-stone-900/90 dark:bg-stone-900/95 border border-amber-500/30 shadow-2xl text-stone-100 space-y-6 overflow-hidden backdrop-blur-xl">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#B88E3E]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Badge & Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-[#B88E3E]/20 text-[#B88E3E] border border-[#B88E3E]/40 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#B88E3E] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Приватний Родинний Архів</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Захищений доступ за Білим списком
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 mt-2 leading-relaxed max-w-md mx-auto">
              Вміст генеалогічного дослідження, архівні метрики та документи доступні лише авторизованим особам.
            </p>
          </div>
        </div>

        {/* Smart Mode Switch Tabs */}
        <div className="flex rounded-2xl p-1.5 bg-stone-950/80 border border-stone-800 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('request');
              setFeedback(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'request'
                ? 'bg-[#B88E3E] text-white shadow-md font-bold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Попросити доступ</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('login');
              setFeedback(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-[#B88E3E] text-white shadow-md font-bold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Я вже у списку (Вхід)</span>
          </button>

          {accessConfig.mode === 'whitelist_and_pin' && (
            <button
              onClick={() => {
                setActiveTab('pin');
                setFeedback(null);
              }}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'pin'
                  ? 'bg-[#B88E3E] text-white shadow-md font-bold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>PIN</span>
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs flex items-start gap-3 leading-relaxed border ${
              feedback.type === 'error'
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                : feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            )}
            <div className="flex-1">
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        {/* TAB 1: REQUEST ACCESS (PRIMARY ACTION FOR VISITORS) */}
        {activeTab === 'request' && (
          <div className="space-y-4">
            {requestSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    Заявку успішно відправлено!
                  </h3>
                  <p className="text-xs text-stone-300 leading-relaxed max-w-sm mx-auto">
                    Адміністратор архіву отримав ваше прохання про доступ для пошти <strong>{reqEmail}</strong>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-stone-900/80 border border-stone-800 text-left space-y-2 text-xs text-stone-300">
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>Статус заявки:</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Очікує підтвердження</span>
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px] text-stone-400">
                    <div className="flex justify-between items-center">
                      <span>Адміністратори-отримувачі:</span>
                      <span className="text-[10px] text-amber-400">
                        {mailData?.adminEmails && mailData.adminEmails.length > 1
                          ? `Всі ${mailData.adminEmails.length} адміни`
                          : 'Головний адмін'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {(mailData?.adminEmails || ['CubaTarara400@gmail.com']).map((em) => (
                        <span
                          key={em}
                          className="px-2 py-0.5 rounded-md bg-stone-950 font-mono text-[10px] text-emerald-400 border border-stone-800"
                        >
                          {em}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-stone-400 border-t border-stone-800 pt-1.5">
                    Сповіщення направлено всім адміністраторам архіву. Будь-хто з адміністраторів може схвалити вашу заявку.
                  </div>
                </div>

                {/* Direct Email Action Buttons */}
                {mailData && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={mailData.gmailWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Відкрити лист у Gmail</span>
                    </a>

                    <a
                      href={mailData.mailtoUrl}
                      className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center justify-center gap-1.5 border border-stone-700 transition-all"
                    >
                      <span>Поштовий клієнт (Mail)</span>
                    </a>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCheckStatusNow}
                    disabled={isCheckingStatus}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                    <span>{isCheckingStatus ? 'Перевірка...' : 'Перевірити статус зараз'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRequestSubmitted(false);
                      setActiveTab('login');
                      setEmailInput(reqEmail);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
                  >
                    Увійти
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-3.5">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B88E3E]" />
                  <span>
                    Вкажіть вашу <strong>Google-пошту</strong> та коротко напишіть, ким ви доводитесь родині, щоб адміністратор міг схвалити заявку.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-200">
                      Ваше ім'я та прізвище
                    </label>
                    <input
                      type="text"
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Олександр Коваленко"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-950/80 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-[#B88E3E] transition-colors"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-200">
                      Ваш Google Email
                    </label>
                    <input
                      type="email"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="alex.kovalenko@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-950/80 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-[#B88E3E] transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-200">
                    Бажаний рівень доступу
                  </label>
                  <select
                    value={reqRole}
                    onChange={(e) => setReqRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-950/80 border border-stone-700 text-white focus:outline-none focus:border-[#B88E3E] cursor-pointer"
                  >
                    <option value="viewer">Переглядач (Перегляд дерева та хроніки роду)</option>
                    <option value="researcher">Дослідник (Перегляд + додавання архівних нотаток)</option>
                    <option value="editor">Редактор (Співпраця та наповнення родоводу)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-200">
                    Родинний зв'язок або мета перегляду (Примітка)
                  </label>
                  <textarea
                    rows={2}
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    placeholder="наприклад: Я онук Остапа Коваленка з Полтавщини, хочу ознайомитися з деревом..."
                    className="w-full px-3.5 py-2 rounded-xl text-xs bg-stone-950/80 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-[#B88E3E] resize-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#B88E3E] to-amber-600 hover:from-amber-600 hover:to-[#B88E3E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Надіслати запит на доступ до архіву</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: LOGIN FOR WHITELISTED USERS */}
        {activeTab === 'login' && (
          <div className="space-y-4">
            {/* Direct Open Tree Button */}
            <button
              onClick={() => {
                const { setActiveTab, setRodovidView } = useUIStore.getState();
                setActiveTab('tree');
                setRodovidView('tree');
              }}
              className="w-full p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 text-left flex items-center justify-between group transition-all cursor-pointer shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shadow-sm shrink-0 border border-emerald-500/30">
                  <GitFork className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Відкрити Дерево та Віяло</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                      Публічно
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Перегляд родоводу без потреби у вході
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Email + Family PIN Login Form (Option 2) */}
            <div className="p-4 rounded-2xl bg-stone-950/70 border border-amber-500/30 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#B88E3E]">
                <KeyRound className="w-4 h-4" />
                <span>Швидкий вхід: Email + PIN-код роду</span>
              </div>
              <p className="text-[11px] text-stone-300 leading-tight">
                Якщо ви додані до Білого списку, введіть вашу пошту та сімейний PIN-код. Логінитись у Google не потрібно.
              </p>

              <form onSubmit={handleEmailAndPinLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Електронна пошта зі списку:</span>
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-900 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-[#B88E3E]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#B88E3E]" />
                    <span>Сімейний PIN-код:</span>
                  </label>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-stone-900 border border-stone-700 text-white placeholder-stone-500 focus:outline-none focus:border-[#B88E3E] font-mono tracking-widest"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B88E3E] to-amber-600 hover:from-amber-600 hover:to-[#B88E3E] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Увійти за Email та PIN-кодом</span>
                </button>
              </form>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-stone-800" />
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold tracking-widest text-stone-400">
                або авторизуйтесь через Google
              </span>
              <div className="flex-grow border-t border-stone-800" />
            </div>

            {/* Google Sign-In with Popup */}
            <button
              type="button"
              disabled={isSigningInWithFirebase}
              onClick={handleFirebaseGooglePopup}
              className="w-full p-3 rounded-2xl bg-white hover:bg-stone-100 text-stone-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer border border-stone-200"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningInWithFirebase ? 'Авторизація Google...' : 'Увійти в 1 клік через Google'}</span>
            </button>

            {/* Quick Admin Access Bar */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#B88E3E]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Швидкий вхід адміністратора
                </span>
                <span className="font-mono text-[10px] text-amber-400">domagile@gmail.com</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const res = quickAdminLogin('domagile@gmail.com');
                    setFeedback({ type: 'success', message: `Вітаємо, ${res.name}! Доступ з правами адміністратора надано.` });
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Вхід як Автор дослідження (domagile@gmail.com)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Увійти як domagile@gmail.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const res = quickAdminLogin('fastagile7@gmail.com');
                    setFeedback({ type: 'success', message: `Вітаємо, ${res.name}! Доступ надано.` });
                  }}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all cursor-pointer"
                  title="Вхід як fastagile7@gmail.com"
                >
                  fastagile7
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BACKUP PIN */}
        {activeTab === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#B88E3E]" />
                <span>Резервний PIN-код для гостей</span>
              </label>

              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-center text-xl font-mono tracking-widest bg-stone-950 border border-stone-700 text-white focus:outline-none focus:border-[#B88E3E] shadow-inner"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#B88E3E] hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span>Увійти за PIN-кодом</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Footer Info */}
        <div className="text-center pt-3 border-t border-stone-800/80 flex items-center justify-between text-[11px] text-stone-400">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#B88E3E]" />
            <span>Контроль доступу захищено</span>
          </span>
          <span className="font-mono">v2.4 Whitelist</span>
        </div>
      </div>
    </div>
  );
};
