import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertTriangle,
  UserCheck,
  Sparkles,
  LogOut,
  Clock,
  HeartPulse,
  Info,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const {
    login,
    isLoading,
    concurrentDisconnected,
    subscriptionError,
    dismissConcurrentNotice,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen && !concurrentDisconnected && !subscriptionError) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0c12] border border-[#222436] rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] animate-scaleUp text-zinc-200 font-sans">
        {/* Header */}
        <div className="p-6 border-b border-[#1c1e2d] bg-gradient-to-b from-[#141624] to-[#0b0c12] text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-lg shadow-emerald-950/40">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide uppercase">
            SP-VET Anestesia & UTI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Simulador Fisiológico Veterinário Avançado
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-full bg-emerald-950/80 border border-emerald-700/50 text-[10px] text-emerald-300 font-mono font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Acesso Seguro · Sessão Única por Assinante
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* CONCURRENT CONNECTION DISCONNECTION NOTICE */}
          {concurrentDisconnected && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/60 text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                CONEXÃO CONCORRENTE DETECTADA
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">
                Sua conta foi conectada em outro dispositivo ou navegador. Por regras de assinatura,{' '}
                <strong>conexões simultâneas não são permitidas</strong>. Esta sessão foi encerrada.
              </p>
              <button
                type="button"
                onClick={dismissConcurrentNotice}
                className="w-full py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-100 font-bold text-xs transition cursor-pointer"
              >
                Entendi, fazer novo login
              </button>
            </div>
          )}

          {/* SUBSCRIPTION EXPIRED OR INACTIVE NOTICE */}
          {subscriptionError && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/60 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                STATUS DA ASSINATURA
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">
                {subscriptionError}
              </p>
              <div className="text-[11px] text-amber-300/80 pt-1">
                Contate o administrador ou a equipe comercial para ativar ou renovar seu acesso.
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/50 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleSubmit} className="space-y-3.5 font-mono-code text-xs">
            <div>
              <label className="text-zinc-400 block mb-1">E-mail do Profissional:</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="veterinario@exemplo.com"
                  className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">Senha de Acesso:</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  Entrar no Sistema
                </>
              )}
            </button>
          </form>

          {/* CREDENTIALS HINT */}
          <div className="p-3 rounded-xl bg-[#11121c] border border-[#1f2130] text-[11px] text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-zinc-300">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              Acesso de Avaliação / Demonstração:
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span>Free Trial (7 dias):</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('demo@spvet.com');
                  setPassword('demo123');
                }}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                demo@spvet.com (demo123)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
