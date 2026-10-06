import React, { useState, useEffect } from 'react';
import { GraduationCap, User, Laptop, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { getDeviceId, getStudentName, setStudentName } from '../../utils/studentDevice';

interface StudentIdentificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (studentName: string) => void;
  canDismiss?: boolean;
}

export const StudentIdentificationModal: React.FC<StudentIdentificationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  canDismiss = false,
}) => {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = getStudentName();
      setName(current);
      setDeviceId(getDeviceId());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Por favor, informe seu nome ou codinome para prosseguir.');
      return;
    }
    if (trimmed.length < 2) {
      setError('O nome deve conter pelo menos 2 caracteres.');
      return;
    }

    setStudentName(trimmed);
    onSaved(trimmed);
    onClose();
  };

  const handleQuickPreset = (preset: string) => {
    setName(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-zinc-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-950/50 p-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <GraduationCap size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Identificação do Aluno</h3>
              <p className="text-xs text-indigo-400">Turma e Acesso Coletivo SOPET</p>
            </div>
          </div>
          {canDismiss && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-zinc-300 leading-relaxed">
            Esta conta é utilizada conjuntamente por alunos da turma. O seu aparelho foi registrado através de cookies.
            Informe seu <strong>Nome ou Codinome</strong> para que seus registros, doses e o <strong>Resumo do Procedimento</strong> fiquem vinculados individualmente a você no sistema.
          </p>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Seu Nome ou Codinome de Aluno:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <User size={16} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                placeholder="Ex: Mariana Silva ou Aluno Grupo 3"
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-white placeholder-zinc-500 transition"
              />
            </div>
            {error && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
                <AlertCircle size={13} /> {error}
              </p>
            )}
          </div>

          <div>
            <span className="text-[11px] font-medium text-zinc-400 block mb-1.5">Sugestões rápidas de identificação:</span>
            <div className="flex flex-wrap gap-1.5">
              {['Aluno 01', 'Aluno 02', 'Equipe A', 'Equipe B', 'Grupo Cirurgia'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleQuickPreset(preset)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Laptop size={13} /> Aparelho ID: <code className="text-zinc-400 font-mono">{deviceId ? deviceId.slice(0, 14) : 'cookie-id'}</code>
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Cookies ativos
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            {canDismiss && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              Confirmar e Iniciar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
