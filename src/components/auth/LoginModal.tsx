import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  QrCode,
  Copy,
  KeyRound,
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

  // Buy License / Checkout Flow: 'form' -> 'waiting_payment' -> 'set_password'
  const [buyStep, setBuyStep] = useState<'form' | 'waiting_payment' | 'set_password'>('form');

  // Form Fields (Nome, Email e CPF obrigatórios)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Password Creation Fields (após pagamento confirmado)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Order & Session State
  const [orderToken, setOrderToken] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any>(null);
  const [isCopiedPix, setIsCopiedPix] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccessMsg, setBuySuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Recupera sessão do pedido pendente ao carregar o modal (via cookie ou localStorage)
  useEffect(() => {
    const savedToken = localStorage.getItem('anest_order_token');
    const query = savedToken ? `?token=${encodeURIComponent(savedToken)}` : '';
    fetch(`/api/license/check-order-token${query}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.ok) {
          if (data.sessionToken) {
            setOrderToken(data.sessionToken);
            localStorage.setItem('anest_order_token', data.sessionToken);
          }
          setOrderData(data);
          if (data.isConfirmed && !data.registrationCompleted) {
            setBuyStep('set_password');
            setActiveTab('buy');
          } else if (!data.isConfirmed && !data.registrationCompleted) {
            setBuyStep('waiting_payment');
            setActiveTab('buy');
          }
        }
      })
      .catch(() => {});
  }, []);

  // Polling em tempo real a cada 2.5s enquanto aguarda pagamento no Asaas
  useEffect(() => {
    if (buyStep !== 'waiting_payment' || !orderToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/license/check-order-token?token=${encodeURIComponent(orderToken)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isConfirmed) {
            setOrderData(data);
            setBuyStep('set_password');
            setBuySuccessMsg('Pagamento confirmado com sucesso pelo Banco Asaas! Agora crie a sua senha.');
          }
        }
      } catch (err) {
        // Silenciosamente ignora falhas pontuais de polling
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [buyStep, orderToken]);

  if (!isOpen && !concurrentDisconnected && !subscriptionError) {
    return null;
  }

  // Formatador de CPF automático (000.000.000-00)
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setRegCpf(v);
  };

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

  // Etapa 1: Iniciar Pedido e Redirecionar para o Checkout Seguro do Asaas
  const handleInitiateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);
    setBuySuccessMsg(null);

    const cleanCpf = regCpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setBuyError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/license/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          cpf: cleanCpf,
          phone: regPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao gerar pedido no Banco Asaas.');
      }

      setOrderToken(data.orderToken);
      setOrderData(data);
      localStorage.setItem('anest_order_token', data.orderToken);

      // Abre o checkout oficial do Asaas em nova aba
      if (data.invoiceUrl) {
        window.open(data.invoiceUrl, '_blank');
      }

      setBuyStep('waiting_payment');
    } catch (err: any) {
      setBuyError(err.message || 'Erro ao iniciar transação no Asaas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Checagem manual forçada do pagamento ("Já Paguei")
  const handleManualCheckPayment = async () => {
    if (!orderToken) return;
    setIsCheckingPayment(true);
    setBuyError(null);
    try {
      const res = await fetch(`/api/license/check-order-token?token=${encodeURIComponent(orderToken)}`);
      const data = await res.json();
      if (res.ok && data.isConfirmed) {
        setOrderData(data);
        setBuyStep('set_password');
        setBuySuccessMsg('Pagamento confirmado com sucesso!');
      } else {
        setBuyError('Pagamento ainda não identificado pelo Asaas. Se já pagou, aguarde alguns instantes pela compensação.');
      }
    } catch (e: any) {
      setBuyError(e.message || 'Erro ao verificar status.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Copia o código PIX para a área de transferência
  const handleCopyPix = () => {
    if (orderData?.pixCopiaCola) {
      navigator.clipboard.writeText(orderData.pixCopiaCola);
      setIsCopiedPix(true);
      setTimeout(() => setIsCopiedPix(false), 3000);
    }
  };

  // Etapa 3: Concluir Cadastro criando a Senha
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);

    if (!newPassword || newPassword.length < 6) {
      setBuyError('A senha deve possuir pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setBuyError('As senhas digitadas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/license/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderToken,
          password: newPassword,
          passwordConfirm: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao concluir cadastro.');
      }

      localStorage.removeItem('anest_order_token');
      setAuthSession(data.user, data.token);
    } catch (err: any) {
      setBuyError(err.message || 'Erro ao salvar senha e concluir cadastro.');
    } finally {
      setIsSubmitting(false);
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
              <Sparkles className="w-3.5 h-3.5" /> Comprar Licença Vitalícia
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
          {/* TAB 1: BUY LIFETIME LICENSE (CHECKOUT SEGURO ASAAS)      */}
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
                    <span className="text-xl font-black text-emerald-400 font-mono">Por R$ 5,00</span>
                    <span className="text-[9px] text-emerald-300 block font-sans">valor simbólico de testes</span>
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

              {/* ETAPA 1: Dados do Cliente (Nome, E-mail, CPF obrigatórios) */}
              {buyStep === 'form' && (
                <form onSubmit={handleInitiateOrder} className="space-y-3 text-xs">
                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">
                      Nome Completo do Médico Veterinário: <span className="text-emerald-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Dr(a). Nome e Sobrenome"
                      className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">
                      E-mail para Acesso e Envio da Licença: <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-300 font-semibold block mb-1">
                        CPF do Titular: <span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        value={regCpf}
                        onChange={handleCpfChange}
                        placeholder="000.000.000-00"
                        className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">WhatsApp / Celular (Opcional):</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="(11) 90000-0000"
                          className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#131522] border border-[#23273e] rounded-xl text-zinc-300 text-[11px] flex items-start gap-2.5 mt-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Você será redirecionado para a página oficial do <strong>Banco Asaas</strong> para realizar o pagamento com total segurança. A sua senha de acesso será criada assim que o pagamento for confirmado!
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Conectando ao Banco Asaas...
                      </>
                    ) : (
                      <>
                        Ir para Pagamento Seguro no Asaas (R$ 5,00) <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ETAPA 2: Aguardando Pagamento no Asaas com Reconhecimento em Tempo Real */}
              {buyStep === 'waiting_payment' && (
                <div className="space-y-4 text-xs animate-scaleUp">
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Checkout Seguro Asaas Iniciado
                      </div>
                      <span className="text-[10px] bg-emerald-900/60 px-2 py-0.5 rounded text-white font-mono font-bold">
                        R$ {orderData?.amount ? Number(orderData.amount).toFixed(2).replace('.', ',') : '5,00'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Abrimos a tela de pagamento do <strong>Banco Asaas</strong> em uma nova aba. Conclua o pagamento por Cartão de Crédito, PIX ou Boleto para liberar seu acesso.
                    </p>

                    {/* Botão de Redirecionamento Direto */}
                    {orderData?.invoiceUrl && (
                      <div className="pt-2">
                        <a
                          href={orderData.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" /> Abrir Página de Pagamento do Asaas
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Alternativa PIX QR Code Direto */}
                  {orderData?.pixQrCodeImage && (
                    <div className="p-3 bg-[#0d0f18] border border-[#222538] rounded-xl space-y-2.5 text-center">
                      <div className="text-[11px] font-bold text-zinc-300 flex items-center justify-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-teal-400" /> Ou Pague pelo PIX Agora
                      </div>
                      <div className="bg-white p-2.5 rounded-lg inline-block shadow-md">
                        <img
                          src={orderData.pixQrCodeImage}
                          alt="PIX QR Code Asaas"
                          className="w-36 h-36 object-contain mx-auto"
                        />
                      </div>
                      {orderData?.pixCopiaCola && (
                        <div>
                          <button
                            type="button"
                            onClick={handleCopyPix}
                            className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-emerald-400" />
                            {isCopiedPix ? 'Chave PIX Copiada!' : 'Copiar Código PIX (Copia e Cola)'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Radar de Detecção em Tempo Real */}
                  <div className="p-3 bg-[#111320] border border-[#202336] rounded-xl flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <div className="text-[11px] text-zinc-300">
                      Aguardando confirmação do pagamento... Esta tela reconhecerá automaticamente e liberará a criação da sua senha!
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleManualCheckPayment}
                      disabled={isCheckingPayment}
                      className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isCheckingPayment ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando no Asaas...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Já Realizei o Pagamento
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuyStep('form')}
                      className="px-3 py-2.5 rounded-xl bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-300 text-xs transition cursor-pointer"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: Criar Senha de Acesso (Apenas após o pagamento confirmado) */}
              {buyStep === 'set_password' && (
                <form onSubmit={handleCompleteRegistration} className="space-y-4 text-xs animate-scaleUp">
                  <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl space-y-1 text-center">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-black text-white">Pagamento Confirmado pelo Asaas! 🎉</h3>
                    <p className="text-[11px] text-zinc-300">
                      Sua licença vitalícia foi validada. Para concluir seu cadastro e acessar a aplicação, crie sua senha de acesso abaixo:
                    </p>
                    <div className="pt-1 text-[11px] text-emerald-300 font-mono font-bold">
                      {orderData?.email || regEmail}
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">
                      Crie sua Senha de Acesso: <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-300 font-semibold block mb-1">
                      Confirme sua Senha: <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha digitada"
                        className="w-full bg-[#13141f] border border-[#27293d] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || newPassword.length < 6}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Concluindo cadastro e ativando licença...
                      </>
                    ) : (
                      <>
                        Concluir Cadastro & Entrar no anest-vet <ArrowRight className="w-4 h-4" />
                      </>
                    )}
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
