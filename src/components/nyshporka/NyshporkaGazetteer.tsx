import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  BookOpen, 
  ExternalLink, 
  Building2, 
  Compass, 
  Church, 
  CheckCircle2,
  Filter
} from 'lucide-react';

interface SettlementItem {
  id: string;
  name: string;
  historicalName?: string;
  type: 'село' | 'містечко' | 'місто' | 'хутір';
  volost: string;
  district: string; // повіт
  gubernia: string;
  churchName: string;
  fondCode: string;
  archiveCode: string;
  archiveName: string;
  hasDigitalScans: boolean;
  yearsRange: string;
  notes?: string;
}

const SAMPLE_GAZETTEER: SettlementItem[] = [
  {
    id: '1',
    name: 'Липовеньке',
    historicalName: 'Липовенька',
    type: 'село',
    volost: 'Липовеньківська',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Свято-Покровська / Свято-Іоанно-Богословська церква',
    fondCode: 'Фонд 315, Опис 1',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1796–1920',
    notes: 'Збереглися справи про священицькі роди (справа 159 про дякона Григорія Долищинського 1821-1822 рр.)'
  },
  {
    id: '2',
    name: 'Голованівськ',
    historicalName: 'м-ко Головановскъ',
    type: 'містечко',
    volost: 'Голованівська',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Свято-Іоанно-Богословська церква',
    fondCode: 'Фонд 315, Опис 1',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1800–1918',
    notes: 'Священицький рід Виробинських та Лобкевичів'
  },
  {
    id: '3',
    name: 'Кам’янець-Подільський',
    historicalName: 'Каменецъ-Подольскій',
    type: 'місто',
    volost: 'Центр губернії',
    district: 'Кам’янецький повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Кафедральний собор, Іоанно-Предтеченська, Миколаївська, Георгіївська',
    fondCode: 'Фонд 315, 226, 227',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1795–1922',
    notes: 'Подільська духовна консисторія, Подільська казенна палата (ревізії)'
  },
  {
    id: '4',
    name: 'Проскурів',
    historicalName: 'Проскуровъ (нині Хмельницький)',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Проскурівський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Різдво-Богородицька, соборна церква',
    fondCode: 'Фонд 315, 13614',
    archiveCode: 'ДАХмО',
    archiveName: 'Державний архів Хмельницької області',
    hasDigitalScans: true,
    yearsRange: '1796–1920',
    notes: 'Метричні книги та судові справи повітового суду'
  },
  {
    id: '5',
    name: 'Васильків',
    historicalName: 'Васильковъ',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Васильківський повіт',
    gubernia: 'Київська губернія',
    churchName: 'Свято-Антоніє-Феодосіївський собор, Свято-Миколаївська церква',
    fondCode: 'Фонд 127, Опис 1012',
    archiveCode: 'ЦДІАК',
    archiveName: 'Центральний державний історичний архів України, м. Київ',
    hasDigitalScans: true,
    yearsRange: '1720–1919',
    notes: 'Київська духовна консисторія, метричні книги та сповідні відомості козацьких і міщанських родин'
  },
  {
    id: '6',
    name: 'Біла Церква',
    historicalName: 'Бѣлая Церковь',
    type: 'місто',
    volost: 'Білоцерківська',
    district: 'Васильківський повіт',
    gubernia: 'Київська губернія',
    churchName: 'Преображенський собор, Марії Магдалини, костел св. Іоанна Хрестителя',
    fondCode: 'Фонд 127, 280',
    archiveCode: 'ЦДІАК / ДАКО',
    archiveName: 'ЦДІАК України та Держ. архів Київської області',
    hasDigitalScans: true,
    yearsRange: '1740–1920',
    notes: 'Браніцькі маєтки, ревізькі казки селян і шляхти'
  },
  {
    id: '7',
    name: 'Житомир',
    historicalName: 'Житоміръ',
    type: 'місто',
    volost: 'Центр губернії',
    district: 'Житомирський повіт',
    gubernia: 'Волинська губернія',
    churchName: 'Спасо-Преображенський собор, Хрестовоздвиженська, св. Софії',
    fondCode: 'Фонд 1, 118',
    archiveCode: 'ДАЖО',
    archiveName: 'Державний архів Житомирської області',
    hasDigitalScans: true,
    yearsRange: '1795–1920',
    notes: 'Волинська духовна консисторія, метрики шляхти та селян'
  },
  {
    id: '8',
    name: 'Лубни',
    historicalName: 'Лубны',
    type: 'місто',
    volost: 'Лубенська',
    district: 'Лубенський повіт',
    gubernia: 'Полтавська губернія',
    churchName: 'Різдва Богородиці, Троїцька, Воскресенська церква',
    fondCode: 'Фонд 706, 1011',
    archiveCode: 'ДАПО',
    archiveName: 'Державний архів Полтавської області',
    hasDigitalScans: true,
    yearsRange: '1750–1920',
    notes: 'Козацькі родовідні книги Лубенського козацького полку'
  },
  {
    id: '9',
    name: 'Балта',
    historicalName: 'Балта',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Балтський повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Миколаївський собор, Успенська церква',
    fondCode: 'Фонд 315, 37',
    archiveCode: 'ДАХмО / ДАОО',
    archiveName: 'ДАХмО та Держ. архів Одеської області',
    hasDigitalScans: true,
    yearsRange: '1797–1920',
    notes: 'Прикордонні землі Поділля та Новоросії'
  },
  {
    id: '10',
    name: 'Вінниця',
    historicalName: 'Винница',
    type: 'місто',
    volost: 'Центр повіту',
    district: 'Вінницький повіт',
    gubernia: 'Подільська губернія',
    churchName: 'Преображенський собор, Воскресенська, Миколаївська церква',
    fondCode: 'Фонд 315, 200',
    archiveCode: 'ДАВіО / ДАХмО',
    archiveName: 'Держ. архів Вінницької області та ДАХмО',
    hasDigitalScans: true,
    yearsRange: '1796–1922',
    notes: 'Метричні книги міщанських та шляхетських родин Поділля'
  }
];

