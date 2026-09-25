import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PatientProfile, VitalSigns } from '../../types/simulator';
import {
  FileText,
  Check,
  X,
  Sparkles,
  Save,
  Stethoscope,
  HeartPulse,
  AlertCircle,
} from 'lucide-react';

interface SavePerspectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientProfile;
  vitals: VitalSigns;
  simTimeSeconds: number;
}

export const SavePerspectiveModal: React.FC<SavePerspectiveModalProps> = ({
  isOpen,
  onClose,
  patient,
  vitals,
  simTimeSeconds,
}) => {
  const { token, user } = useAuth();
  const [conductSummary, setConductSummary] = useState(
    `Protocolo balanceado para ${patient.surgicalProcedure}. Estabilidade hemodinâmica mantida com PAM ~${Math.round(vitals.meanArterialPressure)} mmHg e FC ~${Math.round(vitals.heartRate)} bpm.`
  );
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/perspectives', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          species: patient.species,
          asaScore: patient.asa,
          conductSummary,
          clinicalNotes,
          telemetryData: {
            simTimeSeconds,
            heartRate: vitals.heartRate,
            meanBP: vitals.meanArterialPressure,
            systolicBP: vitals.systolicBP,
            diastolicBP: vitals.diastolicBP,
            spo2: vitals.pulseOximetrySpO2,
            etco2: vitals.etCO2,
            temperatureC: vitals.bodyTemperatureC,
            cardiacRhythm: vitals.cardiacRhythm,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao salvar parecer.');
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b0c12] border border-[#232538] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp text-zinc-200 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-[#1c1e2d] bg-[#0d0f1a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Registrar Perspectiva do Profissional
              </h3>
              <p className="text-[11px] text-zinc-400">
                Gravação de conduta, dosagens e parecer clínico no banco de dados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 font-mono text-xs">
          {/* Patient Quick Context */}
          <div className="p-3 rounded-xl bg-[#121422] border border-[#212338] flex items-center justify-between">
            <div>
              <strong className="text-white text-xs block">{patient.name}</strong>
              <span className="text-[11px] text-zinc-400">
                {patient.breed} · {patient.weightKg} kg · ASA {patient.asa}
              </span>
            </div>
            <div className="text-right text-[11px] text-emerald-400 font-bold">
              PAM: {Math.round(vitals.meanArterialPressure)} mmHg | FC: {Math.round(vitals.heartRate)} bpm
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Perspectiva e parecer clínico gravados com sucesso no banco de dados!</span>
            </div>
          )}

          <div>
            <label className="text-zinc-400 block mb-1">Resumo da Conduta Anestésica:</label>
            <textarea
              rows={3}
              required
              value={conductSummary}
              onChange={(e) => setConductSummary(e.target.value)}
              className="w-full bg-[#121422] border border-[#24263b] rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
              placeholder="Descreva a conduta, fármacos utilizados, infusões e estabilização..."
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              Perspectiva do Profissional / Reflexão Crítica:
            </label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full bg-[#121422] border border-[#24263b] rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
              placeholder="Anotações pessoais, dificuldades encontradas, aprendizados do caso ou justificativas anestésicas..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer font-sans text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || saveSuccess}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50 disabled:opacity-50 font-sans text-xs"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando no Banco...' : 'Gravar Perspectiva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
