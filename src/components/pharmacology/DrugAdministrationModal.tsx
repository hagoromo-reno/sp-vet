import React, { useState } from 'react';
import {
  ActiveDrugDose,
  AdministrationSpeed,
  DrugCategory,
  DrugDefinition,
  DrugRoute,
  PatientProfile,
} from '../../types/simulator';
import { VETERINARY_DRUG_DATABASE } from '../../data/drugDatabase';
import {
  Syringe,
  Search,
  Zap,
  Trash2,
  Clock,
  Check,
  AlertTriangle,
  AlertOctagon,
  Flame,
  ShieldAlert,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface DrugAdministrationModalProps {
  patient: PatientProfile;
  activeDoses: ActiveDrugDose[];
  onAdministerDrug: (dose: Omit<ActiveDrugDose, 'id' | 'administeredAtSimTime' | 'peakEffectSimTime' | 'currentCe' | 'currentCp' | 'deliveryElapsedSec' | 'isFullyDelivered' | 'isFastBolusShockTriggered'>) => void;
  onStopCRI: (doseId: string) => void;
}

export const DrugAdministrationModal: React.FC<DrugAdministrationModalProps> = ({
  patient,
  activeDoses,
  onAdministerDrug,
  onStopCRI,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DrugCategory | 'all'>('all');
  const [selectedDrug, setSelectedDrug] = useState<DrugDefinition>(VETERINARY_DRUG_DATABASE[0]);
  
  // Custom dosage inputs
  const [selectedRoute, setSelectedRoute] = useState<DrugRoute>('IV');
  const [adminSpeed, setAdminSpeed] = useState<AdministrationSpeed>('bolus_slow');
  const [customDosePerKg, setCustomDosePerKg] = useState<number>(() => {
    const recommended = VETERINARY_DRUG_DATABASE[0].recommendedDose[patient.species] || VETERINARY_DRUG_DATABASE[0].recommendedDose.canine;
    return recommended ? recommended.typical : 1.0;
  });
  const [customConcentrationMgMl, setCustomConcentrationMgMl] = useState<number>(VETERINARY_DRUG_DATABASE[0].defaultConcentrationMgMl);
  const [isCRI, setIsCRI] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  // Filtered drug catalog
  const filteredDrugs = VETERINARY_DRUG_DATABASE.filter((drug) => {
    const matchesSearch = drug.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drug.brandName && drug.brandName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' ||
      drug.category === selectedCategory ||
      (selectedCategory === 'antagonist_reversal' && drug.category === 'nmba_reversal');
    return matchesSearch && matchesCategory;
  });

  const handleSelectDrug = (drug: DrugDefinition) => {
    setSelectedDrug(drug);
    const recommended = drug.recommendedDose[patient.species] || drug.recommendedDose.canine;
    const initialDose = recommended ? recommended.typical : 1.0;
    setCustomDosePerKg(initialDose);
    setCustomConcentrationMgMl(drug.defaultConcentrationMgMl);
    setSelectedRoute(drug.supportedRoutes[0] || 'IV');
    const isDefaultCRI = drug.doseUnit.includes('/min') || drug.doseUnit.includes('/h');
    setIsCRI(isDefaultCRI);
    setAdminSpeed(isDefaultCRI ? 'infusion_cri' : drug.supportedRoutes.includes('IV_slow') ? 'bolus_slow' : 'bolus_slow');
  };

  // Calculations for chosen drug and patient weight
  const totalDoseAmount = Number((customDosePerKg * patient.weightKg).toFixed(3));
  
  // Calculate Volume in mL:
  let calculatedVolumeMl = 0;
  if (selectedDrug.unit === 'mcg') {
    const totalDoseMg = totalDoseAmount / 1000.0;
    calculatedVolumeMl = Number((totalDoseMg / customConcentrationMgMl).toFixed(3));
  } else if (selectedDrug.unit === 'mEq') {
    calculatedVolumeMl = Number((totalDoseAmount / 1.0).toFixed(2));
  } else {
    calculatedVolumeMl = Number((totalDoseAmount / customConcentrationMgMl).toFixed(3));
  }

  const handleAdminister = () => {
    const deliveryDuration = adminSpeed === 'bolus_rapid' ? 4 : adminSpeed === 'bolus_slow' ? 60 : 0;

    onAdministerDrug({
      drugId: selectedDrug.id,
      drugName: selectedDrug.name,
      category: selectedDrug.category,
      route: selectedRoute,
      administrationSpeed: isCRI ? 'infusion_cri' : adminSpeed,
      doseAmount: totalDoseAmount,
      dosePerKg: customDosePerKg,
      volumeMl: calculatedVolumeMl,
      deliveryDurationSec: deliveryDuration,
      transitLagRemainingSec: selectedDrug.transitLagSecondsIV || 20,
      isCRI: isCRI,
      criRatePerKgMin: isCRI ? customDosePerKg : undefined,
    });

    setAdminSuccessMsg(`Injetado: ${selectedDrug.name} (${customDosePerKg} ${selectedDrug.doseUnit} = ${calculatedVolumeMl} mL) [${adminSpeed.replace('_', ' ').toUpperCase()}]`);
    setTimeout(() => setAdminSuccessMsg(null), 3500);
  };

  // Fast emergency quick dose trigger
  const handleQuickEmergencyDose = (drugId: string, speed: AdministrationSpeed = 'bolus_rapid') => {
    const drug = VETERINARY_DRUG_DATABASE.find((d) => d.id === drugId);
    if (!drug) return;

    const recommended = drug.recommendedDose[patient.species] || drug.recommendedDose.canine;
    const dosePerKg = recommended?.typical || 1.0;
    const totalDose = dosePerKg * patient.weightKg;
    let volMl = 0;
    if (drug.unit === 'mcg') {
      volMl = Number(((totalDose / 1000) / drug.defaultConcentrationMgMl).toFixed(3));
    } else {
      volMl = Number((totalDose / drug.defaultConcentrationMgMl).toFixed(3));
    }

    onAdministerDrug({
      drugId: drug.id,
      drugName: drug.name,
      category: drug.category,
      route: 'IV',
      administrationSpeed: speed,
      doseAmount: Number(totalDose.toFixed(3)),
      dosePerKg,
      volumeMl: volMl,
      deliveryDurationSec: speed === 'bolus_rapid' ? 4 : 60,
      transitLagRemainingSec: drug.transitLagSecondsIV || 15,
      isCRI: false,
    });

    setAdminSuccessMsg(`EMERGÊNCIA: Injetado ${drug.name} (${dosePerKg} ${drug.doseUnit} = ${volMl} mL)`);
    setTimeout(() => setAdminSuccessMsg(null), 3500);
  };

  const recommendedRange = selectedDrug.recommendedDose[patient.species] || selectedDrug.recommendedDose.canine;

  // Check potential warnings
  const isBovineXylazineDanger = patient.species === 'bovine' && selectedDrug.id === 'xylazine' && customDosePerKg > 0.15;
  const isFelineLidocaineDanger = patient.species === 'feline' && selectedDrug.id === 'lidocaine_2pct' && selectedRoute.includes('IV') && (customDosePerKg > 1.0 || adminSpeed === 'bolus_rapid');
  const isKclBolusDanger = selectedDrug.id === 'potassium_chloride' && (adminSpeed === 'bolus_rapid' || customDosePerKg > 0.6);
  const isPropofolFastApnea = selectedDrug.id === 'propofol' && adminSpeed === 'bolus_rapid';
  const isAlpha2RapidShock = (selectedDrug.id === 'dexmedetomidine' || selectedDrug.id === 'xylazine') && adminSpeed === 'bolus_rapid';

  return (
    <div className="bg-[#0d0d0d] border border-[#222222] rounded-xl p-4 flex flex-col space-y-4 shadow-2xl">
      {/* Title & Patient Context Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-[#1f1f1f]">
        <div className="flex items-center space-x-2">
          <Syringe className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2">
              <span>FARMACOTERAPIA & SIMULADOR PK/PD</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c2e22] text-emerald-300 border border-emerald-600/40">
                MULTI-COMPARTIMENTAL
              </span>
            </h3>
            <span className="text-[11px] text-[#888888]">
              Paciente: <strong className="text-white">{patient.name}</strong> · Peso: <strong className="text-emerald-400">{patient.weightKg} kg</strong> · Espécie: <strong className="text-cyan-300">{patient.species.toUpperCase()}</strong>
            </span>
          </div>
        </div>

        {/* Quick Emergency Protocol Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto py-1">
          <span className="text-[10px] text-red-400 font-bold uppercase mr-1 flex items-center gap-0.5">
            <Flame className="w-3 h-3 text-red-500" />
            Emergência:
          </span>
          <button
            onClick={() => handleQuickEmergencyDose('epinephrine', 'bolus_rapid')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-700/80 text-red-200 font-bold transition"
            title="Epinefrina 0.01 mg/kg IV rápido na PCR"
          >
            Adrenalina (PCR)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('atropine', 'bolus_rapid')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#261f0c] hover:bg-[#382d12] border border-amber-600/80 text-amber-200 font-bold transition"
            title="Atropina 0.03 mg/kg IV na bradicardia severa"
          >
            Atropina (Bradicardia)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('atipamezole', 'bolus_slow')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#0c222b] hover:bg-[#12303d] border border-cyan-700/80 text-cyan-200 font-bold transition whitespace-nowrap"
            title="Atipamezol Reversão Alfa-2 (Dexmedetomidina/Xilazina)"
          >
            Atipamezol (Alfa-2)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('naloxone', 'bolus_rapid')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#1c0c2b] hover:bg-[#29123d] border border-purple-700/80 text-purple-200 font-bold transition whitespace-nowrap"
            title="Naloxona Reversão de Opioides (Metadona/Fentanil/Morfina)"
          >
            Naloxona (Opioide)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('flumazenil', 'bolus_slow')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#1a142b] hover:bg-[#261d3f] border border-violet-700/80 text-violet-200 font-bold transition whitespace-nowrap"
            title="Flumazenil Reversão de Benzodiazepínicos (Midazolam/Diazepam)"
          >
            Flumazenil (Benzo)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('sugammadex', 'bolus_rapid')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#0f2415] hover:bg-[#163620] border border-emerald-700/80 text-emerald-200 font-bold transition whitespace-nowrap"
            title="Sugamadex Reversão de Bloqueador NMBA"
          >
            Sugamadex (NMBA)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('lipid_emulsion_20', 'bolus_slow')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#2b220c] hover:bg-[#3d3112] border border-yellow-700/80 text-yellow-200 font-bold transition whitespace-nowrap"
            title="Emulsão Lipídica 20% Resgate de Intoxicação por Anestésicos Locais (Lidocaína em gatos / Bupivacaína)"
          >
            Intralipid (Lipid Sink)
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'premedication', label: 'Pré-Anestésicos (MPA)' },
          { id: 'induction', label: 'Indutores' },
          { id: 'opioid_analgesic', label: 'Opioides & Analgesia' },
          { id: 'emergency_inotrope', label: 'Emergência & Inotrópicos' },
          { id: 'antiarrhythmic', label: 'Antiarrítmicos' },
          { id: 'antagonist_reversal', label: 'Antagonistas (Reversão)' },
          { id: 'nmba', label: 'Bloqueadores NMBA' },
          { id: 'local_anesthetic', label: 'Anestésicos Locais' },
          { id: 'fluid_crystalloid', label: 'Fluidos & Sangue' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id as DrugCategory | 'all')}
            className={`px-2.5 py-1 rounded-full whitespace-nowrap transition font-medium text-[11px] ${
              selectedCategory === tab.id
                ? 'bg-emerald-600 text-white font-bold shadow'
                : 'bg-[#181818] border border-[#282828] text-[#888888] hover:text-[#e5e5e5] hover:bg-[#222222]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-[#666666] absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Buscar por nome, marca ou categoria (ex: propofol, xilazina, morfina, atracurio)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 bg-[#141414] border border-[#2a2a2a] rounded-lg text-xs text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-emerald-500 font-mono-code"
        />
      </div>

      {/* Main Grid: Catalog List vs Selected Drug Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Drug Selection List (5 cols) */}
        <div className="lg:col-span-5 max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
          {filteredDrugs.map((drug) => {
            const isSelected = selectedDrug.id === drug.id;
            const rec = drug.recommendedDose[patient.species] || drug.recommendedDose.canine;
            return (
              <div
                key={drug.id}
                onClick={() => handleSelectDrug(drug)}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#0f1a14] border-emerald-500/70 shadow-md shadow-black/40 ring-1 ring-emerald-500/50'
                    : 'bg-[#121212] border-[#222222] hover:bg-[#181818] hover:border-[#2f2f2f]'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-xs font-bold text-[#f5f5f5] flex items-center gap-1.5 truncate">
                    <span>{drug.name}</span>
                    {drug.brandName && (
                      <span className="text-[10px] text-[#737373] font-normal truncate">
                        ({drug.brandName})
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#888888] truncate mt-0.5">
                    {drug.description}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-[#181818] border border-[#262626] text-emerald-400 font-semibold block">
                    {rec?.typical || 1.0} {drug.doseUnit}
                  </span>
                  <span className="text-[9px] text-[#666666] font-mono-code">
                    Lag: {drug.transitLagSecondsIV || 20}s
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Drug Precision Calculator & Velocity Station (7 cols) */}
        <div className="lg:col-span-7 bg-[#121212] border border-[#222222] rounded-lg p-4 flex flex-col justify-between space-y-3">
          {/* Header Info */}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-emerald-400 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                {selectedDrug.name}
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#a3a3a3] font-mono-code uppercase">
                {selectedDrug.category.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-[#888888] mt-1">{selectedDrug.description}</p>
          </div>

          {/* Dosing Slider & Manual Input */}
          <div className="bg-[#171717] p-3 rounded-lg border border-[#262626] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-code">
              <span className="text-[#a3a3a3]">Dose ajustada por kg ({selectedDrug.doseUnit}):</span>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.01"
                  value={customDosePerKg}
                  onChange={(e) => setCustomDosePerKg(parseFloat(e.target.value) || 0)}
                  className="w-24 bg-[#0d0d0d] border border-[#333333] text-emerald-300 font-bold text-xs rounded px-2 py-1 text-right font-mono-code focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[#e5e5e5]">{selectedDrug.doseUnit}</span>
              </div>
            </div>

            {recommendedRange && (
              <div>
                <input
                  type="range"
                  min={recommendedRange.min * 0.2}
                  max={recommendedRange.max * 2.5}
                  step={(recommendedRange.max - recommendedRange.min) / 40 || 0.01}
                  value={customDosePerKg}
                  onChange={(e) => setCustomDosePerKg(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-[#262626] rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono-code text-[#737373] mt-0.5">
                  <span>Mín: {recommendedRange.min}</span>
                  <span className="text-emerald-400 font-bold">Típica ({patient.species}): {recommendedRange.typical}</span>
                  <span>Máx Seguro: {recommendedRange.max} {selectedDrug.doseUnit}</span>
                </div>
              </div>
            )}
          </div>

          {/* ADMINISTRATION SPEED & VELOCITY SELECTION (Bolus Rapid vs Bolus Slow vs CRI) */}
          <div className="bg-[#171717] p-3 rounded-lg border border-[#262626] space-y-2">
            <label className="text-[11px] font-bold text-[#e0e0e0] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Modo e Velocidade de Aplicação:
              </span>
              <span className="text-[10px] text-[#888888] font-mono-code">
                Atraso de Circulação (Lag): {selectedDrug.transitLagSecondsIV || 20}s
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setAdminSpeed('bolus_rapid'); setIsCRI(false); }}
                className={`p-2 rounded border text-left transition ${
                  adminSpeed === 'bolus_rapid' && !isCRI
                    ? 'bg-[#2b1414] border-red-500/80 text-red-200'
                    : 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-red-400">
                  <Zap className="w-3 h-3" />
                  Bólus Rápido
                </div>
                <div className="text-[9px] text-[#888888] mt-0.5">Push direto (&lt; 5s)</div>
              </button>

              <button
                type="button"
                onClick={() => { setAdminSpeed('bolus_slow'); setIsCRI(false); }}
                className={`p-2 rounded border text-left transition ${
                  adminSpeed === 'bolus_slow' && !isCRI
                    ? 'bg-[#0f1f18] border-emerald-500/80 text-emerald-200'
                    : 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-emerald-400">
                  <Clock className="w-3 h-3" />
                  Bólus Lento
                </div>
                <div className="text-[9px] text-[#888888] mt-0.5">Infusão em 60s</div>
              </button>

              <button
                type="button"
                onClick={() => { setAdminSpeed('infusion_cri'); setIsCRI(true); }}
                className={`p-2 rounded border text-left transition ${
                  isCRI
                    ? 'bg-[#121f2b] border-cyan-500/80 text-cyan-200'
                    : 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-cyan-400">
                  <Clock className="w-3 h-3" />
                  Infusão CRI
                </div>
                <div className="text-[9px] text-[#888888] mt-0.5">Bomba Contínua</div>
              </button>
            </div>

            {/* DYNAMIC CLINICAL PHARMACOKINETIC SAFETY WARNINGS */}
            {isPropofolFastApnea && (
              <div className="p-2 rounded bg-[#2b1212] border border-red-500/80 text-[11px] text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-red-300">ALERTA FARMACOLÓGICO:</strong> Bólus rápido de Propofol causará apneia imediata (92% de probabilidade) e queda abrupta da PAM por vasodilatação periférica severa.
                </div>
              </div>
            )}

            {isAlpha2RapidShock && (
              <div className="p-2 rounded bg-[#2b1c12] border border-amber-500/80 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">ALERTA ALFA-2:</strong> Bólus rápido de agonista alfa-2 provoca pico transitório de vasoconstrição periférica seguido de intensa bradicardia reflexa e Bloqueio AV de 2º grau.
                </div>
              </div>
            )}

            {isBovineXylazineDanger && (
              <div className="p-2 rounded bg-[#3b0d10] border border-red-600 text-[11px] text-red-200 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-red-300">PERIGO LETAL EM BOVINO:</strong> Bovinos são 10x mais sensíveis a agonistas alfa-2 que equinos. Essa dose causará colapso cardiovascular agudo e parada respiratória fatal!
                </div>
              </div>
            )}

            {isFelineLidocaineDanger && (
              <div className="p-2 rounded bg-[#3b0d10] border border-red-600 text-[11px] text-red-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-red-300">TOXICIDADE GRAVE EM GATO:</strong> Felinos têm deficiência enzimática para depuração de lidocaína IV. Bólus rápido provoca colapso neuro/cardiotóxico fulminante e parada cardíaca!
                </div>
              </div>
            )}

            {isKclBolusDanger && (
              <div className="p-2 rounded bg-[#3b0d10] border border-red-600 text-[11px] text-red-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-red-300">LETALIDADE MÁXIMA:</strong> Cloreto de potássio NUNCA deve ser aplicado em bólus rápido IV! Provocará hipercalemia aguda, fibrilação ventricular e parada cardíaca imediata em assistolia!
                </div>
              </div>
            )}
          </div>

          {/* Calculated Output Display & Syringe */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="p-2.5 bg-[#171717] rounded border border-[#262626]">
              <span className="text-[10px] text-[#737373] block font-mono-code">Dose Total ({patient.weightKg}kg):</span>
              <strong className="text-sm text-[#f5f5f5] font-mono-code font-bold">
                {totalDoseAmount} {selectedDrug.unit}
              </strong>
            </div>

            <div className="p-2.5 bg-[#171717] rounded border border-[#262626]">
              <span className="text-[10px] text-[#737373] block font-mono-code">Volume a Injetar:</span>
              <strong className="text-base text-emerald-400 font-digital font-extrabold">
                {calculatedVolumeMl} mL
              </strong>
            </div>

            <div className="p-2.5 bg-[#171717] rounded border border-[#262626]">
              <span className="text-[10px] text-[#737373] block font-mono-code">Via de Aplicação:</span>
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value as DrugRoute)}
                className="bg-[#0d0d0d] text-[#e5e5e5] text-xs rounded border border-[#333333] font-mono-code w-full px-1 py-0.5 mt-0.5 focus:outline-none"
              >
                {selectedDrug.supportedRoutes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Administration Button */}
          <div className="pt-1">
            <button
              onClick={handleAdminister}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono-code transition flex items-center justify-center space-x-2 shadow-lg shadow-black/50 ${
                adminSpeed === 'bolus_rapid'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Syringe className="w-4 h-4" />
              <span>
                {isCRI
                  ? `INICIAR INFUSÃO CONTÍNUA (CRI) ${customDosePerKg} ${selectedDrug.doseUnit}`
                  : `ADMINISTRAR ${calculatedVolumeMl} mL (${selectedRoute}) — ${adminSpeed.replace('_', ' ').toUpperCase()}`}
              </span>
            </button>
          </div>

          {adminSuccessMsg && (
            <div className="p-2 rounded bg-[#0f1a14] border border-emerald-500/60 text-xs text-emerald-300 font-mono-code flex items-center space-x-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{adminSuccessMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Drug Concentration / CRI Infusions Status Table */}
      {activeDoses.length > 0 && (
        <div className="mt-2 pt-3 border-t border-[#1f1f1f]">
          <h4 className="text-xs font-bold text-[#d4d4d4] mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Fármacos Ativos no Paciente (Concentração no Sítio Efetor Ce & Tempo de Trânsito)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeDoses.map((dose) => {
              const inTransit = (dose.transitLagRemainingSec || 0) > 0;
              return (
                <div
                  key={dose.id}
                  className="p-2.5 bg-[#121212] border border-[#222222] rounded-lg flex items-center justify-between text-xs font-mono-code"
                >
                  <div>
                    <div className="font-bold text-[#f5f5f5] flex items-center gap-1">
                      <span>{dose.drugName}</span>
                      {inTransit && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-600/50">
                          Trânsito: {Math.ceil(dose.transitLagRemainingSec || 0)}s
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#888888]">
                      {dose.dosePerKg} {dose.route} · {dose.volumeMl} mL ({dose.administrationSpeed?.replace('_', ' ') || 'bolus'}) {dose.isCRI ? '(CRI)' : ''}
                    </div>
                    {/* Visual Ce Bar */}
                    <div className="w-28 bg-[#222222] h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round(dose.currentCe * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-emerald-400 font-bold block">
                      Ce: {(dose.currentCe * 100).toFixed(0)}%
                    </span>
                    {dose.isCRI && (
                      <button
                        onClick={() => onStopCRI(dose.id)}
                        className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-[#2b0c0f] text-red-300 border border-red-800/80 hover:bg-[#3d1217] transition flex items-center gap-0.5"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Parar CRI</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
