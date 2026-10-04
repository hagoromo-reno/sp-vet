import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertTriangle,
  UserCheck,
  Clock,
  HeartPulse,
  Sparkles,
  Zap,
  CheckCircle2,
  Phone,
  CreditCard,
  FileText,
  ArrowRight,
  RefreshCw,
  Tag,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const {
    login,
    isLoading: isAuthLoading,
    concurrentDisconnected,
    subscriptionError,
    dismissConcurrentNotice,
    setAuthSession,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'buy' | 'login'>('buy');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Buy License / Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [buyStep, setBuyStep] = useState<'form' | 'verify'>('form');
  const [regCode, setRegCode] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccessMsg, setBuySuccessMsg] = useState<string | null>(null);
  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);

  if (!isOpen && !concurrentDisconnected && !subscriptionError) {
    return null;
  }

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || 'Erro ao realizar login.');
    }
  };

  // Submit Registration (Step 1)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);
    setBuySuccessMsg(null);
    setIsSubmittingBuy(true);

    try {
      const res = await fetch('/api/license/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          cpf: regCpf,
          phone: regPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao processar cadastro para licença.');
      }

      setBuySuccessMsg('Código de confirmação enviado para o seu e-mail via AOL SMTP!');
      setBuyStep('verify');
    } catch (err: any) {
      setBuyError(err.message || 'Erro ao iniciar compra da licença.');
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  // Submit Email Verification (Step 2) -> Generates Asaas Charge
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);
    setBuySuccessMsg(null);
    setIsSubmittingBuy(true);

    try {
      const res = await fetch('/api/license/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          code: regCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Código incorreto ou expirado.');
      }

      // Autentica o usuário diretamente: App.tsx exibirá PendingPaymentScreen imediatamente com o PIX
      setAuthSession(data.user, data.token);
    } catch (err: any) {
      setBuyError(err.message || 'Erro ao confirmar código de e-mail.');
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  // Reenviar código
  const handleResendCode = async () => {
    setBuyError(null);
    setBuySuccessMsg(null);
    try {
      const res = await fetch('/api/license/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setBuySuccessMsg('Novo código reenviado com sucesso para o seu e-mail!');
      } else {
        setBuyError(data.message || 'Erro ao reenviar código.');
      }
    } catch (e: any) {
      setBuyError('Erro ao conectar ao servidor de e-mail.');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b0c14] border border-[#222538] rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.95)] animate-scaleUp text-zinc-200 font-sans my-auto">
        {/* Top Promotional Announcement Bar */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-4 py-2 flex items-center justify-between text-black text-xs font-black tracking-wide">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 fill-black" />
            <span className="uppercase">OFERTA ESPECIAL DE LANÇAMENTO</span>
          </div>
          <span className="bg-black/20 px-2 py-0.5 rounded text-[11px] font-mono">
            73% OFF · VITALÍCIO
          </span>
        </div>

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#1c1f30] bg-[#10121d] text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shadow-lg shadow-emerald-950/40">
            <HeartPulse className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide uppercase">
            anest-vet Anestesia & UTI
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Simulador Fisiológico e Farmacológico Veterinário Avançado
          </p>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 gap-2 mt-4 bg-[#090a10] p-1.5 rounded-xl border border-[#1f2233]">
            <button
              type="button"
              onClick={() => setActiveTab('buy')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'buy'
                  ? 'bg-emerald-600 text-black shadow-md shadow-emerald-950/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" /> Comprar Licença Vitalícia
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Já Sou Cadastrado
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* CONCURRENT NOTICE */}
          {concurrentDisconnected && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/60 text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                CONEXÃO CONCORRENTE DETECTADA
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">
                Sua conta foi conectada em outro dispositivo. Esta sessão foi encerrada.
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

          {/* SUBSCRIPTION NOTICE */}
          {subscriptionError && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/60 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                STATUS DA CONTA
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">{subscriptionError}</p>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: BUY LIFETIME LICENSE (ISCA DE COMPRA DE R$ 49,90) */}
          {/* ======================================================== */}
          {activeTab === 'buy' && (
            <div className="space-y-4">
              {/* Isca de Preço / Card Promocional */}
              <div className="bg-gradient-to-br from-[#121424] to-[#0c0d16] border border-emerald-500/40 rounded-xl p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                      <Tag className="w-3 h-3" /> Licença Vitalícia Definitiva
                    </span>
                    <h3 className="text-sm font-black text-white">Acesso Completo ao Simulador</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 line-through block">De R$ 184,90</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">Por R$ 49,90</span>
                    <span className="text-[9px] text-zinc-400 block font-sans">taxa única sem mensalidades</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#1f2238] text-[11px] text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Todas as Espécies</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Diretrizes RECOVER 2024</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Farmacocinética em Tempo Real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Laudos Clínicos Ilimitados</span>
                  </div>
                </div>

                {/* Formas de Pagamento Asaas */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#1f2238] text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1 text-emerald-300 font-bold">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Cartão (Imediato)
                  </span>
                  <span className="flex items-center gap-1 text-teal-300 font-bold">
                    <Zap className="w-3.5 h-3.5 text-teal-400" /> PIX
                  </span>
                  <span className="flex items-center gap-1 text-zinc-300 font-medium">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" /> Boleto
                  </span>
                </div>
              </div>

              {/* Feedback Alerts */}
              {buyError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{buyError}</span>
                </div>
              )}
              {buySuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-700/50 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{buySuccessMsg}</span>
                </div>
              )}

              {/* STEP 1: Registration Form */}
              {buyStep === 'form' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-400 block mb-1">Nome Completo do Médico Veterinário:</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Dr(a). Nome Sobrenome"
                      className="w-full bg-[#13141f] border border-[#27293d] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">E-mail para Receber Acesso e Recibo:</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 block mb-1">CPF (emissão Asaas):</label>
                      <input
                        type="text"
                        required
                        value={regCpf}
                        onChange={(e) => setRegCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-[#13141f] border border-[#27293d] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">WhatsApp / Celular:</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="(11) 90000-0000"
                          className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Crie sua Senha de Acesso:</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingBuy}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmittingBuy ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Enviando código para seu e-mail...
                      </>
                    ) : (
                      <>
                        Garantir Minha Licença por R$ 49,90 <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-500 text-center pt-1">
                    Ao clicar, enviaremos um código de 6 dígitos via nosso servidor SMTP para confirmar seu e-mail.
                  </p>
                </form>
              )}

              {/* STEP 2: Email Verification Code */}
              {buyStep === 'verify' && (
                <form onSubmit={handleVerifySubmit} className="space-y-4 text-xs">
                  <div className="p-3 bg-[#131522] border border-[#23273e] rounded-xl text-zinc-300 space-y-1">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-emerald-400" />
                      Confirmação de Segurança
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Digite o código de 6 dígitos enviado para <strong>{regEmail}</strong> pelo nosso sistema oficial
                      (arbor.br@aol.com):
                    </p>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1 uppercase tracking-wider text-[11px] font-bold">
                      Código de 6 dígitos:
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      autoFocus
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 849201"
                      className="w-full bg-[#141624] border border-[#2b304c] focus:border-emerald-500 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[8px] text-white focus:outline-none transition"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isSubmittingBuy || regCode.length < 6}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/50"
                    >
                      {isSubmittingBuy ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Gerando cobrança Asaas...
                        </>
                      ) : (
                        <>
                          Confirmar & Escolher Pagamento <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="px-3 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-xs transition cursor-pointer"
                    >
                      Reenviar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBuyStep('form')}
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-400 underline cursor-pointer"
                  >
                    Alterar dados de cadastro
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: NORMAL LOGIN FOR EXISTING USERS                   */}
          {/* ======================================================== */}
          {activeTab === 'login' && (
            <div className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5 font-mono-code text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">E-mail Cadastrado:</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
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
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#13141f] border border-[#27293d] rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAuthLoading ? (
                    <span>Autenticando...</span>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Entrar no Sistema
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          <div className="pt-2 border-t border-[#181a28] flex items-center justify-between text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Criptografia de Ponta a Ponta
            </span>
            <span>Gestão: arbor.br@aol.com</span>
          </div>
        </div>
      </div>
    </div>
  );
};
