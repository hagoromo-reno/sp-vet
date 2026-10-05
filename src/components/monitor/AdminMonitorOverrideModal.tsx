import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Wind,
  Heart,
  RotateCcw,
  X,
  CheckCircle,
  AlertTriangle,
  Flame,
  Info,
  Sliders,
} from 'lucide-react';
import type {
  AdminCapnographyOverride,
  AdminECGOverride,
  AdminMonitorOverrides,
  AdminOximetryOverride,
} from '../../types/simulator';
import {
  ECG_OVERRIDE_OPTIONS,
  CAPNOGRAPHY_OVERRIDE_OPTIONS,
  OXIMETRY_OVERRIDE_OPTIONS,
} from '../../engine/adminMonitorProfile';

interface AdminMonitorOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  overrides: AdminMonitorOverrides;
  onUpdateOverrides: (newOverrides: AdminMonitorOverrides) => void;
}

export const AdminMonitorOverrideModal: React.FC<AdminMonitorOverrideModalProps> = ({
  isOpen,
  onClose,
  overrides,
  onUpdateOverrides,
}) => {
  const [activeTab, setActiveTab] = useState<'ecg' | 'capno' | 'pleth'>('ecg');
  const [ecgCategoryFilter, setEcgCategoryFilter] = useState<string>('todos');

  if (!isOpen) return null;

  const hasAnyOverride =
    overrides.ecg !== 'auto' ||
    overrides.capnography !== 'auto' ||
    overrides.oximetry !== 'auto';

  const handleSetECG = (id: AdminECGOverride) => {
    onUpdateOverrides({ ...overrides, ecg: id });
  };

  const handleSetCapno = (id: AdminCapnographyOverride) => {
    onUpdateOverrides({ ...overrides, capnography: id });
  };

  const handleSetOximetry = (id: AdminOximetryOverride) => {
    onUpdateOverrides({ ...overrides, oximetry: id });
  };

  const handleResetAll = () => {
    onUpdateOverrides({
      ecg: 'auto',
      capnography: 'auto',
      oximetry: 'auto',
    });
  };

  const ecgCategories = [
    'todos',
    'Normal',
    'Sinusal',
    'Arritmias Ventriculares',
    'Arritmias Supraventriculares',
    'Bloqueios AV',
    'Isquemia / ST-T',
    'Distúrbios Eletrolíticos',
  ];

  const filteredECG = ECG_OVERRIDE_OPTIONS.filter((opt) => {
    if (ecgCategoryFilter === 'todos') return true;
    return opt.category.toLowerCase() === ecgCategoryFilter.toLowerCase();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0c10] border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-zinc-950 via-[#131620] to-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300 shadow-sm shadow-purple-950/50">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-100 tracking-wide">
                  Menu do Administrador & Instrutor · Perfis do Monitor
                </h2>
                {hasAnyOverride && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-500/80 text-amber-300 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    Perfil Forçado Ativo
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Altere ou force em tempo real o traçado de ECG, Capnografia e Oximetria para treino prático de situações clínicas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasAnyOverride && (
              <button
                onClick={handleResetAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 flex items-center gap-1.5 transition cursor-pointer"
                title="Desativar todas as alterações forçadas e retornar à fisiologia real"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Restaurar Fisiologia</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Channel Navigation Tabs */}
        <div className="px-5 pt-3 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('ecg')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition border-t border-x cursor-pointer ${
                activeTab === 'ecg'
                  ? 'bg-[#0f1d15] border-emerald-500/60 text-emerald-300 shadow-[0_-2px_10px_rgba(16,185,129,0.15)]'
                  : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>1. ECG / Eletrocardiograma</span>
              {overrides.ecg !== 'auto' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('capno')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition border-t border-x cursor-pointer ${
                activeTab === 'capno'
                  ? 'bg-[#1e190b] border-amber-500/60 text-amber-300 shadow-[0_-2px_10px_rgba(245,158,11,0.15)]'
                  : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <Wind className="w-4 h-4 text-amber-400" />
              <span>2. Capnógrafo & Capnometria</span>
              {overrides.capnography !== 'auto' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('pleth')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-t-xl transition border-t border-x cursor-pointer ${
                activeTab === 'pleth'
                  ? 'bg-[#0a1820] border-cyan-500/60 text-cyan-300 shadow-[0_-2px_10px_rgba(6,182,212,0.15)]'
                  : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <Heart className="w-4 h-4 text-cyan-400" />
              <span>3. Oximetria & Pletismografia</span>
              {overrides.oximetry !== 'auto' && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              )}
            </button>
          </div>

          <div className="text-[11px] font-mono-code text-zinc-400 hidden md:flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-zinc-500" />
            <span>Perfil Ativo: </span>
            <strong className="text-zinc-200">
              ECG ({overrides.ecg}) · Capno ({overrides.capnography}) · Pleth ({overrides.oximetry})
            </strong>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ECG */}
          {activeTab === 'ecg' && (
            <div className="space-y-3">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {ecgCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setEcgCategoryFilter(cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                      ecgCategoryFilter.toLowerCase() === cat.toLowerCase()
                        ? 'bg-emerald-950 border border-emerald-500 text-emerald-200 shadow-sm'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {cat === 'todos' ? 'Todos os Ritmos' : cat}
                  </button>
                ))}
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredECG.map((opt) => {
                  const isSelected = overrides.ecg === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSetECG(opt.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#0f241a] border-emerald-400 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-400/40'
                          : 'bg-[#101216] border-zinc-800/80 hover:border-zinc-600 hover:bg-[#15181f]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100">{opt.title}</span>
                            {opt.badge && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            {opt.subtitle}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1 italic text-zinc-400">
                          <Info className="w-3 h-3 text-emerald-400/70" />
                          {opt.clinicalNote}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono text-[9px]">
                          {opt.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CAPNOGRAFIA */}
          {activeTab === 'capno' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Selecione os padrões capnográficos fundamentais em anestesiologia veterinária para forçar a morfologia da onda no monitor e treinar o reconhecimento de assincronias e patologias.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAPNOGRAPHY_OVERRIDE_OPTIONS.map((opt) => {
                  const isSelected = overrides.capnography === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSetCapno(opt.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#291f09] border-amber-400 shadow-md shadow-amber-950/60 ring-1 ring-amber-400/40'
                          : 'bg-[#101216] border-zinc-800/80 hover:border-zinc-600 hover:bg-[#15181f]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-100">{opt.title}</span>
                            {opt.badge && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-900 border border-amber-700/60 text-amber-300">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                            {opt.subtitle}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1 italic text-zinc-400">
                          <Info className="w-3 h-3 text-amber-400/70" />
                          {opt.clinicalNote}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono text-[9px]">
                          {opt.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: OXIMETRIA & PLETISMOGRAFIA */}
          {activeTab === 'pleth' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-200">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Configure a curva pletismográfica e perfusão periférica (PI). O modelo normal foi ajustado com cinética de transporte bioquímico de O2 e wash-in gradual ao entubar.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {OXIMETRY_OVERRIDE_OPTIONS.map((opt) => {
                  const isSelected = overrides.oximetry === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSetOximetry(opt.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#0a212c] border-cyan-400 shadow-md shadow-cyan-950/60 ring-1 ring-cyan-400/40'
                          : 'bg-[#101216] border-zinc-800/80 hover:border-zinc-600 hover:bg-[#15181f]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100">{opt.title}</span>
                            {opt.badge && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 border border-cyan-700/60 text-cyan-300">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {opt.subtitle}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                        <span className="flex items-center gap-1 italic text-zinc-300">
                          <Info className="w-3.5 h-3.5 text-cyan-400/70" />
                          {opt.clinicalNote}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono text-[10px]">
                          {opt.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Alterações aplicadas instantaneamente no monitor de sinais vitais e traçados contínuos</span>
          </div>

          <div className="flex items-center space-x-2">
            {hasAnyOverride && (
              <button
                onClick={handleResetAll}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition cursor-pointer"
              >
                Limpar Todos os Overrides
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition shadow-sm shadow-emerald-950 cursor-pointer"
            >
              Concluir & Retornar ao Monitor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
