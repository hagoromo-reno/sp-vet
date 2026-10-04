import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  QrCode,
  Copy,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  LogOut,
  Mail,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  Sparkles,
  CreditCard,
  FileText,
  Lock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export const PendingPaymentScreen: React.FC = () => {
  const { user, token, logout, refreshUser, setAuthSession } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedBoleto, setIsCopiedBoleto] = useState(false);

  // Email verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);

  // Selected Payment Method: 'credit_card' (default/featured), 'pix', 'boleto'
  const [selectedMethod, setSelectedMethod] = useState<'credit_card' | 'pix' | 'boleto'>('credit_card');


  // Busca dados da ordem e status do pagamento
  const fetchOrderStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/license/order-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);

        // Se o status da assinatura ou da ordem mudou para ativo/pago
        if (data.isLifetime || data.subscriptionStatus === 'active' || data.order?.status === 'CONFIRMED') {
          setIsPaidSuccess(true);
          setTimeout(() => {
            refreshUser();
          }, 2500);
        }
      }
    } catch (e) {
      console.warn('Erro ao consultar status da ordem:', e);
    } finally {
      setIsLoadingOrder(false);
    }
  }, [token, refreshUser]);

  // Polling automático a cada 5 segundos enquanto aguarda pagamento
  useEffect(() => {
    fetchOrderStatus();
    const interval = setInterval(() => {
      if (!isPaidSuccess) {
        fetchOrderStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrderStatus, isPaidSuccess]);

  // Copia o código PIX para a área de transferência
  const handleCopyPix = () => {
    if (order?.pixCopiaCola) {
      navigator.clipboard.writeText(order.pixCopiaCola);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  // Copia a linha digitável do Boleto
  const handleCopyBoleto = () => {
    const code = order?.bankSlipBarCode || '00190.00009 01234.567890 12345.678901 2 94810000004990';
    navigator.clipboard.writeText(code);
    setIsCopiedBoleto(true);
    setTimeout(() => setIsCopiedBoleto(false), 3000);
  };

  // Verificação manual imediata
  const handleManualCheck = async () => {
    setIsCheckingPayment(true);
    try {
      const res = await fetch('/api/license/check-payment', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        if (data.isLifetime || data.subscriptionStatus === 'active' || data.order?.status === 'CONFIRMED') {
          setIsPaidSuccess(true);
          setTimeout(() => refreshUser(), 2500);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingPayment(false);
    }
  };


  // Reenviar código caso o e-mail não esteja verificado
  const handleResendCode = async () => {
    if (!user?.email) return;
    setResendSuccess(null);
    setVerificationError(null);
    try {
      const res = await fetch('/api/license/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.code) {
          setVerificationCode(data.code);
        }
        setResendSuccess(
          data.code
            ? `Novo código reenviado com sucesso! (Código: ${data.code})`
            : 'Novo código reenviado para o seu e-mail!'
        );
      } else {
        setVerificationError(data.message || 'Erro ao reenviar código.');
      }
    } catch (e: any) {
      setVerificationError(e.message || 'Erro de rede.');
    }
  };

  // Validar código caso o usuário ainda não tenha validado
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !verificationCode) return;
    setIsVerifyingCode(true);
    setVerificationError(null);
    try {
      const res = await fetch('/api/license/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Código incorreto ou expirado.');
      }
      setAuthSession(data.user, data.token);
      setOrder(data.payment);
      await fetchOrderStatus();
    } catch (err: any) {
      setVerificationError(err.message || 'Erro na validação do código.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const isEmailPending = user?.email_verified === false;

  return (
    <div className="fixed inset-0 z-[150] bg-[#07080d] text-zinc-100 flex flex-col overflow-y-auto">
      {/* Top Bar */}
      <header className="border-b border-[#1c1e2e] bg-[#0b0d17]/90 px-6 py-4 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wider uppercase text-white">ANEST-VET Simulador Veterinário</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                Aguardando Pagamento
              </span>
            </div>
            <p className="text-xs text-zinc-400">Ativação Automatizada da Licença Vitalícia</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs text-white font-medium">{user?.name}</span>
            <span className="text-[11px] text-zinc-400">{user?.email}</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* SUCCESS SPLASH OVERLAY */}
        {isPaidSuccess ? (
          <div className="bg-[#0f1422] border-2 border-emerald-500 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-[0_0_80px_rgba(16,185,129,0.25)] animate-scaleUp">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-300 font-bold tracking-wide uppercase">
                <Sparkles className="w-4 h-4" /> Pagamento Aprovado via Asaas!
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Sua Licença Vitalícia anest-vet Está 100% Ativa!
              </h1>
              <p className="text-sm text-zinc-300 max-w-lg mx-auto">
                Parabéns! Enviamos o recibo e detalhes de confirmação para o seu e-mail <strong>{user?.email}</strong>.
                Liberando seu acesso completo ao simulador agora...
              </p>
            </div>
            <div className="pt-4 flex justify-center">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando estação de trabalho UTI anest-vet...
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual Roadmap Stepper */}
            <div className="bg-[#0d0f1a] border border-[#202338] rounded-2xl p-4 sm:p-6 shadow-xl">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Roadmap de Ativação do Produto
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-600/40 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black text-xs shrink-0">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">1. Cadastro</div>
                    <div className="text-[10px] text-emerald-300">Concluído</div>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                    isEmailPending
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-emerald-950/30 border-emerald-600/40'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                      isEmailPending
                        ? 'bg-amber-500 text-black animate-pulse'
                        : 'bg-emerald-500 text-black'
                    }`}
                  >
                    {isEmailPending ? '2' : '✓'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">2. E-mail</div>
                    <div className="text-[10px] text-zinc-400">
                      {isEmailPending ? 'Aguardando Código' : 'Confirmado'}
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                    !isEmailPending
                      ? 'bg-teal-950/40 border-teal-500/50 ring-1 ring-teal-500/40'
                      : 'bg-[#121422] border-[#222538]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                      !isEmailPending
                        ? 'bg-teal-400 text-black animate-pulse'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    3
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">3. Pagamento</div>
                    <div className="text-[10px] text-teal-300">
                      {!isEmailPending ? 'Aguardando Asaas' : 'Pendente'}
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-3 rounded-xl bg-[#121422] border border-[#222538] flex items-center gap-2.5 opacity-60">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center font-black text-xs shrink-0">
                    4
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">4. Acesso Vitalício</div>
                    <div className="text-[10px] text-zinc-500">Liberação Automática</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SE O E-MAIL ESTIVER PENDENTE DE CONFIRMAÇÃO */}
            {isEmailPending ? (
              <div className="bg-[#0f111c] border border-amber-500/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white">Confirme seu endereço de e-mail</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Enviamos um código de segurança de 6 dígitos através do nosso servidor oficial para{' '}
                      <strong className="text-amber-300">{user?.email}</strong>. Digite-o abaixo para validar sua
                      conta e carregar a cobrança no Banco Asaas.
                    </p>
                  </div>
                </div>

                {verificationError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-600/50 text-red-200 text-xs">
                    {verificationError}
                  </div>
                )}
                {resendSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-emerald-200 text-xs">
                    {resendSuccess}
                  </div>
                )}

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Código de 6 dígitos recebido:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 584912"
                      className="w-full bg-[#161826] border border-[#2a2d45] focus:border-amber-400 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[8px] text-white focus:outline-none transition"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isVerifyingCode || verificationCode.length < 6}
                      className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/50"
                    >
                      {isVerifyingCode ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Validando código...
                        </>
                      ) : (
                        <>
                          Confirmar E-mail & Escolher Pagamento <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                    >
                      Reenviar Código
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* SEÇÃO DE PAGAMENTO ASAAS: CARTÃO (DESTAQUE), PIX & BOLETO */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Coluna Esquerda: Resumo da Oferta e Garantias */}
                <div className="md:col-span-5 bg-[#0e101a] border border-[#202338] rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xl">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" /> Promoção Exclusiva anest-vet
                    </div>

                    <h2 className="text-xl font-black text-white">Licença Vitalícia Definitiva</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Acesso ilimitado e vitalício ao simulador de UTI veterinária sem nenhuma taxa ou mensalidade recorrente.
                    </p>

                    <div className="bg-[#141624] border border-[#272a44] rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">Preço de tabela:</span>
                        <span className="text-zinc-500 line-through font-mono">R$ 184,90</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1 border-t border-[#22253a]">
                        <span className="text-xs font-bold text-emerald-400">Preço Promocional:</span>
                        <div className="text-right">
                          <span className="text-2xl font-black text-white font-mono">
                            R$ {order?.amount ? Number(order.amount).toFixed(2).replace('.', ',') : '5,00'}
                          </span>
                          <span className="block text-[10px] text-emerald-400 font-semibold">Valor Simbólico de Testes / Promoção</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs text-zinc-300 pt-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Caninos, felinos e equinos completos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Farmacocinética multicompartimental em tempo real</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Diretrizes RECOVER 2024 de PCR/RCE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Emissão de laudos e histórico de avaliações</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Sessão única com segurança e atualizações vitalícias</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#1c1e2e] space-y-2">
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Transação criptografada processada pelo Banco Asaas</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Suporte: arbor.br@aol.com
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Seleção de Meios de Pagamento (Cartão em destaque, PIX, Boleto) */}
                <div className="md:col-span-7 bg-[#0f111c] border border-emerald-500/40 rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Payment Tabs: Cartão, PIX, Boleto */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                      Escolha a Forma de Pagamento no Asaas:
                    </label>
                    <div className="grid grid-cols-3 gap-2 bg-[#090a12] p-1.5 rounded-xl border border-[#212438]">
                      {/* Tab 1: Cartão de Crédito (Destaque) */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('credit_card')}
                        className={`py-2.5 px-2 rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer relative ${
                          selectedMethod === 'credit_card'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-black shadow-lg shadow-emerald-950/60 font-black'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 shrink-0" />
                        <span>Cartão</span>
                        <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded bg-black/20 uppercase font-mono">
                          Imediato
                        </span>
                      </button>

                      {/* Tab 2: PIX */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('pix')}
                        className={`py-2.5 px-2 rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                          selectedMethod === 'pix'
                            ? 'bg-zinc-800 text-white shadow-md border border-zinc-600'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                        }`}
                      >
                        <QrCode className="w-4 h-4 shrink-0" />
                        <span>PIX</span>
                      </button>

                      {/* Tab 3: Boleto */}
                      <button
                        type="button"
                        onClick={() => setSelectedMethod('boleto')}
                        className={`py-2.5 px-2 rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                          selectedMethod === 'boleto'
                            ? 'bg-zinc-800 text-white shadow-md border border-zinc-600'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                        }`}
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Boleto</span>
                      </button>
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* FORMA 1: CARTÃO DE CRÉDITO (DESTAQUE / MAIOR RENDIMENTO) */}
                  {/* ======================================================== */}
                  {/* ======================================================== */}
                  {/* FORMA 1: CARTÃO DE CRÉDITO (CHECKOUT SEGURO ASAAS)      */}
                  {/* ======================================================== */}
                  {selectedMethod === 'credit_card' && (
                    <div className="space-y-4 animate-scaleUp">
                      <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-600/40 space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                              Ambiente Seguro Banco Asaas · Liberação Instantânea
                            </div>
                            <div className="text-[11px] text-zinc-300">
                              Pagamento com Cartão de Crédito com total segurança e criptografia de ponta a ponta.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#111320] border border-[#23273e] rounded-xl text-zinc-300 text-xs space-y-3">
                        <p className="leading-relaxed">
                          Para garantir a total segurança e conformidade PCI-DSS, os dados do seu cartão são inseridos diretamente no ambiente blindado do <strong>Banco Asaas</strong>.
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Seus dados de cartão nunca passam nem ficam armazenados no nosso servidor.</span>
                        </div>
                      </div>

                      {order?.invoiceUrl ? (
                        <a
                          href={order.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" /> Abrir Pagamento com Cartão no Asaas (R$ {order?.amount ? Number(order.amount).toFixed(2).replace('.', ',') : '5,00'})
                        </a>
                      ) : (
                        <div className="p-3 bg-zinc-900 text-zinc-400 text-xs text-center rounded-xl">
                          Gerando fatura segura do Asaas...
                        </div>
                      )}

                      <div className="p-3 bg-[#0d0f1a] border border-[#1f2235] rounded-xl flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                        <div className="text-[11px] text-zinc-300">
                          Assim que o pagamento for concluído na página do Asaas, o sistema reconhece em tempo real e libera seu acesso automaticamente!
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* FORMA 2: PIX INSTANTÂNEO                                 */}
                  {/* ======================================================== */}
                  {selectedMethod === 'pix' && (
                    <div className="space-y-4 animate-scaleUp">
                      <div className="flex flex-col items-center justify-center p-4 bg-[#090a10] border border-[#222538] rounded-xl space-y-3">
                        {order?.pixQrCodeImage ? (
                          <div className="bg-white p-3 rounded-xl shadow-lg">
                            <img
                              src={order.pixQrCodeImage}
                              alt="QR Code PIX Banco Asaas"
                              className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-48 h-48 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-500 text-xs">
                            <QrCode className="w-12 h-12 mb-2 text-zinc-600 animate-pulse" />
                            <span>Carregando QR Code Asaas...</span>
                          </div>
                        )}
                        <span className="text-[11px] text-zinc-400 font-medium text-center">
                          Abra o app do seu banco e aponte a câmera para o QR Code
                        </span>
                      </div>

                      {order?.pixCopiaCola && (
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold text-zinc-400 block uppercase tracking-wider">
                            Chave PIX Copia e Cola:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={order.pixCopiaCola}
                              className="w-full bg-[#141624] border border-[#282c44] rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all truncate"
                            />
                            <button
                              type="button"
                              onClick={handleCopyPix}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-md shadow-emerald-950/50"
                            >
                              {isCopied ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-black" /> Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-black" /> Copiar PIX
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* FORMA 3: BOLETO BANCÁRIO                                */}
                  {/* ======================================================== */}
                  {selectedMethod === 'boleto' && (
                    <div className="space-y-4 animate-scaleUp">
                      <div className="p-4 rounded-xl bg-[#121422] border border-[#252940] space-y-3">
                        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wide">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          Boleto Bancário Registrado Asaas
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Você pode pagar através do internet banking ou em qualquer agência bancária ou lotérica.
                          A compensação do boleto geralmente leva de 1 a 2 dias úteis.
                        </p>

                        <div className="pt-2">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                            Linha Digitável do Boleto:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={order?.bankSlipBarCode || '00190.00009 01234.567890 12345.678901 2 94810000004990'}
                              className="w-full bg-[#0a0b12] border border-[#202438] rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all truncate"
                            />
                            <button
                              type="button"
                              onClick={handleCopyBoleto}
                              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1 shrink-0 transition cursor-pointer"
                            >
                              {isCopiedBoleto ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" /> Copiar
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {order?.bankSlipUrl || order?.invoiceUrl ? (
                          <div className="pt-2">
                            <a
                              href={order?.bankSlipUrl || order?.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
                            >
                              <FileText className="w-4 h-4 text-emerald-400" />
                              Visualizar e Imprimir Boleto Bancário (PDF)
                              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Ações Inferiores: Checar Status Manual & Indicador de Webhook */}
                  <div className="pt-2 border-t border-[#1a1d2e] flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <button
                      type="button"
                      onClick={handleManualCheck}
                      disabled={isCheckingPayment}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingPayment ? 'animate-spin' : ''}`} />
                      {isCheckingPayment ? 'Verificando no Asaas...' : 'Já Paguei (Verificar Agora)'}
                    </button>

                    <div className="text-[11px] text-zinc-500 text-center flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      <span>Sincronização em tempo real via Webhook do Asaas</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#181a28] bg-[#080910] px-6 py-4 text-center text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-2">
        <span>anest-vet · Gestão de Licenciamento: arbor.br@aol.com</span>
        <span>A ativação é automática e instantânea após a aprovação no Banco Asaas</span>
      </footer>
    </div>
  );
};
