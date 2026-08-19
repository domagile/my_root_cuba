import React, { useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileCode,
  CheckCircle2,
  RefreshCw,
  FolderOpen,
  Sparkles,
  TreeDeciduous
} from 'lucide-react';
import { GenealogyDatabase } from '../../types/genealogy';
import { parseGedcom, exportToGedcom } from '../../utils/gedcom';
import { SAMPLE_DATABASE } from '../../data/sampleData';

interface GedcomModalProps {
  database: GenealogyDatabase;
  onClose: () => void;
  onImportDatabase: (newDb: GenealogyDatabase) => void;
}

export const GedcomModal: React.FC<GedcomModalProps> = ({
  database,
  onClose,
  onImportDatabase
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'presets'>('import');
  const [pastedGedcom, setPastedGedcom] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(text);
          onImportDatabase(parsedJson);
          setImportStatus(`Успішно завантажено базу JSON: ${parsedJson.title}`);
        } else {
          const parsedDb = parseGedcom(text);
          onImportDatabase(parsedDb);
          setImportStatus(`Успішно імпортовано GEDCOM: ${Object.keys(parsedDb.persons).length} осіб.`);
        }
      } catch (err: any) {
        setImportStatus(`Помилка під час читання файлу: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleImportPasted = () => {
    if (!pastedGedcom.trim()) return;
    try {
      const parsedDb = parseGedcom(pastedGedcom);
      onImportDatabase(parsedDb);
      setImportStatus(`Успішно імпортовано GEDCOM: ${Object.keys(parsedDb.persons).length} осіб.`);
      setPastedGedcom('');
    } catch (err: any) {
      setImportStatus(`Помилка під час парсингу: ${err.message}`);
    }
  };

  // Download GEDCOM file
  const handleDownloadGedcom = () => {
    const gedcomContent = exportToGedcom(database);
    const blob = new Blob([gedcomContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gramps_Family_Tree_${new Date().toISOString().slice(0, 10)}.ged`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download JSON backup
  const handleDownloadJson = () => {
    const jsonContent = JSON.stringify(database, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gramps_Database_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load presets
  const handleLoadSample = (sampleType: 'morozov' | 'romanov') => {
    if (sampleType === 'morozov') {
      onImportDatabase(SAMPLE_DATABASE);
      setImportStatus('Завантажено архів Морозових — Волкових');
    } else if (sampleType === 'romanov') {
      const romanovDb: GenealogyDatabase = {
        title: 'Династія Романових (XIX–XX ст.)',
        description: 'Гілки Олександра II, Олександра III та Миколи II з історичними джерелами.',
        lastModified: new Date().toISOString(),
        grampsCompatibilityVersion: '5.1.6',
        rootPersonId: 'R0001',
        events: {},
        sources: {
          'SR01': {
            id: 'SR01',
            title: 'Державний архів Російської Федерації (ГАРФ)',
            archiveReference: 'Фонд 601 (Імператор Микола II)',
            notes: 'Щоденники та листування членів імператорської родини.'
          }
        },
        places: {
          'PR01': {
            id: 'PR01',
            name: 'Санкт-Петербург, Зимовий палац',
            country: 'Росія',
            region: 'Санкт-Петербурзька губ.'
          }
        },
        persons: {
          'R0001': {
            id: 'R0001',
            name: { given: 'Микола', patronymic: 'Олександрович', surname: 'Романов', prefix: 'Імператор' },
            gender: 'M',
            isLiving: false,
            birthDate: '18.05.1868',
            birthYear: 1868,
            birthPlace: 'Царське Село',
            deathDate: '17.07.1918',
            deathYear: 1918,
            deathPlace: 'Єкатеринбург',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
            occupation: 'Імператор Всеросійський',
            events: [],
            parentFamilyId: 'FR01',
            spouseFamilyIds: ['FR02']
          },
          'R0002': {
            id: 'R0002',
            name: { given: 'Олександра', patronymic: 'Федорівна', surname: 'Романова', prefix: 'Імператриця', maidenName: 'Гессен-Дармштадтська' },
            gender: 'F',
            isLiving: false,
            birthDate: '06.06.1872',
            birthYear: 1872,
            deathDate: '17.07.1918',
            deathYear: 1918,
            events: [],
            spouseFamilyIds: ['FR02']
          },
          'R0003': {
            id: 'R0003',
            name: { given: 'Олександр', patronymic: 'Олександрович', surname: 'Романов', prefix: 'Імператор Олександр III' },
            gender: 'M',
            isLiving: false,
            birthDate: '10.03.1845',
            birthYear: 1845,
            deathDate: '01.11.1894',
            deathYear: 1894,
            events: [],
            spouseFamilyIds: ['FR01']
          },
          'R0004': {
            id: 'R0004',
            name: { given: 'Марія', patronymic: 'Федорівна', surname: 'Романова', prefix: 'Імператриця', maidenName: 'Дагмар Данська' },
            gender: 'F',
            isLiving: false,
            birthDate: '26.11.1847',
            birthYear: 1847,
            deathDate: '13.10.1928',
            deathYear: 1928,
            events: [],
            spouseFamilyIds: ['FR01']
          },
          'R0005': {
            id: 'R0005',
            name: { given: 'Олексій', patronymic: 'Миколайович', surname: 'Романов', prefix: 'Цесаревич' },
            gender: 'M',
            isLiving: false,
            birthDate: '12.08.1904',
            birthYear: 1904,
            deathDate: '17.07.1918',
            deathYear: 1918,
            events: [],
            parentFamilyId: 'FR02',
            spouseFamilyIds: []
          },
          'R0006': {
            id: 'R0006',
            name: { given: 'Ольга', patronymic: 'Миколаївна', surname: 'Романова', prefix: 'Велика княжна' },
            gender: 'F',
            isLiving: false,
            birthDate: '15.11.1895',
            birthYear: 1895,
            deathDate: '17.07.1918',
            deathYear: 1918,
            events: [],
            parentFamilyId: 'FR02',
            spouseFamilyIds: []
          }
        },
        families: {
          'FR01': {
            id: 'FR01',
            husbandId: 'R0003',
            wifeId: 'R0004',
            relationshipType: 'Married',
            children: [{ personId: 'R0001', relationType: 'Biological' }],
            events: []
          },
          'FR02': {
            id: 'FR02',
            husbandId: 'R0001',
            wifeId: 'R0002',
            relationshipType: 'Married',
            marriageDate: '26.11.1894',
            marriageYear: 1894,
            marriagePlace: 'Санкт-Петербург, Зимовий палац',
            children: [
              { personId: 'R0005', relationType: 'Biological' },
              { personId: 'R0006', relationType: 'Biological' }
            ],
            events: []
          }
        },
        events: {}
      };
      onImportDatabase(romanovDb);
      setImportStatus('Завантажено історичну династію Романових');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Імпорт / Експорт GEDCOM та резервні копії
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'import'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Імпорт (.ged / .json)
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Експорт бази
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'presets'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Готові демо-дерева
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {importStatus && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* File upload drag drop box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Завантажте файл GEDCOM (.ged) або резервну копію JSON:
                </label>
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-colors">
                  <Upload className="w-8 h-8 text-emerald-400 mb-2" />
                  <span className="text-xs font-medium text-slate-200">
                    Оберіть файл .ged або .json на комп'ютері
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Підтримуються експорти з Gramps, MyHeritage, Дерево Життя, FamilySearch
                  </span>
                  <input
                    type="file"
                    accept=".ged,.gedcom,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Paste GEDCOM text directly */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Або вставте текст GEDCOM вручну:
                </label>
                <textarea
                  rows={4}
                  value={pastedGedcom}
                  onChange={(e) => setPastedGedcom(e.target.value)}
                  placeholder="0 HEAD&#10;1 SOUR GRAMPS...&#10;0 @I1@ INDI&#10;1 NAME Іван /Іванов/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleImportPasted}
                  disabled={!pastedGedcom.trim()}
                  className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                >
                  Розпізнати та імпортувати
                </button>
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Ви можете зберегти своє дерево у стандартному форматі GEDCOM 5.5.1 (для відкриття у
                десктопному Gramps або мобільних додатках) або у вигляді повного JSON-файлу для
                резервного копіювання.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadGedcom}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-left transition-colors space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400">
                      Завантажити GEDCOM (.ged)
                    </span>
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Міжнародний стандарт 5.5.1. Відкривається у Gramps Desktop, MyHeritage, Дерево Життя.
                  </p>
                </button>

                <button
                  onClick={handleDownloadJson}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-left transition-colors space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400">
                      Завантажити JSON Backup
                    </span>
                    <Download className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Повна база з усіма архівними цитатами, фотографіями, нотатками та координатами місць.
                  </p>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Демонстраційні родові архіви:
              </span>

              <div
                onClick={() => handleLoadSample('morozov')}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-white">
                    Рід Морозових — Волкових (1825–2000)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">15 осіб • 8 сімей</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Метричні записи, ревізькі казки, купці, офіцери та блокадні документи Ленинграда.
                </p>
              </div>

              <div
                onClick={() => handleLoadSample('romanov')}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-white">
                    Династія Романових (XIX–XX ст.)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono">Імператорський дім</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Гілка Олександра II, Олександра III та Миколи II з архівними фондами ГАРФ.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
