import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { getThemeConfig } from '../utils/theme';

export const AccessLockScreen: React.FC = () => {
  const { unlockWithPin, themePalette } = useGenealogy();
  const theme = getThemeConfig(themePalette);

  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    const success = unlockWithPin(pinInput);
    if (!success) {
      setErrorMsg('Невірний PIN-код або секретний ключ. Спробуйте ще раз.');
      setPinInput('');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  return (
    <div className={`min-h-screen w-screen flex items-center justify-center p-4 font-sans ${theme.appBg} transition-colors duration-300`}>
      <div className={`w-full max-w-md p-8 rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl space-y-6 relative overflow-hidden`}>
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#B88E3E]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#B88E3E]/20 text-[#B88E3E] mx-auto flex items-center justify-center border border-[#B88E3E]/30 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#B88E3E] flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Захищений архів</span>
            </span>
            <h1 className={`text-xl font-extrabold ${theme.cardTitle} mt-1`}>
              Родовід під захистом PIN-коду
            </h1>
            <p className={`text-xs ${theme.cardSubtext} mt-1 leading-relaxed`}>
              Введіть PIN-код або секретний ключ для отримання доступу до генеалогічних даних
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${theme.cardTitle} flex items-center gap-1.5`}>
              <KeyRound className="w-4 h-4 text-[#B88E3E]" />
              <span>PIN-код або ключ доступу</span>
            </label>

            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className={`w-full px-4 py-3 rounded-xl text-center text-lg font-mono tracking-widest border ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-none focus:border-[#B88E3E] shadow-xs`}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3.5 rounded-xl ${theme.accentBtn} ${theme.accentBtnText} font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all cursor-pointer`}
          >
            <span>Увійти в родовід</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-black/10">
          <p className={`text-[11px] ${theme.cardSubtext}`}>
            Якщо ви маєте секретне посилання з ключем <code>?key=...</code>, відкрийте його прямо в браузері для автоматичного входу.
          </p>
        </div>
      </div>
    </div>
  );
};
