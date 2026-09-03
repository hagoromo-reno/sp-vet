import React, { useEffect, useState } from 'react';
import { Zap, HeartPulse, CheckCircle2, AlertOctagon, X, Wind } from 'lucide-react';

export interface EmergencyFeedbackItem {
  id: string;
  title: string;
  message: string;
  type: 'cpr' | 'drug' | 'airway' | 'rosc' | 'danger';
}

interface EmergencyFeedbackToastProps {
  item: EmergencyFeedbackItem | null;
  onDismiss: () => void;
}

export const EmergencyFeedbackToast: React.FC<EmergencyFeedbackToastProps> = ({
  item,
  onDismiss,
}) => {
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  if (!item) return null;

  const isRosc = item.type === 'rosc';
  const isDanger = item.type === 'danger';
  const isDrug = item.type === 'drug';
  const isAirway = item.type === 'airway';

  const borderClass = isRosc
    ? 'border-emerald-500 bg-emerald-950/90 text-white shadow-emerald-950/80 animate-pulse'
    : isDanger
    ? 'border-red-500 bg-red-950/90 text-white shadow-red-950/80 animate-bounce'
    : isAirway
    ? 'border-cyan-500 bg-cyan-950/90 text-white shadow-cyan-950/80'
    : 'border-amber-500 bg-amber-950/90 text-white shadow-amber-950/80';

  const icon = isRosc ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
  ) : isDanger ? (
    <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
  ) : isAirway ? (
    <Wind className="w-5 h-5 text-cyan-400 shrink-0" />
  ) : (
    <Zap className="w-5 h-5 text-amber-400 shrink-0" />
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={`p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 ${borderClass}`}
      >
        <div className="flex items-start space-x-3">
          <div className="mt-0.5">{icon}</div>
          <div className="space-y-0.5">
            <h4 className="font-extrabold text-sm tracking-tight">{item.title}</h4>
            <p className="text-xs opacity-90 leading-relaxed font-mono">{item.message}</p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
