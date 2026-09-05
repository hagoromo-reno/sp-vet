import React from 'react';
import { PatientProfile, VitalSigns } from '../../types/simulator';
import { AlertTriangle, ShieldCheck, Sparkles, X, Syringe, Skull } from 'lucide-react';
import { formatSpecies } from '../../utils/formatters';

interface LaryngealReflexModalProps {
  isOpen: boolean;
  patient: PatientProfile;
  vitals: VitalSigns;
  tubeSizeMm: number;
  onClose: () => void;
  onApplyLidocaineSpray: () => void;
  onForceIntubation: () => void;
  onOpenDrugAdministration: () => void;
}

export const LaryngealReflexModal: React.FC<LaryngealReflexModalProps> = ({
  isOpen,
  patient,
  vitals,
  tubeSizeMm,
  onClose,
  onApplyLidocaineSpray,
  onForceIntubation,
  onOpenDrugAdministration,
}) => {
  if (!isOpen) return null;

  const isFeline = patient.species === 'feline';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f0f14] border-2 border-amber-600/70 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-[#1c1308] to-[#0f0f14] p-4 border-b border-amber-800/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/80 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-amber-100 uppercase tracking-wide">
                Reflexo Laringotraqueal Ativo Detectado
              </h3>
              <p className="text-[11px] text-amber-300/80">
                {isFeline
                  ? 'Alto Risco de Laringoespasmo Reativo & Fechamento de Glote (Espécie Felina)'
                  : 'Tônus mandibular aumentado e reflexo protetor de tosse/deglutição'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1a1a1a] text-[#a3a3a3] hover:text-white hover:bg-[#262626] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 text-xs text-[#d4d4d4]">
          {/* Clinical Alert Box */}
          <div className="p-3 rounded-xl bg-[#1c1208] border border-amber-700/60 text-amber-200">
            <p className="leading-relaxed">
              O paciente <strong>{patient.name}</strong> ({formatSpecies(patient.species).toUpperCase()}) apresenta{' '}
              <strong className="text-amber-100">tônus mandibular &quot;{vitals.jawTone}&quot;</strong> e escore de profundidade anestésica de{' '}
              <strong className="text-amber-100">{vitals.anestheticDepthScore}%</strong>. A introdução direta da sonda endotraqueal #{tubeSizeMm} mm sem dessensibilização causará estimulação vagal intensa e reflexo protetor de oclusão.
            </p>
          </div>

          {/* Clinical Action Choices */}
          <div className="space-y-2.5">
            {/* 1. Recommended: Topical Lidocaine 2% */}
            <button
              onClick={onApplyLidocaineSpray}
              className="w-full p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/80 to-[#0e2316] border border-emerald-600/80 hover:border-emerald-400 text-left transition flex items-start space-x-3 group shadow-lg"
            >
              <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400 shrink-0 mt-0.5 group-hover:scale-105 transition">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-emerald-200 uppercase tracking-wide">
                    (Recomendado) Spray Tópico de Lidocaína 2%
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-800/80 text-emerald-100 font-mono font-bold">
                    Dessensibilização Imediata
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-1">
                  Instilação tópica de 0,1 mL de Lidocaína 2% sobre as cartilagens aritenoides. Bloqueia os ramos aferentes do nervo laríngeo e relaxa as cordas vocais, permitindo intubação suave sem laringoespasmo.
                </p>
              </div>
            </button>

            {/* 2. Deepen Anesthetic Plane */}
            <button
              onClick={onOpenDrugAdministration}
              className="w-full p-3.5 rounded-xl bg-[#14121a] border border-purple-800/60 hover:border-purple-600 text-left transition flex items-start space-x-3 group"
            >
              <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 shrink-0 mt-0.5 group-hover:scale-105 transition">
                <Syringe className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-purple-200 uppercase">
                    Aprofundar Plano Anestésico (Bólus Indutor)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/80 text-purple-200 font-mono">
                    Farmacológico
                  </span>
                </div>
                <p className="text-[11px] text-purple-300/80 mt-1">
                  Administrar bólus complementar de hipnótico (ex: Propofol 1-2 mg/kg ou Alfaxalona) para atingir o Estágio III (plano cirúrgico com relaxamento mandibular completo).
                </p>
              </div>
            </button>

            {/* 3. Force Intubation */}
            <button
              onClick={onForceIntubation}
              className="w-full p-3 rounded-xl bg-[#1a0c0e] border border-red-900/50 hover:border-red-700/80 text-left transition flex items-start space-x-3 group"
            >
              <div className="p-2 rounded-lg bg-red-600/20 text-red-400 shrink-0 mt-0.5 group-hover:scale-105 transition">
                <Skull className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-red-300 uppercase">
                    Forçar Intubação sem Dessensibilização
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-mono">
                    Risco de Trauma
                  </span>
                </div>
                <p className="text-[11px] text-red-400/80 mt-1">
                  Tentativa forçada com glote em fechamento reflexo. Risco de laceração aritenoide, edema laríngeo agudo e bradicardia vagal reflexa.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#0a0a0e] border-t border-[#1f1f26] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2b2b2b] text-[#d4d4d4] text-xs font-semibold transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
