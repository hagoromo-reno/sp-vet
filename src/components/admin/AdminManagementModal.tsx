import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  Shield,
  Activity,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  Search,
  RefreshCw,
  X,
  Sliders,
  FileText,
  AlertTriangle,
  UserCheck,
  UserX,
  Calendar,
  Sparkles,
  Zap,
  MessageSquare,
  FolderHeart,
} from 'lucide-react';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({ isOpen, onClose }) => {
  const { token, user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'perspectives' | 'reviews' | 'patients' | 'metrics'>('users');

  // Metrics
  const [metrics, setMetrics] = useState<any>({
    totalUsers: 0,
    activeSubscriptions: 0,
    trialUsers: 0,
    inactiveUsers: 0,
    onlineUsers: 0,
    totalPerspectives: 0,
  });

  // Users list
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sessions list
  const [sessions, setSessions] = useState<any[]>([]);

  // Perspectives list
  const [perspectives, setPerspectives] = useState<any[]>([]);

  // Reviews list (Revisão por Anestesiologista)
  const [reviews, setReviews] = useState<any[]>([]);

  // Admin Patients list (Pacientes criados pelos Vets)
  const [adminPatients, setAdminPatients] = useState<any[]>([]);

  // Create User Modal/Form state
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('senha123');
  const [newUserRole, setNewUserRole] = useState<'veterinarian' | 'admin' | 'student'>('veterinarian');
  const [newUserSubStatus, setNewUserSubStatus] = useState<'active' | 'inactive' | 'trial'>('active');
  const [newUserTrialDays, setNewUserTrialDays] = useState(7);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load metrics
  const loadMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
      }
    } catch (e) {}
  }, [token]);

  // Load users
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, search, statusFilter]);

  // Load active sessions
  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch (e) {}
  }, [token]);

  // Load perspectives
  const loadPerspectives = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/perspectives', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPerspectives(data.perspectives);
      }
    } catch (e) {}
  }, [token]);

  // Load reviews
  const loadReviews = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (e) {}
  }, [token]);

  // Load admin patients
  const loadAdminPatients = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/patients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdminPatients(data.patients || []);
      }
    } catch (e) {}
  }, [token]);

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Deseja excluir esta revisão clínica do banco de dados?')) return;
    try {
      await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadReviews();
    } catch (e) {
      alert('Erro ao excluir revisão.');
    }
  };

  const handleDeleteAdminPatient = async (id: string) => {
    if (!confirm('Deseja excluir este paciente do banco de dados?')) return;
    try {
      await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadAdminPatients();
    } catch (e) {
      alert('Erro ao excluir paciente.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMetrics();
      loadUsers();
      loadSessions();
      loadPerspectives();
      loadReviews();
      loadAdminPatients();
    }
  }, [isOpen, loadMetrics, loadUsers, loadSessions, loadPerspectives, loadReviews, loadAdminPatients]);

  if (!isOpen) return null;

  // Handle user creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          subscription_status: newUserSubStatus,
          trial_days: newUserTrialDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao criar usuário');

      setFormMsg({ type: 'success', text: `Usuário ${newUserName} criado com sucesso!` });
      setNewUserName('');
      setNewUserEmail('');
      setIsCreatingUser(false);
      loadUsers();
      loadMetrics();
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message });
    }
  };

  // Quick update subscription
  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      let expires: string | null = null;
      if (newStatus === 'trial') {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        expires = d.toISOString();
      }

      await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_status: newStatus,
          subscription_expires_at: expires,
        }),
      });
      loadUsers();
      loadMetrics();
    } catch (e) {}
  };

  // Toggle user block
  const handleToggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_blocked: !currentBlocked }),
      });
      loadUsers();
      loadMetrics();
      loadSessions();
    } catch (e) {}
  };

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      await fetch(`/api/admin/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadSessions();
      loadMetrics();
    } catch (e) {}
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o usuário "${userName}"?`)) return;
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadUsers();
      loadMetrics();
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#0b0c12] border border-[#232538] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_70px_rgba(0,0,0,0.9)] animate-scaleUp text-zinc-200 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1c1e2d] bg-gradient-to-r from-[#10121d] via-[#090b10] to-[#10121d]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  Painel de Gestão & Assinaturas (Admin)
                </h3>
                <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                  Acesso Restrito
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Gerencie assinaturas, perfis trial, conexões não-concorrentes e pareceres clínicos salvos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1a1c29] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Cards Top Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 border-b border-[#1c1e2d] bg-[#07080d]">
          <div className="p-3 rounded-xl bg-[#10121d] border border-[#1f2130]">
            <span className="text-[10px] text-zinc-400 uppercase font-mono block">Total Usuários</span>
            <strong className="text-lg font-mono font-bold text-white">{metrics.totalUsers}</strong>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
            <span className="text-[10px] text-emerald-400 uppercase font-mono block">Assinaturas Ativas</span>
            <strong className="text-lg font-mono font-bold text-emerald-300">{metrics.activeSubscriptions}</strong>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40">
            <span className="text-[10px] text-cyan-400 uppercase font-mono block">Em Demonstração (Trial)</span>
            <strong className="text-lg font-mono font-bold text-cyan-300">{metrics.trialUsers}</strong>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40">
            <span className="text-[10px] text-rose-400 uppercase font-mono block">Inativas / Bloqueadas</span>
            <strong className="text-lg font-mono font-bold text-rose-300">{metrics.inactiveUsers}</strong>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-purple-400 uppercase font-mono block">Online Agora</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <strong className="text-lg font-mono font-bold text-purple-300">{metrics.onlineUsers}</strong>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1c1e2d] bg-[#08090f] px-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 text-xs font-bold font-mono transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'users'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>USUÁRIOS & ASSINATURAS ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-4 text-xs font-bold font-mono transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'sessions'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>CONEXÕES ATIVAS / SESSÕES ({sessions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('perspectives')}
            className={`py-3 px-4 text-xs font-bold font-mono transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'perspectives'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>PERSPECTIVAS ({perspectives.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`py-3 px-4 text-xs font-bold font-mono transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'reviews'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>REVISÕES DE ANESTESISTAS ({reviews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('patients')}
            className={`py-3 px-4 text-xs font-bold font-mono transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'patients'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span>PACIENTES DOS VETS ({adminPatients.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: USERS & SUBSCRIPTION MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nome ou e-mail..."
                      className="w-full bg-[#12141f] border border-[#232538] rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[#12141f] border border-[#232538] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="">Todos os Planos</option>
                    <option value="active">Ativas</option>
                    <option value="trial">Demonstração (Trial)</option>
                    <option value="inactive">Inativas</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadUsers}
                    className="p-2 rounded-xl bg-[#12141f] border border-[#232538] text-zinc-300 hover:text-white transition cursor-pointer"
                    title="Recarregar"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsCreatingUser(!isCreatingUser)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-emerald-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    Cadastrar Usuário
                  </button>
                </div>
              </div>

              {/* CREATE USER FORM DRAWER */}
              {isCreatingUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/15 space-y-3 font-mono text-xs animate-fadeIn"
                >
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                    <strong className="text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Cadastrar Novo Usuário / Assinante
                    </strong>
                    <button
                      type="button"
                      onClick={() => setIsCreatingUser(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-zinc-400 block mb-1">Nome Completo:</label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Dr. João Silva"
                        className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">E-mail de Acesso:</label>
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="joao@clinica.com"
                        className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Senha Inicial:</label>
                      <input
                        type="text"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Perfil de Acesso:</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-white focus:outline-none"
                      >
                        <option value="veterinarian">Médico Veterinário</option>
                        <option value="student">Estudante / Residente</option>
                        <option value="admin">Administrador Master</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-zinc-400 block mb-1">Status da Assinatura:</label>
                      <select
                        value={newUserSubStatus}
                        onChange={(e) => setNewUserSubStatus(e.target.value as any)}
                        className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-white focus:outline-none"
                      >
                        <option value="active">Assinatura Ativa (Sem expiração)</option>
                        <option value="trial">Demonstração / Free Trial</option>
                        <option value="inactive">Inativa / Bloqueada</option>
                      </select>
                    </div>

                    {newUserSubStatus === 'trial' && (
                      <div>
                        <label className="text-zinc-400 block mb-1">Duração do Trial (Dias):</label>
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={newUserTrialDays}
                          onChange={(e) => setNewUserTrialDays(parseInt(e.target.value) || 7)}
                          className="w-full bg-[#10121d] border border-[#2a2d42] rounded-lg p-2 text-cyan-300 font-bold focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingUser(false)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      Salvar Novo Usuário
                    </button>
                  </div>
                </form>
              )}

              {/* USERS TABLE */}
              <div className="rounded-xl border border-[#232538] bg-[#0e1018] overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#121420] text-zinc-400 border-b border-[#232538] uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Usuário / E-mail</th>
                      <th className="p-3">Perfil</th>
                      <th className="p-3">Assinatura</th>
                      <th className="p-3">Expiração / Validade</th>
                      <th className="p-3 text-right">Ações de Gestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1e2d]">
                    {users.map((u) => {
                      const isExpired = u.subscription_expires_at && new Date(u.subscription_expires_at).getTime() < Date.now();
                      return (
                        <tr key={u.id} className="hover:bg-[#141624] transition">
                          <td className="p-3">
                            <strong className="block text-white text-xs">{u.name}</strong>
                            <span className="text-[11px] text-zinc-400">{u.email}</span>
                          </td>

                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {u.role === 'admin' ? 'Administrador' : u.role === 'student' ? 'Estudante' : 'Veterinário'}
                            </span>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {u.is_blocked ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
                                  Bloqueado
                                </span>
                              ) : u.subscription_status === 'active' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Ativa
                                </span>
                              ) : u.subscription_status === 'trial' ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isExpired ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                }`}>
                                  {isExpired ? 'Trial Expirado' : 'Free Trial'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Inativa
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3 text-zinc-300">
                            {u.subscription_expires_at ? (
                              <span className={isExpired ? 'text-amber-400 font-bold' : ''}>
                                {new Date(u.subscription_expires_at).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-zinc-500">Ilimitada</span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick switch subscription */}
                              {u.subscription_status !== 'active' && (
                                <button
                                  onClick={() => handleUpdateStatus(u.id, 'active')}
                                  className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-[10px] font-bold cursor-pointer"
                                  title="Ativar Assinatura Ilimitada"
                                >
                                  Ativar
                                </button>
                              )}
                              {u.subscription_status !== 'trial' && (
                                <button
                                  onClick={() => handleUpdateStatus(u.id, 'trial')}
                                  className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[10px] font-bold cursor-pointer"
                                  title="Definir como Free Trial (7 dias)"
                                >
                                  Trial
                                </button>
                              )}
                              {u.subscription_status !== 'inactive' && (
                                <button
                                  onClick={() => handleUpdateStatus(u.id, 'inactive')}
                                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 text-[10px] font-bold cursor-pointer"
                                  title="Desativar Assinatura"
                                >
                                  Inativar
                                </button>
                              )}

                              {/* Block/Unblock */}
                              <button
                                onClick={() => handleToggleBlock(u.id, u.is_blocked)}
                                className={`p-1 rounded cursor-pointer ${
                                  u.is_blocked
                                    ? 'bg-red-950 text-red-300 hover:bg-red-900'
                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                                title={u.is_blocked ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
                              >
                                {u.is_blocked ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>

                              {/* Delete (prevent self deletion) */}
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.name)}
                                  className="p-1 rounded bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 cursor-pointer"
                                  title="Excluir Usuário"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CONCURRENT SESSIONS MONITOR */}
          {activeTab === 'sessions' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase">
                    Monitor de Conexões em Tempo Real
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    O SP-VET invalida conexões simultâneas automaticamente. Abaixo estão as sessões atualmente ativas.
                  </p>
                </div>
                <button
                  onClick={loadSessions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12141f] border border-[#232538] text-zinc-300 hover:text-white text-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
              </div>

              <div className="rounded-xl border border-[#232538] bg-[#0e1018] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121420] text-zinc-400 border-b border-[#232538] uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Usuário</th>
                      <th className="p-3">IP / Origem</th>
                      <th className="p-3">Dispositivo / Navegador</th>
                      <th className="p-3">Conectado em</th>
                      <th className="p-3">Último Batimento</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1e2d]">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          Nenhuma sessão ativa encontrada no momento.
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-[#141624] transition">
                          <td className="p-3">
                            <strong className="block text-white">{s.user_name}</strong>
                            <span className="text-[11px] text-zinc-400">{s.user_email}</span>
                          </td>
                          <td className="p-3 text-zinc-300">{s.ip_address}</td>
                          <td className="p-3 text-zinc-400 truncate max-w-xs" title={s.user_agent}>
                            {s.user_agent.split(' ')[0]}
                          </td>
                          <td className="p-3 text-zinc-400">
                            {new Date(s.connected_at).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="p-3 text-emerald-400">
                            {new Date(s.last_heartbeat_at).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRevokeSession(s.id)}
                              className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold cursor-pointer"
                              title="Derrubar sessão agora"
                            >
                              Derrubar Conexão
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PROFESSIONAL CLINICAL PERSPECTIVES & EVALUATIONS */}
          {activeTab === 'perspectives' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase">
                    Perspectivas & Pareceres Clínicos Gravados
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Registros salvos no banco de dados com conduta, dosagens e reflexões do profissional.
                  </p>
                </div>
                <button
                  onClick={loadPerspectives}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12141f] border border-[#232538] text-zinc-300 hover:text-white text-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
              </div>

              <div className="space-y-3">
                {perspectives.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 bg-[#0e1018] rounded-xl border border-[#232538]">
                    Nenhuma perspectiva clínica registrada ainda. Os profissionais podem salvar suas reflexões através do botão &quot;Salvar Perspectiva&quot; na barra superior do simulador.
                  </div>
                ) : (
                  perspectives.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-[#232538] bg-[#0e1018] space-y-2 hover:border-[#33364f] transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1e2d] pb-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{p.patient_name}</strong>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                            ASA {p.asa_score}
                          </span>
                          <span className="text-zinc-400 text-xs">· {p.species}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Autor: <strong className="text-zinc-200">{p.author_name}</strong> ·{' '}
                          {new Date(p.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Resumo da Conduta Anestésica:</span>
                        <p className="text-xs text-zinc-300 leading-relaxed">{p.conduct_summary}</p>
                      </div>

                      {p.clinical_notes && (
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase block font-bold">Anotações do Profissional / Perspectiva:</span>
                          <p className="text-xs text-zinc-400 italic bg-[#131522] p-2.5 rounded-lg border border-[#222436]">
                            &quot;{p.clinical_notes}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EXPERT REVIEWS FROM ANESTHESIOLOGISTS */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0f18] p-3 rounded-xl border border-[#232538]">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    Revisões e Pareceres Clínicos de Especialistas ({reviews.length})
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Pareceres emitidos pelos anestesiologistas cadastrados, salvos centralmente no PostgreSQL.
                  </p>
                </div>
                <button
                  onClick={loadReviews}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12141f] border border-[#232538] text-zinc-300 hover:text-white text-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
              </div>

              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 bg-[#0e1018] rounded-xl border border-[#232538]">
                    Nenhuma revisão por anestesiologista registrada ainda. Os médicos veterinários podem submeter pareceres através do painel de Revisão por Anestesiologista.
                  </div>
                ) : (
                  reviews.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-xl border border-[#232538] bg-[#0e1018] space-y-2 hover:border-[#33364f] transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1e2d] pb-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{r.reviewer}</strong>
                          <span className="text-zinc-400 text-xs">({r.qualification})</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              r.verdict === 'plausible'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : r.verdict === 'adjust'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            }`}
                          >
                            {r.verdict === 'plausible' ? 'Plausível' : r.verdict === 'adjust' ? 'Precisa de Ajuste' : 'Inconclusivo'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-zinc-400">
                            Autor da conta: <strong className="text-zinc-200">{r.user_name || r.user_email || 'Veterinário'}</strong> · {new Date(r.created_at).toLocaleString('pt-BR')}
                          </div>
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer"
                            title="Excluir revisão"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-400">
                        Paciente: <strong className="text-zinc-200">{r.patient_name || 'Paciente'}</strong> · Espécie: <strong className="text-zinc-200">{r.species || 'Canina'}</strong> · Classificação: <strong className="text-emerald-400">ASA {r.asa_status || 'I'}</strong>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Evolução Esperada Declarada:</span>
                        <p className="text-xs text-zinc-300 leading-relaxed bg-[#121422] p-2 rounded-lg border border-[#202235]">
                          {r.expected_narrative}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block font-bold">Justificativa & Proposta de Ajuste:</span>
                        <p className="text-xs text-cyan-200/90 leading-relaxed bg-[#0d1522] p-2 rounded-lg border border-[#1b283d]">
                          {r.rationale}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: VETERINARIAN CUSTOM PATIENTS */}
          {activeTab === 'patients' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0f18] p-3 rounded-xl border border-[#232538]">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-2">
                    <FolderHeart className="w-4 h-4 text-amber-400" />
                    Pacientes & Casos Cadastrados no Banco de Dados ({adminPatients.length})
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Acompanhamento central de todos os pacientes padrão do sistema e personalizados criados pelos médicos veterinários.
                  </p>
                </div>
                <button
                  onClick={loadAdminPatients}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12141f] border border-[#232538] text-zinc-300 hover:text-white text-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
              </div>

              <div className="space-y-3">
                {adminPatients.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 bg-[#0e1018] rounded-xl border border-[#232538]">
                    Nenhum paciente carregado.
                  </div>
                ) : (
                  adminPatients.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-[#232538] bg-[#0e1018] space-y-2 hover:border-[#33364f] transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c1e2d] pb-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-sm">{p.name}</strong>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                            ASA {p.asa}
                          </span>
                          <span className="text-zinc-400 text-xs">
                            · {p.species} · {p.breed || 'SRD'} ({p.weight_kg} kg · {p.gender || 'Não informado'})
                          </span>
                          {p.is_default ? (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                              Padrão do Sistema
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                              Customizado por Vet
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-zinc-400">
                            {p.author_name ? (
                              <>Criado por: <strong className="text-zinc-200">{p.author_name}</strong> ({p.author_email})</>
                            ) : (
                              <span className="text-zinc-500">Sistema SP-VET</span>
                            )}
                          </div>
                          {!p.is_default && (
                            <button
                              onClick={() => handleDeleteAdminPatient(p.id)}
                              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer"
                              title="Excluir paciente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {p.surgical_procedure && (
                        <div className="text-xs text-zinc-300">
                          <span className="text-zinc-500 font-bold">Procedimento Proposto:</span> {p.surgical_procedure}
                        </div>
                      )}

                      {p.scenario_description && (
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {p.scenario_description}
                        </p>
                      )}

                      {p.clinical_history && (
                        <div className="text-xs text-zinc-400 bg-[#121422] p-2 rounded-lg border border-[#202235]">
                          <span className="text-zinc-500 font-bold block mb-0.5">Histórico Clínico:</span>
                          {p.clinical_history}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
