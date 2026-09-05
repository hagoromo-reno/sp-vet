import React, { useState } from 'react';
import { PatientProfile, SpeciesType, ASAStatus } from '../../types/simulator';
import { PRESET_SCENARIOS } from '../../data/scenarios';
import { SPECIES_DATABASE } from '../../data/speciesData';
import { formatSpecies } from '../../utils/formatters';
import { FolderHeart, Plus, Check, X, ShieldAlert, Sparkles, Dog, Cat } from 'lucide-react';

interface ScenarioSelectorModalProps {
  currentPatientId: string;
  onSelectScenario: (patient: PatientProfile) => void;
  onClose: () => void;
}

export const ScenarioSelectorModal: React.FC<ScenarioSelectorModalProps> = ({
  currentPatientId,
  onSelectScenario,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  // Custom patient builder state
  const [customName, setCustomName] = useState('Paciente Simulado');
  const [customSpecies, setCustomSpecies] = useState<SpeciesType>('canine');
  const [customBreed, setCustomBreed] = useState('SRD');
  const [customWeight, setCustomWeight] = useState(15.0);
  const [customAgeYears, setCustomAgeYears] = useState(4);
  const [customAsa, setCustomAsa] = useState<ASAStatus>('I');
  const [customProcedure, setCustomProcedure] = useState('Laparotomia Exploratória');
  const [customHistory, setCustomHistory] = useState('Exame pré-operatório sem alterações relevantes.');

  const handleCreateCustomPatient = () => {
    const speciesInfo = SPECIES_DATABASE[customSpecies];
    const newPatient: PatientProfile = {
      id: `custom_${Date.now()}`,
      name: customName,
      species: customSpecies,
      breed: customBreed,
      ageYears: customAgeYears,
      ageMonths: 0,
      weightKg: customWeight,
      gender: 'Macho',
      asa: customAsa,
      scenarioTitle: `Caso Personalizado: ${customName}`,
      scenarioDescription: `Paciente ${customSpecies} de ${customWeight}kg submetido a ${customProcedure}.`,
      clinicalHistory: customHistory,
      surgicalProcedure: customProcedure,
      baselineVitals: {
        hr: speciesInfo.normalVitals.hrTypical,
        rr: speciesInfo.normalVitals.rrTypical,
        sysBP: speciesInfo.normalVitals.sysBpMin + 20,
        diaBP: speciesInfo.normalVitals.diaBpMin + 15,
        map: speciesInfo.normalVitals.mapTypical,
        tempC: speciesInfo.normalVitals.tempTypicalC,
        spo2: 98,
        etco2: 38,
        bloodVolumeMl: Math.round(customWeight * speciesInfo.bloodVolumeMlPerKg),
        hctPct: 40,
        potassiumMeqL: 4.2,
        lactateMmolL: 1.2,
      },
      pathologyConditions: {},
    };

    onSelectScenario(newPatient);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d0d0d] border border-[#222222] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f] bg-[#080808]">
          <div className="flex items-center space-x-2">
            <FolderHeart className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-[#f5f5f5]">SELETOR DE CASOS CLÍNICOS & PACIENTES</h3>
              <p className="text-xs text-[#888888]">Escolha um cenário anestésico ou crie um novo paciente</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#888888] hover:text-[#f5f5f5] hover:bg-[#181818] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1f1f1f] bg-[#0a0a0a] px-4">
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-2.5 px-4 text-xs font-bold font-mono-code transition border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'presets'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#888888] hover:text-[#e5e5e5]'
            }`}
          >
            <span>CENÁRIOS CLÍNICOS PREDEFINIDOS (10)</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-2.5 px-4 text-xs font-bold font-mono-code transition border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'custom'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-[#888888] hover:text-[#e5e5e5]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CRIAR PACIENTE PERSONALIZADO</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRESET_SCENARIOS.map((scenario) => {
                const isCurrent = scenario.id === currentPatientId;
                return (
                  <div
                    key={scenario.id}
                    onClick={() => onSelectScenario(scenario)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between group ${
                      isCurrent
                        ? 'bg-[#0f2415] border-emerald-500 shadow-md shadow-emerald-950/40'
                        : 'bg-[#121212] border-[#222222] hover:border-[#333333] hover:bg-[#161616]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#f5f5f5] group-hover:text-emerald-300 transition">
                          {scenario.scenarioTitle}
                        </span>
                        <span
                          className={`text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full ${
                            scenario.asa === 'I'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : scenario.asa === 'II'
                              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                              : scenario.asa === 'III'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          ASA {scenario.asa}
                        </span>
                      </div>

                      <div className="text-xs text-[#d4d4d4] font-semibold mb-1">
                        {scenario.name} · {scenario.breed} ({scenario.weightKg} kg · {formatSpecies(scenario.species).toUpperCase()})
                      </div>

                      <p className="text-xs text-[#888888] line-clamp-2 mb-2">
                        {scenario.scenarioDescription}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#1f1f1f] flex items-center justify-between text-[11px] font-mono-code text-[#737373]">
                      <span>Cirurgia: {scenario.surgicalProcedure.split(' ')[0]}...</span>
                      {isCurrent ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="text-[#888888] group-hover:text-[#e5e5e5]">Selecionar →</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Custom Patient Form */
            <div className="max-w-xl mx-auto space-y-3 font-mono-code text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#888888] block mb-1">Nome do Paciente:</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#888888] block mb-1">Espécie:</label>
                  <select
                    value={customSpecies}
                    onChange={(e) => setCustomSpecies(e.target.value as SpeciesType)}
                    className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] capitalize focus:outline-none"
                  >
                    <option value="canine">Canino (Cão)</option>
                    <option value="feline">Felino (Gato)</option>
                    <option value="equine">Equino (Cavalo)</option>
                    <option value="bovine">Bovino</option>
                    <option value="rabbit">Coelho (Lagomorfo)</option>
                    <option value="avian">Ave / Exótico</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[#888888] block mb-1">Peso Corporal (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customWeight}
                    onChange={(e) => setCustomWeight(parseFloat(e.target.value) || 1)}
                    className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-emerald-400 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#888888] block mb-1">Idade (Anos):</label>
                  <input
                    type="number"
                    value={customAgeYears}
                    onChange={(e) => setCustomAgeYears(parseInt(e.target.value) || 1)}
                    className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#888888] block mb-1">Classificação ASA:</label>
                  <select
                    value={customAsa}
                    onChange={(e) => setCustomAsa(e.target.value as ASAStatus)}
                    className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] focus:outline-none"
                  >
                    <option value="I">ASA I (Hígido)</option>
                    <option value="II">ASA II (Leve)</option>
                    <option value="III">ASA III (Moderado/Grave)</option>
                    <option value="IV">ASA IV (Ameaça à vida)</option>
                    <option value="V">ASA V (Moribundo)</option>
                    <option value="E">ASA E (Emergência)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#888888] block mb-1">Procedimento Cirúrgico:</label>
                <input
                  type="text"
                  value={customProcedure}
                  onChange={(e) => setCustomProcedure(e.target.value)}
                  className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#888888] block mb-1">Histórico Clínico & Exames:</label>
                <textarea
                  rows={3}
                  value={customHistory}
                  onChange={(e) => setCustomHistory(e.target.value)}
                  className="w-full bg-[#121212] border border-[#282828] rounded-lg p-2 text-[#e5e5e5] focus:outline-none"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleCreateCustomPatient}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-black/40"
                >
                  CARREGAR E INICIAR SIMULAÇÃO DO PACIENTE
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
