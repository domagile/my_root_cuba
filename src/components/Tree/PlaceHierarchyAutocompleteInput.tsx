/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Building2, Landmark, Check } from 'lucide-react';
import {
  PlaceSuggestionItem,
  buildPlaceSuggestionsIndex,
  searchPlaceSuggestions
} from '../../utils/placeHierarchyAutocomplete';
import { Person, MetricRecord } from '../../types';

interface PlaceHierarchyAutocompleteInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  historicalValue?: string;
  onHistoricalChange?: (val: string) => void;
  persons: Person[];
  metricRecords?: MetricRecord[];
  placeholder?: string;
  theme: any;
  isDark: boolean;
  showHistoricalToggle?: boolean;
}

export const PlaceHierarchyAutocompleteInput: React.FC<PlaceHierarchyAutocompleteInputProps> = ({
  id,
  label,
  value,
  onChange,
  historicalValue = '',
  onHistoricalChange,
  persons,
  metricRecords,
  placeholder = 'напр. с. Мошни, Черкаський повіт, Київська губернія',
  theme,
  isDark,
  showHistoricalToggle = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoricalField, setShowHistoricalField] = useState(Boolean(historicalValue));
  const containerRef = useRef<HTMLDivElement>(null);

  const placeIndex = useMemo(() => {
    return buildPlaceSuggestionsIndex(persons, metricRecords);
  }, [persons, metricRecords]);

  const filteredSuggestions = useMemo(() => {
    return searchPlaceSuggestions(placeIndex, value, 6);
  }, [placeIndex, value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item: PlaceSuggestionItem) => {
    onChange(item.fullName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={`block text-xs font-semibold ${theme.textPrimary}`}>
          {label}
        </label>
        {showHistoricalToggle && onHistoricalChange && (
          <button
            type="button"
            onClick={() => setShowHistoricalField(!showHistoricalField)}
            className="text-[11px] text-amber-500 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Landmark className="w-3 h-3" />
            <span>{showHistoricalField ? 'Приховати історичну назву' : '+ Історична назва'}</span>
          </button>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
          <MapPin className="w-3.5 h-3.5" />
        </div>
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg border transition-all ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
        />
      </div>

      {/* Historical Place input if toggled */}
      {showHistoricalField && onHistoricalChange && (
        <div className="pt-1">
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-500 mb-1">
            <Landmark className="w-3 h-3" />
            <span>Історична назва на момент події (з метрики / ревізії)</span>
          </div>
          <input
            type="text"
            id={`${id}_historical`}
            value={historicalValue}
            onChange={(e) => onHistoricalChange(e.target.value)}
            placeholder="напр. Проскурів, Подільська губ."
            className={`w-full px-3 py-1.5 text-xs rounded-lg border transition-all ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} focus:outline-hidden focus:ring-1 focus:ring-amber-500`}
          />
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl overflow-hidden max-h-56 overflow-y-auto ${
            isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="p-1.5 space-y-0.5">
            <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>
              Населені пункти родоводу ({filteredSuggestions.length})
            </div>
            {filteredSuggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectSuggestion(item)}
                className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-2 text-xs ${
                  isDark ? 'hover:bg-neutral-800' : 'hover:bg-amber-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-xs flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{item.fullName}</span>
                  </div>
                  {item.hierarchy?.regionOrGubernia && (
                    <div className={`text-[10px] ${theme.textMuted} pl-5 pt-0.5`}>
                      {item.hierarchy.districtOrUyezd ? `${item.hierarchy.districtOrUyezd}, ` : ''}
                      {item.hierarchy.regionOrGubernia}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    {item.usageCount} {item.usageCount === 1 ? 'особа' : 'осіб'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
