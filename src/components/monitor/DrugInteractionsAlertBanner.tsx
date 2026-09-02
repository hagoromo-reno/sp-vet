import React from 'react';
import { VitalSigns } from '../../types/simulator';
import { AlertOctagon, AlertTriangle, Info, Zap } from 'lucide-react';

interface DrugInteractionsAlertBannerProps {
  interactions: VitalSigns['activeDrugInteractions'];
}

export const DrugInteractionsAlertBanner: React.FC<DrugInteractionsAlertBannerProps> = ({ interactions }) => {
  if (!interactions || interactions.length === 0) return null;

  return (
    <div className="space-y-1.5 my-1">
      {interactions.map((interaction, idx) => {
        const isLethal = interaction.severity === 'lethal';
        const isDanger = interaction.severity === 'danger';

        const bgClass = isLethal
          ? 'bg-red-950/90 border-red-500 text-red-100 shadow-lg shadow-red-950/60 animate-pulse'
          : isDanger
          ? 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-md shadow-amber-950/40'
          : 'bg-blue-950/80 border-blue-500 text-blue-100';

        const badgeClass = isLethal
          ? 'bg-red-800 text-white'
          : isDanger
          ? 'bg-amber-800 text-amber-100'
          : 'bg-blue-800 text-blue-100';

        return (
          <div
            key={idx}
            className={`p-2.5 rounded-lg border text-xs font-mono-code flex items-start gap-2.5 transition-all ${bgClass}`}
          >
            <div className="mt-0.5 shrink-0">
              {isLethal ? (
                <AlertOctagon className="w-4 h-4 text-red-400 animate-bounce" />
              ) : isDanger ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <Info className="w-4 h-4 text-blue-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm tracking-wide flex items-center gap-1.5">
                  <span>{interaction.title}</span>
                </span>
                <span className={`text-[9px] font-sans uppercase px-1.5 py-0.5 rounded font-bold ${badgeClass}`}>
                  {interaction.severity === 'lethal' ? 'INTERAÇÃO LETAL' : interaction.severity === 'danger' ? 'ALERTA GRAVE' : 'INTERAÇÃO'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-sans">{interaction.description}</p>
              <p className="text-[10px] opacity-75 mt-1 font-mono-code text-white/80">
                ⚡ Mecanismo: {interaction.pharmacologyMechanism}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
