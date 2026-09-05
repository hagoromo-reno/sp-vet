import React from 'react';
import { AlertOctagon, BellRing, CheckCircle2, Clock3, Info, Trash2, X } from 'lucide-react';
import type { EmergencyFeedbackItem } from '../emergency/EmergencyFeedbackToast';

interface ClinicalOccurrenceCenterProps {
  isOpen: boolean;
  items: EmergencyFeedbackItem[];
  onClose: () => void;
  onClear: () => void;
}

const formatTime = (seconds = 0): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ClinicalOccurrenceCenter: React.FC<ClinicalOccurrenceCenterProps> = ({ isOpen, items, onClose, onClear }) => (
  <>
    {isOpen && <button aria-label="Fechar histórico" className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />}
    <aside className={`fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-[#2b2b2b] bg-[#0b0b0b] shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex items-center justify-between border-b border-[#252525] p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-white"><BellRing className="h-4 w-4 text-amber-400" /> Histórico de ocorrências</div>
          <div className="mt-0.5 text-[10px] text-[#777]">Interações, alertas fisiológicos e respostas às intervenções</div>
        </div>
        <div className="flex gap-1">
          <button onClick={onClear} className="rounded p-2 text-[#777] hover:bg-[#202020] hover:text-red-300" title="Limpar histórico"><Trash2 className="h-4 w-4" /></button>
          <button onClick={onClose} className="rounded p-2 text-[#999] hover:bg-[#202020] hover:text-white" title="Fechar"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="h-[calc(100vh-73px)] space-y-2 overflow-y-auto p-3">
        {items.length === 0 && (
          <div className="mt-12 text-center text-xs text-[#666]"><CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-700" />Nenhuma ocorrência registrada neste caso.</div>
        )}
        {[...items].reverse().map((item) => {
          const critical = item.severity === 'crítico' || item.type === 'danger';
          const warning = item.severity === 'atenção' || item.type === 'drug';
          return (
            <article key={item.id} className={`rounded-lg border p-3 ${critical ? 'border-red-800/60 bg-red-950/20' : warning ? 'border-amber-800/50 bg-amber-950/15' : 'border-blue-900/50 bg-blue-950/10'}`}>
              <div className="flex items-start gap-2">
                {critical ? <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> : warning ? <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[11px] font-bold text-[#f0f0f0]">{item.title}</h4>
                    <span className="flex shrink-0 items-center gap-1 font-mono-code text-[9px] text-[#666]"><Clock3 className="h-2.5 w-2.5" />{formatTime(item.simTimeSeconds)}</span>
                  </div>
                  <div className="mt-0.5 text-[9px] font-semibold uppercase text-[#777]">{item.category || 'Ocorrência clínica'} · {item.severity || 'informação'}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#aaa]">{item.message}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  </>
);
