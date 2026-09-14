import React, { useState } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  UserPlus, 
  Check, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Eye, 
  Building2,
  AlertCircle
} from 'lucide-react';
import { useGenealogyStore } from '../../stores/useGenealogyStore';

interface NyshporkaReadingProps {
  theme: any;
}

export const NyshporkaReading: React.FC<NyshporkaReadingProps> = ({ theme }) => {
  const [selectedSample, setSelectedSample] = useState<string>('0012');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [scriptType, setScriptType] = useState<string>('early_cursive');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'transcription' | 'modern' | 'entities' | 'lines'>('transcription');

  const addPerson = useGenealogyStore(s => s.addPerson);

  const sampleImages: Record<string, { label: string; url: string; context: string }> = {
    '0001': {
      label: 'ДАХмО 315-1-159 (Титул справи, 1821 р.)',
      url: '/nyshporka/frames/0001.jpg',
      context: 'Справа про рукоположення дякона Григорія Долищинського у с. Липовеньке Балтського повіту 1821-1822 рр.'
    },
    '0012': {
      label: 'ДАХмО 315-1-159 (Шлюбний запис, 1822 р.)',
      url: '/nyshporka/frames/0012.jpg',
      context: 'Свідоцтво про шлюб дякона Григорія Долищинського з дівицею Оленою Виробинською, дочкою священика Стефана Виробинського с. Липовеньке'
    },
    '0015': {
      label: 'ДАХмО 315-1-159 (Консисторська виписка, 1822 р.)',
      url: '/nyshporka/frames/0015.jpg',
      context: 'Резолюція Подільської духовної консисторії щодо затвердження на парафію'
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomImage(ev.target?.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const activeSample = sampleImages[selectedSample];
      const payload: any = {
        targetEngine: 'pysar',
        documentContext: customImage 
          ? 'Користувацький скан метричної книги або ревізії XVIII-XIX ст.'
          : activeSample.context
      };

      if (customImage) {
        payload.imageBase64 = customImage;
      }

      const res = await fetch('/api/nyshporka/htr-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPerson = (entity: any) => {
    const parts = (entity.name || '').split(' ');
    const lastName = parts[0] || 'Невідомий';
    const firstName = parts[1] || 'Предко';
    const patronymic = parts[2] || '';

    addPerson({
      id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      firstName,
      lastName,
      patronymic,
      gender: 'M',
      birthYear: parseInt(entity.year) || 1800,
      birthPlace: entity.place || 'Подільська губернія',
      notes: `Виявлено рушієм скоропису Нишпорка (HTR). Стан: ${entity.status || ''}. Роль: ${entity.role || ''}`,
      isLiving: false,
      researchStatus: 'confirmed'
    });

    alert(`Особу «${entity.name}» додано до Родоводу!`);
  };

  const currentPreviewUrl = customImage || sampleImages[selectedSample]?.url;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
          <Sparkles className="w-5 h-5 text-amber-500" />
          ШІ-розпізнавання скоропису (HTR Reading Lab)
        </h2>
        <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
          Палеографічний аналіз рукописів XVIII–XIX ст., транскрибування та витяг родинних зв'язків
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input and Preview */}
        <div className={`lg:col-span-6 p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-4`}>
          <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
            1. Вибір скану для читання
          </h3>

          {/* Sample Selectors */}
          <div className="space-y-2">
            <label className="text-xs text-neutral-500 block">
              Виберіть автентичний зразок зі справи або завантажте власний:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(sampleImages).map(([key, sample]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedSample(key);
                    setCustomImage(null);
                    setResult(null);
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    selectedSample === key && !customImage
                      ? 'bg-amber-500/15 border-amber-500 text-neutral-900 dark:text-neutral-100 font-medium ring-1 ring-amber-500'
                      : 'bg-neutral-50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="font-bold">{sample.label}</div>
                  <div className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                    {sample.context}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Box */}
          <div className="pt-2">
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-amber-500 rounded-xl cursor-pointer bg-neutral-50 dark:bg-neutral-900/20 transition-colors">
              <Upload className="w-5 h-5 text-amber-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Завантажити свій скан архіву
              </span>
              <span className="text-[10px] text-neutral-400">
                JPEG, PNG, WebP (метрична книга, ревізія, сповідка)
              </span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
            {customImage && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 text-center">
                ✓ Власний файл завантажено
              </div>
            )}
          </div>

          {/* Script Type selector */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Тип рукописного почерку (HTR Profile):
            </label>
            <select
              value={scriptType}
              onChange={(e) => setScriptType(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
            >
              <option value="early_cursive">Східнослов’янський скоропис кінця XVIII — початку XIX ст.</option>
              <option value="clerical_cursive">Канцелярський скоропис середини XIX ст.</option>
              <option value="semi_uncial">Півустав церковнослов’янських метричних книг</option>
            </select>
          </div>

          {/* Image Preview Thumbnail */}
          <div className="h-48 bg-neutral-950 rounded-xl overflow-hidden flex items-center justify-center border border-neutral-200 dark:border-neutral-800 relative">
            <img 
              src={currentPreviewUrl} 
              alt="Скан рукопису" 
              className="h-full w-full object-contain p-2"
            />
          </div>

          {/* Run button */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Розпізнавання скоропису палеографічним ШІ...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Запустити ШІ-розпізнавання та транскрипцію</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Results */}
        <div className={`lg:col-span-6 p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm flex flex-col space-y-4`}>
          <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              2. Результати транскрибування
            </h3>
            {result?.source && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold">
                {result.source}
              </span>
            )}
          </div>

          {result ? (
            <div className="space-y-4 flex-1">
              {/* Tab navigation */}
              <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('transcription')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'transcription'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  Автентичний скоропис
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('modern')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'modern'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  Сучасний переклад
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('entities')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'entities'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  Знайдені особи ({result.entities?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lines')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'lines'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  Рядки ({result.lines?.length || 0})
                </button>
              </div>

              {/* View 1: Authentic Transcription */}
              {activeTab === 'transcription' && (
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 max-h-[380px] overflow-y-auto space-y-3">
                  <div className="font-serif text-xs leading-relaxed whitespace-pre-line text-neutral-900 dark:text-neutral-100 select-text">
                    {result.pysarText || result.transcription || 'Текст розпізнано успішно.'}
                  </div>
                  {result.diakText && result.diakText !== result.pysarText && (
                    <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
                      <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                        Церковний варіант читання (Diak):
                      </span>
                      <div className="font-serif text-xs leading-relaxed whitespace-pre-line text-neutral-600 dark:text-neutral-400">
                        {result.diakText}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* View 2: Modern Translation */}
              {activeTab === 'modern' && (
                <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 max-h-[380px] overflow-y-auto font-sans text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 select-text">
                  {result.modernUkrainian || 'Переклад відсутній'}
                </div>
              )}

              {/* View 3: Entities */}
              {activeTab === 'entities' && (
                <div className="space-y-2 max-h-[380px] overflow-y-auto">
                  {result.entities && result.entities.length > 0 ? (
                    result.entities.map((ent: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-neutral-900 dark:text-neutral-100">
                            {ent.name}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {ent.role} · {ent.status} · {ent.place} ({ent.year} р.)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddPerson(ent)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors cursor-pointer shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          В Родовід
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-neutral-400 text-xs">
                      Конкретних персональних сутностей не виділено
                    </div>
                  )}
                </div>
              )}

              {/* View 4: Lines */}
              {activeTab === 'lines' && (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
                  {result.lines?.map((l: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 text-xs font-serif flex items-start gap-2"
                    >
                      <span className="font-mono text-[10px] text-neutral-400 w-5 shrink-0 select-none">
                        {idx + 1}.
                      </span>
                      <span className="text-neutral-800 dark:text-neutral-200">{l}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl space-y-2">
              <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-600" />
              <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Очікування запуску читання
              </div>
              <p className="text-[11px] text-neutral-400 max-w-xs">
                Виберіть скан або завантажте свій документ і натисніть кнопку «Запустити ШІ-розпізнавання»
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
