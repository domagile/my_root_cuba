import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  Sparkles, 
  MapPin, 
  Check, 
  Save, 
  Plus, 
  X,
  FileText
} from 'lucide-react';
import { ResearchProfile } from './types';
import { 
  getStoredResearchProfile, 
  saveStoredResearchProfile, 
  DEFAULT_RESEARCH_PROFILE 
} from '../../utils/nyshporkaStorage';

interface NyshporkaProfileProps {
  theme: any;
}

export const NyshporkaProfile: React.FC<NyshporkaProfileProps> = ({ theme }) => {
  const [profile, setProfile] = useState<ResearchProfile>(getStoredResearchProfile());
  const [isSaved, setIsSaved] = useState(false);

  const [newHistorical, setNewHistorical] = useState('');
  const [newPolish, setNewPolish] = useState('');
  const [newConfuser, setNewConfuser] = useState('');
  const [newVillage, setNewVillage] = useState('');

  const handleSave = () => {
    saveStoredResearchProfile(profile);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    if (confirm('Скинути профіль до типових налаштувань роду Долищинських?')) {
      setProfile(DEFAULT_RESEARCH_PROFILE);
      saveStoredResearchProfile(DEFAULT_RESEARCH_PROFILE);
    }
  };

  const addTag = (field: keyof ResearchProfile, value: string, setter: (s: string) => void) => {
    if (!value.trim()) return;
    setProfile(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), value.trim()]
    }));
    setter('');
  };

  const removeTag = (field: keyof ResearchProfile, idx: number) => {
    setProfile(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
            <Settings className="w-5 h-5 text-amber-500" />
            Профіль роду та конфігурація пошуку в скорописі
          </h2>
          <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
            Налаштуйте канонічні та історичні форми прізвища, конфузери та географічні прив'язки
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 transition-colors cursor-pointer"
          >
            Скинути
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer shadow-sm"
          >
            {isSaved ? <Check className="w-4 h-4 text-emerald-950" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Збережено в пам’ять!' : 'Зберегти профіль'}
          </button>
        </div>
      </div>

      <div className={`p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-6`}>
        {/* Primary Surname */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
            Головне досліджуване прізвище:
          </label>
          <input
            type="text"
            value={profile.primarySurname}
            onChange={e => setProfile({ ...profile, primarySurname: e.target.value })}
            className="w-full text-sm font-bold p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
          />
        </div>

        {/* Historical Cyrillic Variants */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
            Історичні написання (XVIII–XIX ст., яті ѣ, єри ъ, закінчення -скій):
          </label>
          <div className="flex flex-wrap gap-2">
            {profile.historicalVariants.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-serif bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                {item}
                <button type="button" onClick={() => removeTag('historicalVariants', idx)} className="text-neutral-400 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newHistorical}
              onChange={e => setNewHistorical(e.target.value)}
              placeholder="Додати варіант (напр. Долищинскій)..."
              className="text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-1"
            />
            <button
              type="button"
              onClick={() => addTag('historicalVariants', newHistorical, setNewHistorical)}
              className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold cursor-pointer"
            >
              Додати
            </button>
          </div>
        </div>

        {/* Polish / Latin Variants */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
            Латинські та польські варіанти (метрики костелів та уніатські реєстри):
          </label>
          <div className="flex flex-wrap gap-2">
            {profile.polishVariants.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                {item}
                <button type="button" onClick={() => removeTag('polishVariants', idx)} className="text-neutral-400 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newPolish}
              onChange={e => setNewPolish(e.target.value)}
              placeholder="Додати латинський запис (напр. Dolyszczyński)..."
              className="text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-1"
            />
            <button
              type="button"
              onClick={() => addTag('polishVariants', newPolish, setNewPolish)}
              className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold cursor-pointer"
            >
              Додати
            </button>
          </div>
        </div>

        {/* Confusers */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
            Конфузери HTR (типові оптичні спотворення писарського почерку):
          </label>
          <div className="flex flex-wrap gap-2">
            {profile.confusers.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                {item}
                <button type="button" onClick={() => removeTag('confusers', idx)} className="text-neutral-400 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newConfuser}
              onChange={e => setNewConfuser(e.target.value)}
              placeholder="Додати конфузер (напр. Делищинський)..."
              className="text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-1"
            />
            <button
              type="button"
              onClick={() => addTag('confusers', newConfuser, setNewConfuser)}
              className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold cursor-pointer"
            >
              Додати
            </button>
          </div>
        </div>

        {/* Geographic Localities */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
            Цільові населені пункти та парафії дослідження:
          </label>
          <div className="flex flex-wrap gap-2">
            {profile.villages.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <MapPin className="w-3 h-3" />
                {item}
                <button type="button" onClick={() => removeTag('villages', idx)} className="text-neutral-400 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newVillage}
              onChange={e => setNewVillage(e.target.value)}
              placeholder="Додати село чи парафію (напр. с. Липовеньке)..."
              className="text-xs p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-1"
            />
            <button
              type="button"
              onClick={() => addTag('villages', newVillage, setNewVillage)}
              className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-xs font-semibold cursor-pointer"
            >
              Додати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