interface NyshporkaGazetteerProps {
  theme: any;
  onOpenViewer?: () => void;
}

export const NyshporkaGazetteer: React.FC<NyshporkaGazetteerProps> = ({ theme, onOpenViewer }) => {
  const [query, setQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return SAMPLE_GAZETTEER.filter(item => {
      const matchDistrict = districtFilter === 'ALL' || item.district.includes(districtFilter);
      const matchQuery = !q || 
        item.name.toLowerCase().includes(q) ||
        (item.historicalName && item.historicalName.toLowerCase().includes(q)) ||
        item.district.toLowerCase().includes(q) ||
        item.churchName.toLowerCase().includes(q) ||
        item.gubernia.toLowerCase().includes(q);
      return matchDistrict && matchQuery;
    });
  }, [query, districtFilter]);

  const districts = ['ALL', 'Балтський', 'Кам’янецький', 'Проскурівський', 'Васильківський', 'Лубенський', 'Житомирський', 'Вінницький'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-bold ${theme.cardTitle} flex items-center gap-2`}>
          <MapPin className="w-5 h-5 text-rose-500" />
          Газетир: де шукати моє село
        </h2>
        <p className={`text-xs ${theme.cardSubtext} mt-0.5`}>
          Географічний довідник історичних населених пунктів, парафій та збереженості метричних фондів
        </p>
      </div>

      {/* Search & Filters */}
      <div className={`p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} flex flex-col sm:flex-row items-center gap-3 shadow-sm`}>
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть назву села або містечка (напр. Липовеньке, Голованівськ, Проскурів)..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-medium text-neutral-400 shrink-0">Повіт:</span>
          {districts.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDistrictFilter(d)}
              className={`px-2.5 py-1 text-xs rounded-lg whitespace-nowrap font-medium transition-colors cursor-pointer ${
                districtFilter === d
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {d === 'ALL' ? 'Всі повіти' : d}
            </button>
          ))}
        </div>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(item => (
          <div
            key={item.id}
            className={`p-5 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-sm`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                      {item.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      {item.type}
                    </span>
                  </div>
                  {item.historicalName && (
                    <div className="text-[11px] font-serif text-neutral-500 dark:text-neutral-400 italic">
                      Історичне написання: {item.historicalName}
                    </div>
                  )}
                </div>

                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {item.yearsRange}
                </span>
              </div>

              {/* Administrative hierarchy */}
              <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800/80">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span><strong>Повіт:</strong> {item.district} · <strong>Губернія:</strong> {item.gubernia}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Church className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span><strong>Церква / Парафія:</strong> {item.churchName}</span>
                </div>
              </div>

              {/* Archival Fund details */}
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
                  <Building2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Архів: <strong>{item.archiveCode}</strong> ({item.archiveName})</span>
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pl-5">
                  Зберігається в: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.fondCode}</span>
                </div>
              </div>

              {item.notes && (
                <p className={`text-[11px] ${theme.cardSubtext} italic pl-5`}>
                  {item.notes}
                </p>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 mt-3 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Є оцифровані скани
              </span>

              {item.name === 'Липовеньке' && onOpenViewer && (
                <button
                  type="button"
                  onClick={onOpenViewer}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Читати справу села
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
