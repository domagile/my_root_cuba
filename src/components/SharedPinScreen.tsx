import React, { useState } from 'react';
import { Lock, KeyRound, ArrowRight, ShieldCheck, TreeDeciduous, AlertCircle, ArrowLeft } from 'lucide-react';
import { useSharedTreeStore } from '../stores/useSharedTreeStore';
import { useUIStore } from '../stores/useUIStore';
import { getThemeConfig } from '../utils/theme';

export const SharedPinScreen: React.FC = () => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const themePalette = useUIStore((s) => s.themePalette);
  const theme = getThemeConfig(themePalette);

  const { sharedTree, verifyPin, exitSharedMode } = useSharedTreeStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Будь ласка, введіть код доступу');
      return;
    }

    const success = verifyPin(pin);
    if (!success) {
      setErrorMsg('Невірний PIN-код. Спробуйте ще раз або зверніться до автора дерева.');
    } else {
      setErrorMsg(null);
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 ${theme.appBg} font-sans transition-colors`}>
      <div className={`w-full max-w-md rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200`}>
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-[#B88E3E] text-white flex items-center justify-center shadow-lg">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-bold ${theme.cardTitle}`}>
              Захищене родинне дерево
            </h1>
            <p className="text-xs sm:text-sm opacity-75 mt-1">
              «{sharedTree?.title || 'Родовід родини'}»
            </p>
          </div>
        </div>

        {/* Tree Meta Badge */}
        <div className={`p-3 rounded-xl border ${theme.cardBorder} bg-black/5 dark:bg-white/5 text-xs space-y-1`}>
          <div className="flex justify-between">
            <span className="opacity-70">Автор / Дослідник:</span>
            <span className="font-semibold">{sharedTree?.authorName || 'Дослідник'}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Кількість осіб:</span>
            <span className="font-semibold">{sharedTree?.personsCount || 0} осіб</span>
          </div>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 opacity-80 text-center">
              Введіть PIN-код для відкриття родоводу:
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="• • • •"
                className={`w-full py-3 px-4 rounded-xl border ${theme.inputBorder} ${theme.inputBg} ${theme.inputText} text-center font-mono text-xl tracking-[0.3em] font-bold focus:outline-none focus:border-[#B88E3E] shadow-inner`}
              />
              <KeyRound className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:opacity-95 active:scale-[0.98]`}
          >
            <span>Відкрити родовід</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer / Exit */}
        <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-center">
          <button
            onClick={exitSharedMode}
            className="text-xs text-[#B88E3E] hover:underline flex items-center gap-1 opacity-80 hover:opacity-100 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Перейти до головного входу</span>
          </button>
        </div>
      </div>
    </div>
  );
};
