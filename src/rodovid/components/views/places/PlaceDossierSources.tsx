/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ScrollText, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Edit3, 
  FolderArchive, 
  Search, 
  Check, 
  Calendar,
  Layers,
  X,
  Globe
} from 'lucide-react';
import { PlaceDossier, PlaceSourceLink } from '../../../../types';
import { ThemeConfig } from '../../../../utils/theme';

interface PlaceDossierSourcesProps {
  placeName: string;
  dossier: PlaceDossier | undefined;
  onSave: (updated: PlaceDossier) => void;
  theme: ThemeConfig;
  isDark: boolean;
}

const PRESET_ARCHIVES = [
  'FamilySearch',
  'ЦДІАК України',
  'ЦДІАЛ України',
  'ДАКО (Київська обл.)',
  'ДАЖО (Житомирська обл.)',
  'ДАХО (Харківська обл.)',
  'ДАЧО (Черкаська обл.)',
  'ДАВіО (Вінницька обл.)',
  'ДАПО (Полтавська обл.)',
  'Держархів області'
];

export const PlaceDossierSources: React.FC<PlaceDossierSourcesProps> = ({
  placeName,
  dossier,
  onSave,
  theme,
  isDark
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [archive, setArchive] = useState('');
  const [archiveRef, setArchiveRef] = useState('');
  const [years, setYears] = useState('');
  const [description, setDescription] = useState('');

  const links = dossier?.sourceLinks || [];

  const handleOpenAdd = () => {
    setEditingId(null);
    setTitle('');
    setUrl('');
    setArchive('');
    setArchiveRef('');
    setYears('');
    setDescription('');
    setIsAdding(true);
  };

  const handleOpenEdit = (link: PlaceSourceLink) => {
    setEditingId(link.id);
    setTitle(link.title);
    setUrl(link.url);
    setArchive(link.archive || '');
    setArchiveRef(link.archiveRef || '');
    setYears(link.years || '');
    setDescription(link.description || '');
    setIsAdding(true);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let updatedUrl = url.trim();
    if (updatedUrl && !updatedUrl.startsWith('http://') && !updatedUrl.startsWith('https://')) {
      updatedUrl = 'https://' + updatedUrl;
    }

    const newLink: PlaceSourceLink = {
      id: editingId || `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      url: updatedUrl,
      archive: archive.trim() || undefined,
      archiveRef: archiveRef.trim() || undefined,
      years: years.trim() || undefined,
      description: description.trim() || undefined
    };

    let nextLinks: PlaceSourceLink[];
    if (editingId) {
      nextLinks = links.map((item) => (item.id === editingId ? newLink : item));
    } else {
      nextLinks = [newLink, ...links];
    }

    const updatedDossier: PlaceDossier = {
      id: dossier?.id || placeName.trim(),
      placeName: dossier?.placeName || placeName.trim(),
      historicalName: dossier?.historicalName,
      district: dossier?.district,
      parishChurch: dossier?.parishChurch,
      historyText: dossier?.historyText,
      notes: dossier?.notes,
      sourceLinks: nextLinks,
      updatedAt: new Date().toISOString()
    };

    onSave(updatedDossier);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleDeleteLink = (linkId: string) => {
    const nextLinks = links.filter((l) => l.id !== linkId);
    const updatedDossier: PlaceDossier = {
      id: dossier?.id || placeName.trim(),
      placeName: dossier?.placeName || placeName.trim(),
      historicalName: dossier?.historicalName,
      district: dossier?.district,
      parishChurch: dossier?.parishChurch,
      historyText: dossier?.historyText,
      notes: dossier?.notes,
      sourceLinks: nextLinks,
      updatedAt: new Date().toISOString()
    };
    onSave(updatedDossier);
  };

  const fsCatalogSearchUrl = `https://www.familysearch.org/search/catalog/results?count=20&placeId=&query=%2Bplace%3A%22${encodeURIComponent(placeName)}%22`;
  const cdiakSearchUrl = `https://cdiak.archives.gov.ua/baza_geog_pok/`;

  return (
    <div className="space-y-6">
      {/* Archival Portals Quick Search Bar */}
      <div className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} flex flex-wrap items-center justify-between gap-3 shadow-xs`}>
        <div className="flex items-center gap-2">
          <FolderArchive className="w-4 h-4 text-amber-500 shrink-0" />
          <span className={`text-xs font-semibold ${theme.textPrimary}`}>
            Пошук онлайн-метрики та сканів для «{placeName}»:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={fsCatalogSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            <Search className="w-3 h-3 text-amber-500" />
            <span>Каталог FamilySearch</span>
          </a>
          <a
            href={cdiakSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textPrimary} transition-colors`}
          >
            <Globe className="w-3 h-3 text-amber-500" />
            <span>Зведений каталог ЦДІАК</span>
          </a>
        </div>
      </div>

      {/* Header and Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme.textMuted} flex items-center gap-2`}>
            <ScrollText className="w-4 h-4 text-amber-500" />
            <span>Збережені онлайн-джерела та метричні книги ({links.length})</span>
          </h4>
          <p className={`text-[11px] ${theme.textMuted} mt-0.5`}>
            Посилання на оцифровані справи, плівки FamilySearch, ревізькі казки та сповідні розписи
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Додати посилання</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form Card */}
      {isAdding && (
        <form
          onSubmit={handleSaveLink}
          className={`p-5 rounded-2xl ${theme.cardBg} border-2 border-amber-500/50 space-y-4 shadow-sm`}
        >
          <div className="flex items-center justify-between border-b pb-3 border-neutral-200 dark:border-neutral-800">
            <span className={`text-xs font-bold ${theme.textPrimary}`}>
              {editingId ? 'Редагувати посилання на метрику / документ' : 'Нове посилання на онлайн-метрики'}
            </span>
            <button
              type="button"
              onClick={handleCancelForm}
              className={`p-1 rounded-lg ${theme.textMuted} hover:${theme.textPrimary}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                Назва документа чи книги *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="напр. Метрична книга церкви Різдва Богородиці (народження, шлюби, смерті)"
                className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
              />
            </div>

            <div className="md:col-span-2">
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                Пряме посилання (URL на FamilySearch, сайт архіву чи хмару)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.familysearch.org/ark:/61903/3:1:... або https://..."
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                Архів / Зібрання
              </label>
              <input
                type="text"
                value={archive}
                onChange={(e) => setArchive(e.target.value)}
                placeholder="напр. FamilySearch, ЦДІАК, ДАКО"
                className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PRESET_ARCHIVES.slice(0, 4).map((arch) => (
                  <button
                    key={arch}
                    type="button"
                    onClick={() => setArchive(arch)}
                    className={`text-[10px] px-2 py-0.5 rounded-md ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textMuted} hover:${theme.textPrimary} transition-colors`}
                  >
                    {arch.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                  Фонд / Опис / Справа
                </label>
                <input
                  type="text"
                  value={archiveRef}
                  onChange={(e) => setArchiveRef(e.target.value)}
                  placeholder="Ф. 127, Оп. 1012, Спр. 2351"
                  className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                  Роки
                </label>
                <input
                  type="text"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  placeholder="1795–1862"
                  className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary}`}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                Примітки для дослідника (номери кадрів, якість скану, зміст)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="напр. Село Попільня з кадру 154 по 280. Добре збережені записи про шлюб. Пропущено 1821 рік."
                className={`w-full px-3 py-2 rounded-xl text-xs ${theme.surfaceBg} border ${theme.borderSubtle} focus:border-amber-500 focus:outline-hidden ${theme.textPrimary} resize-y`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={handleCancelForm}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium ${theme.surfaceBg} border ${theme.borderSubtle} ${theme.textMuted} hover:${theme.textPrimary}`}
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer"
            >
              {editingId ? 'Оновити посилання' : 'Додати в список'}
            </button>
          </div>
        </form>
      )}

      {/* Links List */}
      {links.length > 0 ? (
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className={`p-4 rounded-xl ${theme.cardBg} border ${theme.cardBorder} hover:border-amber-500/50 transition-all shadow-xs space-y-2`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {link.archive && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                        {link.archive}
                      </span>
                    )}
                    {link.years && (
                      <span className={`text-[11px] font-mono ${theme.textMuted} flex items-center gap-1`}>
                        <Calendar className="w-3 h-3" />
                        <span>{link.years}</span>
                      </span>
                    )}
                    {link.archiveRef && (
                      <span className={`text-[11px] font-mono ${theme.textMuted} flex items-center gap-1`}>
                        <Layers className="w-3 h-3" />
                        <span>{link.archiveRef}</span>
                      </span>
                    )}
                  </div>

                  <h5 className={`font-semibold text-xs ${theme.textPrimary}`}>
                    {link.title}
                  </h5>

                  {link.description && (
                    <p className={`text-[11px] ${theme.textMuted} leading-relaxed pt-0.5`}>
                      {link.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {link.url && (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors"
                      title="Відкрити скани в новій вкладці"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Відкрити скани</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenEdit(link)}
                    className={`p-1.5 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-amber-500 ${theme.textMuted} hover:${theme.textPrimary} transition-colors`}
                    title="Редагувати"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className={`p-1.5 rounded-lg ${theme.surfaceBg} border ${theme.borderSubtle} hover:border-rose-500 hover:text-rose-500 ${theme.textMuted} transition-colors`}
                    title="Видалити"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isAdding && (
          <div className={`p-8 text-center rounded-2xl ${theme.cardBg} border ${theme.cardBorder} space-y-3`}>
            <ScrollText className="w-8 h-8 mx-auto opacity-40 text-amber-500" />
            <div className="space-y-1">
              <p className={`text-xs font-semibold ${theme.textPrimary}`}>
                Ще немає доданих посилань на метрики для «{placeName}»
              </p>
              <p className={`text-[11px] ${theme.textMuted}`}>
                Збережіть прямі лінки на оцифровані справи FamilySearch або електронні описи архівів, щоб швидко відкривати їх під час досліджень.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Додати перше посилання</span>
            </button>
          </div>
        )
      )}
    </div>
  );
};
