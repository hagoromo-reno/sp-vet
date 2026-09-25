import React, { useState } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, Cpu, ShieldCheck } from 'lucide-react';
import type { PhysiologyGatewayState } from '../../physiology/PhysiologyGatewayClient';

interface Props {
  state: PhysiologyGatewayState;
  isCanine: boolean;
  onReconnect?: () => void;
}

export function PhysiologyEngineStatus({ state, isCanine, onReconnect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isConnecting = state.connection === 'connecting';
  const nativeActive = isCanine && state.connection === 'connected' && state.nativeWorkerAvailable;
  const gatewayOnly = isCanine && state.connection === 'connected' && !state.nativeWorkerAvailable;

  const integration = state.latestSnapshot?.integration;
  const appliedDomains = integration?.appliedDomains || [];
  const unsupportedInputs = integration?.unsupportedInputs || [];
  const coverage = integration?.pharmacologyCoverage || [];

  return (
    <div className="relative inline-block font-mono-code">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition shadow-sm cursor-pointer ${
            nativeActive
              ? 'border-emerald-500/50 bg-[#0d1a12] text-emerald-300 hover:bg-[#112419]'
              : gatewayOnly
                ? 'border-amber-500/50 bg-[#1f1608] text-amber-300 hover:bg-[#2c1f0b]'
                : isConnecting
                  ? 'border-sky-500/50 bg-[#0c1824] text-sky-300 hover:bg-[#132435]'
                  : 'border-zinc-700/60 bg-[#141414] text-zinc-300 hover:bg-[#1c1c1c]'
          }`}
          title="Clique para inspecionar telemetria e status do motor fisiológico"
          data-testid="physiology-engine-status"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px] bg-emerald-400 shadow-emerald-400/80 animate-pulse"
          />

          <span className="font-semibold text-emerald-300">
            {isCanine ? 'Biofísica Canina · Ativa' : 'Motor Biofísico Local'}
          </span>

          <span className="rounded bg-emerald-950/80 border border-emerald-700/50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
            PK/PD 60 FPS
          </span>

          {nativeActive && unsupportedInputs.length > 0 && (
            <span className="rounded bg-amber-950/80 border border-amber-700/50 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
              {unsupportedInputs.length} sem suporte
            </span>
          )}
        </button>

        {!nativeActive && isCanine && onReconnect && (
          <button
            type="button"
            onClick={onReconnect}
            disabled={isConnecting}
            className="flex items-center gap-1 rounded-lg border border-emerald-600/40 bg-[#0f2415] hover:bg-[#163821] px-2 py-1.5 text-xs text-emerald-300 font-bold transition cursor-pointer"
            title="Conectar ao gateway do Pulse Engine (ws://127.0.0.1:8787/physiology)"
          >
            <RefreshCw className={`h-3 w-3 ${isConnecting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Conectar Pulse</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-96 rounded-xl border border-zinc-700/80 bg-[#121214] p-3.5 text-xs shadow-2xl text-zinc-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-sm text-white">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span>Status do Motor Fisiológico</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-zinc-800"
            >
              Fechar
            </button>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between items-center rounded bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-zinc-400">Canal WebSocket</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  state.connection === 'connected'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40'
                    : state.connection === 'connecting'
                      ? 'bg-sky-950 text-sky-300 border border-sky-700/40'
                      : 'bg-rose-950 text-rose-300 border border-rose-700/40'
                }`}
              >
                {state.connection.toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between items-center rounded bg-zinc-900/80 p-2 border border-zinc-800">
              <span className="text-zinc-400">Worker Nativo C++</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  state.nativeWorkerAvailable
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/40'
                    : 'bg-amber-950 text-amber-300 border border-amber-700/40'
                }`}
              >
                {state.nativeWorkerAvailable ? 'DISPONÍVEL (PULSE 4.3.2)' : 'INDISPONÍVEL'}
              </span>
            </div>

            <div className="rounded bg-zinc-900/80 p-2 border border-zinc-800 space-y-1">
              <div className="text-zinc-400 text-[10px] uppercase font-semibold">Mensagem do Gateway</div>
              <div className="text-zinc-300 font-sans text-xs leading-relaxed">{state.messagePt}</div>
            </div>

            {nativeActive && appliedDomains.length > 0 && (
              <div className="rounded bg-emerald-950/20 p-2 border border-emerald-800/40 space-y-1.5">
                <div className="flex items-center gap-1 font-bold text-emerald-400 text-[10px] uppercase">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Domínios Fisiológicos Aplicados no Pulse ({appliedDomains.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {appliedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="rounded bg-emerald-950 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300 border border-emerald-700/40"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {nativeActive && coverage.length > 0 && (
              <div className="rounded bg-cyan-950/20 p-2 border border-cyan-800/40 space-y-1.5">
                <div className="text-cyan-400 text-[10px] uppercase font-bold">Cobertura Farmacológica Ativa</div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {coverage.map((item) => (
                    <div key={item.drugId} className="flex justify-between items-center text-[10px] border-b border-cyan-900/30 pb-0.5">
                      <span className="font-semibold text-white">{item.drugName}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[8px] font-mono ${
                          item.mode === 'native_pbpk_pd'
                            ? 'bg-emerald-900/60 text-emerald-200'
                            : item.mode === 'hybrid_veterinary_pd'
                              ? 'bg-cyan-900/60 text-cyan-200'
                              : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {item.mode === 'native_pbpk_pd' ? 'PBPK Nativo' : item.mode === 'hybrid_veterinary_pd' ? 'Ponte Híbrida' : 'Local'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unsupportedInputs.length > 0 && (
              <div className="rounded bg-amber-950/20 p-2 border border-amber-800/40 space-y-1">
                <div className="flex items-center gap-1 font-bold text-amber-400 text-[10px] uppercase">
                  <AlertCircle className="h-3 w-3" />
                  Entradas Sem Suporte Nativo
                </div>
                <div className="space-y-1 text-[9px] text-amber-200/80">
                  {unsupportedInputs.map((item) => (
                    <div key={item.id} className="border-b border-amber-900/30 pb-0.5">
                      <strong>{item.id}</strong>: {item.reasonPt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {onReconnect && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onReconnect();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-950/60 hover:bg-emerald-900/80 py-1.5 text-xs font-bold text-emerald-200 transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconectar ao Gateway Pulse
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
