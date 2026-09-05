import type { PhysiologyGatewayState } from '../../physiology/PhysiologyGatewayClient';

interface Props {
  state: PhysiologyGatewayState;
  isCanine: boolean;
}

export function PhysiologyEngineStatus({ state, isCanine }: Props) {
  const nativeActive = isCanine && state.connection === 'connected' && state.nativeWorkerAvailable;
  const gatewayOnly = isCanine && state.connection === 'connected' && !state.nativeWorkerAvailable;
  const dotClass = nativeActive
    ? 'bg-emerald-400 shadow-emerald-400/70'
    : gatewayOnly
      ? 'bg-amber-400 shadow-amber-400/70'
      : 'bg-zinc-500 shadow-zinc-500/50';
  const label = nativeActive
    ? 'Pulse canino · sombra'
    : gatewayOnly
      ? 'Canal canino · referência'
      : 'Motor local';

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-[#292929] bg-[#101010] px-2.5 py-1.5 text-[10px] font-mono-code text-[#b5b5b5]"
      title={state.messagePt}
      data-testid="physiology-engine-status"
    >
      <span className={`h-2 w-2 rounded-full shadow-[0_0_7px] ${dotClass}`} />
      <span>{label}</span>
      {state.latestSnapshot && (
        <span className="text-[#696969]">#{state.latestSnapshot.sequence}</span>
      )}
    </div>
  );
}
