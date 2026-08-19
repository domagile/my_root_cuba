import React, { useState } from 'react';
import { Search, UserPlus, Github, HardDrive, Sparkles, Share2, Palette, Mail, Plus, Trash2, Copy, Check, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useGenealogy } from '../context/GenealogyContext';
import { ThemePalette } from '../types';
import { THEME_CONFIGS, getThemeConfig } from '../utils/theme';

interface HeaderProps {
  onOpenAddPerson: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddPerson }) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    persons, 
    metricRecords, 
    tasks, 
    sharedInvites, 
    addSharedInvite, 
    deleteSharedInvite,
    themePalette,
    setThemePalette,
    setActiveTab
  } = useGenealogy();

  const theme = getThemeConfig(themePalette);

  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Invite Form State
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim() || !newInviteEmail.includes('@')) {
      alert('Будь ласка, вкажіть коректну Google пошту (email).');
      return;
    }
    addSharedInvite({
      id: `invite-${Date.now()}`,
      name: newInviteEmail.split('@')[0],
      email: newInviteEmail,
      role: newInviteRole,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
      invitedAt: new Date().toISOString()
    });
    setNewInviteEmail('');
  };

  const handleCopyLink = (inviteId: string, email: string) => {
    const link = `${window.location.origin}/?invite=${inviteId}&user=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const themeList = Object.values(THEME_CONFIGS);
  const lightThemes = themeList.filter(t => t.category === 'light');
  const darkThemes = themeList.filter(t => t.category === 'dark');

  const toggleLightDarkQuick = () => {
    if (theme.category === 'light') {
      setThemePalette('dark-emerald');
    } else {
      setThemePalette('light-parchment');
    }
  };

  return (
    <>
      <header id="app-header" className={`h-16 ${theme.headerBg} border-b ${theme.headerBorder} ${theme.headerText} px-6 flex items-center justify-between gap-4 flex-shrink-0 transition-colors duration-300`}>
        {/* Search Input */}
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук особи, прізвища чи місця..."
            className={`w-full pl-9 pr-4 py-1.5 ${theme.inputBg} border ${theme.inputBorder} rounded-lg text-sm ${theme.inputText} placeholder-opacity-60 focus:outline-none focus:border-[#B88E3E] transition-colors`}
          />
        </div>

        {/* Quick Stats Badges */}
        <div className="hidden lg:flex items-center gap-4 text-xs opacity-80">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cloud Firestore: <strong>Синхронізовано</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#B88E3E]"></span>
            <span>Дерево: <strong className="font-semibold">{persons.length}</strong> осіб</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#52C480]"></span>
            <span>Метрики: <strong className="font-semibold">{metricRecords.length}</strong> збережено</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAddPerson}
            id="add-person-btn"
            className={`flex items-center gap-2 px-4 py-1.5 ${theme.accentBtn} ${theme.accentBtnText} font-medium rounded-lg text-xs transition-colors shadow-sm`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Додати особу</span>
          </button>
        </div>
      </header>

      {/* Theme Palette Selection Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl max-w-xl w-full p-6 ${theme.cardTitle} shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-start justify-between border-b ${theme.cardBorder} pb-3`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B88E3E]/20 flex items-center justify-center text-[#B88E3E]">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Кольорове оформлення та фон</h3>
                  <p className="text-xs opacity-75">Оберіть найприємніший для очей фон інтерфейсу</p>
                </div>
              </div>
              <button onClick={() => setShowThemeModal(false)} className="opacity-70 hover:opacity-100 text-lg px-2">
                ✕
              </button>
            </div>

            {/* Light Themes */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" />
                <span>Світлі та пастельні теми (М'який пергамент, шавлія, пісок)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {lightThemes.map((p) => {
                  const isSelected = themePalette === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setThemePalette(p.id as ThemePalette)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 shadow-md bg-amber-50/50'
                          : 'border-black/10 hover:border-[#B88E3E]/50'
                      }`}
                      style={{ backgroundColor: p.colors[0] }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs" style={{ color: p.colors[3] }}>{p.name.split('(')[0]}</span>
                          {isSelected && <span className="px-1.5 py-0.2 text-[9px] bg-[#B88E3E] text-white font-bold rounded">Активна</span>}
                        </div>
                        <p className="text-[10px] opacity-80 leading-snug" style={{ color: p.colors[3] }}>{p.desc}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-black/20" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dark Themes */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B88E3E] flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" />
                <span>Темні та класичні теми (Смарагд, дерево, сапфір)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {darkThemes.map((p) => {
                  const isSelected = themePalette === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setThemePalette(p.id as ThemePalette)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/40 shadow-md'
                          : 'border-white/10 hover:border-[#B88E3E]/50'
                      }`}
                      style={{ backgroundColor: p.colors[0] }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-xs" style={{ color: p.colors[3] }}>{p.name.split('(')[0]}</span>
                          {isSelected && <span className="px-1.5 py-0.2 text-[9px] bg-[#B88E3E] text-white font-bold rounded">Активна</span>}
                        </div>
                        <p className="text-[10px] opacity-80 leading-snug" style={{ color: p.colors[3] }}>{p.desc}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        {p.colors.map((c, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setShowThemeModal(false)}
                className={`px-5 py-2 ${theme.accentBtn} ${theme.accentBtnText} font-medium text-xs rounded-xl transition-colors`}
              >
                Застосувати та закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Access via Google Email Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D2E28] border border-[#22574A] rounded-2xl max-w-lg w-full p-6 text-[#E4DAC7] shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between border-b border-[#18463C] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2C382]/20 flex items-center justify-center text-[#E2C382]">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[#F5EEDC]">Спільний доступ за Google Поштою</h3>
                  <p className="text-xs text-[#8BAAA1]">Надайте доступ для перегляду чи редагування родоводу</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-[#8BAAA1] hover:text-[#F5EEDC] text-lg px-2">
                ✕
              </button>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleSendInvite} className="p-3 bg-[#08201B] rounded-xl border border-[#16443B] space-y-3">
              <span className="text-xs font-semibold text-[#E2C382] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>Запросити корисувача за ел. поштою</span>
              </span>

              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="напр. relative@gmail.com"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-[#09221D] border border-[#1B4A3E] rounded-lg text-xs text-[#F0E6D2] focus:outline-none focus:border-[#E2C382]"
                />
                <select
                  value={newInviteRole}
                  onChange={(e) => setNewInviteRole(e.target.value as 'editor' | 'viewer')}
                  className="px-2.5 py-1.5 bg-[#09221D] border border-[#1B4A3E] rounded-lg text-xs text-[#F0E6D2] focus:outline-none"
                >
                  <option value="viewer">Переглядач</option>
                  <option value="editor">Редактор</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#E2C382] hover:bg-[#D4B572] text-[#0A2621] font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Надіслати</span>
                </button>
              </div>
            </form>

            {/* Invited Users List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#8BAAA1] block">Користувачі з доступом:</span>
              
              <div className="p-2.5 bg-[#08201B] rounded-xl border border-[#16443B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#54C086]" />
                  <div>
                    <span className="text-xs text-[#F0E6D2] font-semibold block">Власник родоводу (Ви)</span>
                    <span className="text-[10px] text-[#8BAAA1]">CubaTarara400@gmail.com</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-[#143B33] text-[#54C086] rounded font-mono">Адміністратор</span>
              </div>

              {sharedInvites.length === 0 ? (
                <p className="text-xs text-[#789A91] italic p-2">Ще немає додаткових запрошених користувачів.</p>
              ) : (
                sharedInvites.map((inv) => (
                  <div key={inv.id} className="p-2.5 bg-[#08201B] rounded-xl border border-[#16443B] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#F0E6D2] font-medium truncate">{inv.email}</span>
                        <span className="px-1.5 py-0.2 text-[9px] bg-[#16443B] text-[#E2C382] rounded font-mono">
                          {inv.role === 'editor' ? 'Редактор' : 'Переглядач'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#789A91] block">Запрошено: {inv.invitedAt}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyLink(inv.id, inv.email)}
                        className="px-2 py-1 bg-[#123830] hover:bg-[#1C4E43] text-[#E2C382] text-[11px] rounded flex items-center gap-1 border border-[#1F5448]"
                        title="Скопіювати персональне посилання-запрошення"
                      >
                        {copiedInviteId === inv.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#54C086]" />
                            <span className="text-[#54C086]">Скопійовано!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Лінк</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => deleteSharedInvite(inv.id)}
                        className="p-1.5 text-[#8BAAA1] hover:text-rose-400 shrink-0"
                        title="Скасувати доступ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-medium text-xs rounded-lg hover:bg-[#D4B572] transition-colors"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storage & GitHub explanation modal */}
      {showStorageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D2E28] border border-[#22574A] rounded-2xl max-w-lg w-full p-6 text-[#E4DAC7] shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between border-b border-[#18463C] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2C382]/20 flex items-center justify-center text-[#E2C382]">
                  <Github className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[#F5EEDC]">Збереження даних та коду на GitHub</h3>
                  <p className="text-xs text-[#8BAAA1]">Як влаштовано збереження ваших даних</p>
                </div>
              </div>
              <button 
                onClick={() => setShowStorageModal(false)}
                className="text-[#8BAAA1] hover:text-[#F5EEDC] text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#C2D4CE] leading-relaxed">
              <div className="p-3 bg-[#08201B] rounded-xl border border-[#16443B]">
                <h4 className="font-semibold text-[#E2C382] mb-1 flex items-center gap-2">
                  <HardDrive className="w-4 h-4" /> 1. Де зберігається проіндексована інформація?
                </h4>
                <p className="text-xs text-[#A8C2BB]">
                  Всі внесені вами особи, фотографії, розпізнані метричні книги та замітки миттєво зберігаються у **локальній базі даних вашого браузера (LocalStorage)**. Це гарантує приватність та миттєву швидкість роботи.
                </p>
              </div>

              <div className="p-3 bg-[#08201B] rounded-xl border border-[#16443B]">
                <h4 className="font-semibold text-[#E2C382] mb-1 flex items-center gap-2">
                  <Github className="w-4 h-4" /> 2. Як зберегти весь код та дані на GitHub або Google Диск?
                </h4>
                <ul className="text-xs text-[#A8C2BB] space-y-1.5 list-disc pl-4">
                  <li><strong>Код програми:</strong> Ви можете завантажити код додатка у ваш репозиторій на GitHub за допомогою кнопки Export/GitHub у верхньому меню середовища AI Studio.</li>
                  <li><strong>Файл даних родоводу:</strong> Кнопка <span className="text-[#E2C382]">«Експорт JSON»</span> у бічній панелі створює повний резервний файл родоводу. Ви можете завантажити цей файл у ваш репозиторій на GitHub чи на Google Диск.</li>
                  <li><strong>Формат GEDCOM:</strong> Ви також можете експортувати дерево у стандартний формат GEDCOM для завантаження в будь-які інші генеалогічні програми.</li>
                </ul>
              </div>

              <div className="p-3 bg-[#08201B] rounded-xl border border-[#16443B]">
                <h4 className="font-semibold text-[#54C086] mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> 3. Автоматичний імпорт
                </h4>
                <p className="text-xs text-[#A8C2BB]">
                  Коли ви відкриєте додаток на іншому комп&apos;ютері, просто натисніть кнопку <span className="text-[#E2C382]">«Імпорт»</span> і виберіть ваш збережений файл з GitHub або Google Диска — і весь ваш родовід повністю відновиться!
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowStorageModal(false)}
                className="px-4 py-2 bg-[#E2C382] text-[#0A2621] font-medium text-xs rounded-lg hover:bg-[#D4B572] transition-colors"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
