import React, { useEffect, useState } from 'react';
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
  calculateAdministration,
  getRoutePharmacokinetics,
  getSpeciesDoseRange,
  isTimeBasedDoseUnit,
  validateAdministrationCommand,
} from '../../engine/drugAdministration';
import { hillResponse } from '../../engine/cellularReceptors';
import { analyzeDrugExposure } from '../../engine/exposureAnalysis';
import { formatDecimal, formatDose, formatSpecies } from '../../utils/formatters';
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
    const recommended = getSpeciesDoseRange(VETERINARY_DRUG_DATABASE[0], patient.species);
    return recommended?.typical ?? 0;
  });
  const [customConcentrationMgMl, setCustomConcentrationMgMl] = useState<number>(VETERINARY_DRUG_DATABASE[0].defaultConcentrationMgMl);
  const [isCRI, setIsCRI] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const recommended = getSpeciesDoseRange(selectedDrug, patient.species);
    setCustomDosePerKg(recommended?.typical ?? 0);
    setAdminErrorMsg(null);
  }, [patient.species, selectedDrug]);

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
    const hasValidatedRate = drug.doseUnit.includes('/min') || drug.doseUnit.includes('/h');
    const isDefaultCRI = hasValidatedRate && drug.supportedRoutes.includes('CRI');
    const recommended = getSpeciesDoseRange(drug, patient.species, isDefaultCRI);
    const initialDose = recommended?.typical ?? 0;
    setCustomDosePerKg(initialDose);
    setCustomConcentrationMgMl(drug.defaultConcentrationMgMl);
    setSelectedRoute(isDefaultCRI ? 'CRI' : (drug.supportedRoutes.find((route) => route !== 'CRI') || 'IV'));
    setIsCRI(isDefaultCRI);
    setAdminSpeed(isDefaultCRI ? 'infusion_cri' : 'bolus_slow');
  };

  const isRateDose = isTimeBasedDoseUnit(selectedDrug.doseUnit);
  const hasCriOption = Boolean(selectedDrug.recommendedCriDose?.[patient.species]);
  const canUseCRI = (isRateDose || hasCriOption) && selectedDrug.supportedRoutes.includes('CRI');
  const canUseBolus = !isRateDose && selectedDrug.supportedRoutes.some((route) => route !== 'CRI');
  const canUseRapidBolus = canUseBolus && selectedDrug.supportedRoutes.includes('IV');
  const recommendedRange = getSpeciesDoseRange(selectedDrug, patient.species, isCRI);
  const activeDoseUnit = (isCRI && selectedDrug.criDoseUnit) ? selectedDrug.criDoseUnit : selectedDrug.doseUnit;
  const selectableRoutes = selectedDrug.supportedRoutes.filter((route) => isCRI ? route === 'CRI' : route !== 'CRI');
  const routePK = getRoutePharmacokinetics(selectedDrug, selectedRoute);

  // Calculations for chosen drug and patient weight
  const calculatedAdministration = calculateAdministration(
    selectedDrug,
    customDosePerKg,
    patient.weightKg,
    customConcentrationMgMl,
    isCRI
  );
  const totalDoseAmount = calculatedAdministration.doseAmount;
  const calculatedVolumeMl = calculatedAdministration.volumeMl;

  const handleAdminister = () => {
    const validationErrors = validateAdministrationCommand(patient, selectedDrug, {
      route: selectedRoute,
      administrationSpeed: isCRI ? 'infusion_cri' : adminSpeed,
      isCRI,
      dosePerKg: customDosePerKg,
      concentrationMgMl: customConcentrationMgMl,
    });
    if (validationErrors.length > 0) {
      setAdminErrorMsg(validationErrors.join(' '));
      setAdminSuccessMsg(null);
      return;
    }
    const deliveryDuration = adminSpeed === 'bolus_rapid' ? 4 : adminSpeed === 'bolus_slow' ? 60 : 0;
    const ratePerMin = isCRI
      ? (activeDoseUnit.endsWith('/h') ? customDosePerKg / 60 : customDosePerKg)
      : undefined;

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
      transitLagRemainingSec: routePK.transitLagSeconds,
      isCRI: isCRI,
      isInfusionRunning: isCRI,
      criRatePerKgMin: ratePerMin,
      criRateMlPerHour: isCRI ? calculatedAdministration.pumpRateMlPerHour : undefined,
    });

    setAdminSuccessMsg(isCRI
      ? `CRI iniciada: ${selectedDrug.name} (${formatDecimal(customDosePerKg, 2)} ${activeDoseUnit}; ${formatDecimal(calculatedAdministration.pumpRateMlPerHour, 2)} mL/h)`
      : `Administrado: ${selectedDrug.name} (${formatDecimal(customDosePerKg, 2)} ${activeDoseUnit} = ${formatDecimal(calculatedVolumeMl, 2)} mL) [${adminSpeed.replace('_', ' ').toUpperCase()}]`
    );
    setAdminErrorMsg(null);
    setTimeout(() => setAdminSuccessMsg(null), 3500);
  };

  // Fast emergency quick dose trigger
  const handleQuickEmergencyDose = (drugId: string, speed: AdministrationSpeed = 'bolus_rapid') => {
    const drug = VETERINARY_DRUG_DATABASE.find((d) => d.id === drugId);
    if (!drug) return;

    const recommended = getSpeciesDoseRange(drug, patient.species);
    if (!recommended || isTimeBasedDoseUnit(drug.doseUnit)) {
      setAdminErrorMsg(`${drug.name} não possui dose rápida validada para ${patient.species}.`);
      return;
    }
    const dosePerKg = recommended.typical;
    const calculated = calculateAdministration(drug, dosePerKg, patient.weightKg);
    const totalDose = calculated.doseAmount;
    const volMl = calculated.volumeMl;

    const route: DrugRoute = drug.supportedRoutes.includes('IV')
      ? 'IV'
      : drug.supportedRoutes.includes('IV_slow')
        ? 'IV_slow'
        : drug.supportedRoutes.find((item) => item !== 'CRI') || 'IV';
    const effectiveSpeed: AdministrationSpeed = route === 'IV' ? speed : 'bolus_slow';
    const validationErrors = validateAdministrationCommand(patient, drug, {
      route,
      administrationSpeed: effectiveSpeed,
      isCRI: false,
      dosePerKg,
    });
    if (validationErrors.length > 0) {
      setAdminErrorMsg(validationErrors.join(' '));
      return;
    }

    onAdministerDrug({
      drugId: drug.id,
      drugName: drug.name,
      category: drug.category,
      route,
      administrationSpeed: effectiveSpeed,
      doseAmount: Number(totalDose.toFixed(3)),
      dosePerKg,
      volumeMl: volMl,
      deliveryDurationSec: effectiveSpeed === 'bolus_rapid' ? 4 : 60,
      transitLagRemainingSec: getRoutePharmacokinetics(drug, route).transitLagSeconds,
      isCRI: false,
    });

    setAdminSuccessMsg(`EMERGÊNCIA: Injetado ${drug.name} (${formatDecimal(dosePerKg, 2)} ${drug.doseUnit} = ${formatDecimal(volMl, 2)} mL)`);
    setTimeout(() => setAdminSuccessMsg(null), 3500);
  };

  // Check potential warnings
  const isBovineXylazineDanger = patient.species === 'bovine' && selectedDrug.id === 'xylazine' && customDosePerKg > 0.15;
  const isFelineLidocaineDanger = patient.species === 'feline' && selectedDrug.id === 'lidocaine_2pct' && selectedRoute.includes('IV') && (customDosePerKg > 1.0 || adminSpeed === 'bolus_rapid');
  const isFelinePropofolWarning = patient.species === 'feline' && selectedDrug.id === 'propofol';
  const isKclBolusDanger = selectedDrug.id === 'potassium_chloride' && (adminSpeed === 'bolus_rapid' || customDosePerKg > 0.6);
  const isPropofolFastApnea = selectedDrug.id === 'propofol' && adminSpeed === 'bolus_rapid';
  const isAlpha2RapidShock = (selectedDrug.id === 'dexmedetomidine' || selectedDrug.id === 'xylazine') && adminSpeed === 'bolus_rapid';
  const isAboveRecommendedMaximum = Boolean(recommendedRange && customDosePerKg > recommendedRange.max);

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
              Paciente: <strong className="text-white">{patient.name}</strong> · Peso: <strong className="text-emerald-400">{patient.weightKg} kg</strong> · Espécie: <strong className="text-cyan-300">{formatSpecies(patient.species).toUpperCase()}</strong>
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
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#2b0c0f] hover:bg-[#3d1217] border border-red-700/80 text-red-200 font-bold transition whitespace-nowrap"
            title="Epinefrina 0.01 mg/kg IV rápido na PCR"
          >
            Adrenalina (PCR)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('ephedrine', 'bolus_slow')}
            className="text-[10px] font-mono-code px-2 py-1 rounded bg-[#241a08] hover:bg-[#38280d] border border-amber-600/80 text-amber-200 font-bold transition whitespace-nowrap"
            title="Efedrina 0.1 mg/kg IV lento (Hipotensão / Inotrópico Misto)"
          >
            Efedrina (Hipotensão)
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
            Intralipid (Sequestro Lipídico)
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
          { id: 'antihypertensive', label: 'Anti-hipertensivos Agudos' },
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
            const rec = getSpeciesDoseRange(drug, patient.species);
            return (
              <div
                key={drug.id}
                onClick={() => handleSelectDrug(drug)}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#0f1a14] border-emerald-500/70 shadow-md shadow-black/40 ring-1 ring-emerald-500/50'
                    : rec
                      ? 'bg-[#121212] border-[#222222] hover:bg-[#181818] hover:border-[#2f2f2f]'
                      : 'bg-[#101010] border-[#1d1d1d] opacity-60'
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
                    {rec ? `${rec.typical} ${drug.doseUnit}` : 'sem faixa na espécie'}
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
                  min="0"
                  step={recommendedRange ? Math.max(0.001, (recommendedRange.max - recommendedRange.min) / 100) : 0.01}
                  value={customDosePerKg}
                  onChange={(e) => setCustomDosePerKg(parseFloat(e.target.value) || 0)}
                  disabled={!recommendedRange}
                  className="w-24 bg-[#0d0d0d] border border-[#333333] text-emerald-300 font-bold text-xs rounded px-2 py-1 text-right font-mono-code focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[#e5e5e5]">{activeDoseUnit}</span>
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
                  <span>Limite de referência: {recommendedRange.max} {activeDoseUnit}</span>
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
                Início por {selectedRoute}: ~{Math.round(routePK.transitLagSeconds)}s + equilíbrio de biofase
              </span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!canUseRapidBolus) return;
                  setAdminSpeed('bolus_rapid');
                  setIsCRI(false);
                  setSelectedRoute('IV');
                  const bolusRange = getSpeciesDoseRange(selectedDrug, patient.species, false);
                  if (bolusRange) setCustomDosePerKg(bolusRange.typical);
                }}
                disabled={!canUseRapidBolus}
                className={`p-2 rounded border text-left transition ${
                  adminSpeed === 'bolus_rapid' && !isCRI
                     ? 'bg-[#2b1414] border-red-500/80 text-red-200'
                    : canUseRapidBolus
                      ? 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                      : 'bg-[#101010] border-[#202020] text-[#4f4f4f] cursor-not-allowed'
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
                onClick={() => {
                  if (!canUseBolus) return;
                  setAdminSpeed('bolus_slow');
                  setIsCRI(false);
                  const bolusRoute = selectableRoutes.find((route) => route !== 'CRI') || 'IV_slow';
                  setSelectedRoute(bolusRoute);
                  const bolusRange = getSpeciesDoseRange(selectedDrug, patient.species, false);
                  if (bolusRange) setCustomDosePerKg(bolusRange.typical);
                }}
                disabled={!canUseBolus}
                className={`p-2 rounded border text-left transition ${
                  adminSpeed === 'bolus_slow' && !isCRI
                    ? 'bg-[#0f1f18] border-emerald-500/80 text-emerald-200'
                    : canUseBolus
                      ? 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                      : 'bg-[#101010] border-[#202020] text-[#4f4f4f] cursor-not-allowed'
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
                onClick={() => {
                  if (!canUseCRI) return;
                  setAdminSpeed('infusion_cri');
                  setIsCRI(true);
                  setSelectedRoute('CRI');
                  const criRange = getSpeciesDoseRange(selectedDrug, patient.species, true);
                  if (criRange) setCustomDosePerKg(criRange.typical);
                }}
                disabled={!canUseCRI}
                title={!canUseCRI ? 'O catálogo ainda não possui um regime de manutenção por tempo validado para este fármaco.' : undefined}
                className={`p-2 rounded border text-left transition ${
                  isCRI
                    ? 'bg-[#121f2b] border-cyan-500/80 text-cyan-200'
                    : canUseCRI
                      ? 'bg-[#141414] border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]'
                      : 'bg-[#101010] border-[#202020] text-[#4f4f4f] cursor-not-allowed'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-cyan-400">
                  <Clock className="w-3 h-3" />
                  Infusão CRI
                </div>
                <div className="text-[9px] text-[#888888] mt-0.5">{canUseCRI ? 'Bomba contínua' : 'Regime não cadastrado'}</div>
              </button>
            </div>

            {/* DYNAMIC CLINICAL PHARMACOKINETIC SAFETY WARNINGS */}
            {isAboveRecommendedMaximum && (
              <div className="p-2 rounded bg-[#35220d] border border-amber-500/80 text-[11px] text-amber-100 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">DOSE ACIMA DA FAIXA DE REFERÊNCIA:</strong>{' '}
                  {customDosePerKg} {selectedDrug.doseUnit} equivale a {(customDosePerKg / recommendedRange.max).toFixed(1)}× o limite catalogado. O motor aplicará efeitos adversos e toxicidade cumulativa.
                </div>
              </div>
            )}
            {!recommendedRange && (
              <div className="p-2 rounded bg-[#2a1d0d] border border-amber-700/70 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Sem regime curado para <strong>{patient.species}</strong>. O simulador não substituirá essa lacuna por uma dose canina.
                </span>
              </div>
            )}
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

            {isFelinePropofolWarning && (
              <div className="p-2 rounded bg-[#2b1f12] border border-amber-600/80 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">PARTICULARIDADE FELINA (UGT1A6):</strong> Felinos possuem deficiência congênita na glucuronidação fenólica. Doses repetidas ou infusões contínuas de propofol geram recuperação excessivamente lenta e risco de lesão oxidativa eritrocitária (corpúsculos de Heinz). Recomenda-se alfaxalona para manutenção em gatos.
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
              <span className="text-[10px] text-[#737373] block font-mono-code">
                {isCRI ? `Quantidade por ${selectedDrug.doseUnit.endsWith('/min') ? 'minuto' : 'hora'}` : `Dose total (${patient.weightKg} kg)`}:
              </span>
              <strong className="text-sm text-[#f5f5f5] font-mono-code font-bold">
                {formatDecimal(totalDoseAmount, 2)} {selectedDrug.unit}
              </strong>
            </div>

            <div className="p-2.5 bg-[#171717] rounded border border-[#262626]">
              <span className="text-[10px] text-[#737373] block font-mono-code">{isCRI ? 'Taxa calculada da bomba:' : 'Volume a injetar:'}</span>
              <strong className="text-base text-emerald-400 font-digital font-extrabold">
                {isCRI ? `${formatDecimal(calculatedAdministration.pumpRateMlPerHour, 2)} mL/h` : `${formatDecimal(calculatedVolumeMl, 2)} mL`}
              </strong>
            </div>

            <div className="p-2.5 bg-[#171717] rounded border border-[#262626]">
              <span className="text-[10px] text-[#737373] block font-mono-code">Via de Aplicação:</span>
              <select
                value={selectedRoute}
                onChange={(e) => {
                  const route = e.target.value as DrugRoute;
                  setSelectedRoute(route);
                  const routeIsCri = route === 'CRI';
                  setIsCRI(routeIsCri);
                  setAdminSpeed(routeIsCri ? 'infusion_cri' : 'bolus_slow');
                }}
                className="bg-[#0d0d0d] text-[#e5e5e5] text-xs rounded border border-[#333333] font-mono-code w-full px-1 py-0.5 mt-0.5 focus:outline-none"
              >
                {selectableRoutes.map((r) => (
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
              disabled={!recommendedRange || customDosePerKg <= 0 || selectableRoutes.length === 0}
              className={`w-full py-2.5 px-4 rounded-lg text-xs font-extrabold font-mono-code transition flex items-center justify-center space-x-2 shadow-lg shadow-black/50 ${
                !recommendedRange || customDosePerKg <= 0 || selectableRoutes.length === 0
                  ? 'bg-[#202020] text-[#666666] cursor-not-allowed'
                  : adminSpeed === 'bolus_rapid'
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
          {adminErrorMsg && (
            <div className="p-2 rounded bg-[#2b0c0f] border border-red-700/70 text-xs text-red-200 font-mono-code flex items-start space-x-2">
              <AlertOctagon className="w-4 h-4 shrink-0 text-red-400" />
              <span>{adminErrorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Drug Concentration / CRI Infusions Status Table */}
      {activeDoses.length > 0 && (
        <div className="mt-2 pt-3 border-t border-[#1f1f1f]">
          <h4 className="text-xs font-bold text-[#d4d4d4] mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            Fármacos ativos (exposição relativa no sítio efetor Ce e trânsito)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeDoses.map((dose) => {
              const inTransit = (dose.transitLagRemainingSec || 0) > 0;
              const definition = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === dose.drugId);
              const effectOccupancy = hillResponse(dose.currentCe);
              const exposure = definition ? analyzeDrugExposure(dose, definition) : undefined;
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
                      {formatDecimal(dose.dosePerKg, 2)} {dose.isCRI && definition?.criDoseUnit ? definition.criDoseUnit : (definition?.doseUnit || '')} · {dose.route} · {dose.isCRI
                        ? `${formatDecimal(dose.criRateMlPerHour, 2)} mL/h ${dose.isInfusionRunning === false ? '(interrompida; em eliminação)' : '(CRI)'}`
                        : `${formatDecimal(dose.volumeMl, 2)} mL (${dose.administrationSpeed?.replace('_', ' ') || 'bolus'})`}
                    </div>
                    {/* Visual Ce Bar */}
                    <div className="w-28 bg-[#222222] h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.round(effectOccupancy * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-emerald-400 font-bold block">
                      Ce rel.: {dose.currentCe.toFixed(2)}×
                    </span>
                    <span className="text-[10px] text-cyan-300 block">
                      Cp: {dose.currentCp.toFixed(2)}×
                    </span>
                    {exposure && (
                      <span className="text-[9px] text-amber-300 block">
                        {exposure.phaseLabel}{exposure.estimatedEffectMinutesRemaining !== undefined
                          ? ` · efeito <5% em ~${formatDecimal(exposure.estimatedEffectMinutesRemaining, 0)} min`
                          : ''}
                      </span>
                    )}
                    {dose.pkCompartments && (
                      <span
                        className="text-[9px] text-[#737373] block"
                        title={`Central ${dose.pkCompartments.centralAmountNormalized.toFixed(2)} · rápido ${dose.pkCompartments.rapidPeripheralAmountNormalized.toFixed(2)} · profundo ${dose.pkCompartments.deepPeripheralAmountNormalized.toFixed(2)} · eliminado ${dose.pkCompartments.cumulativeEliminatedNormalized.toFixed(2)}`}
                      >
                        Tecidos: {(dose.pkCompartments.rapidPeripheralAmountNormalized + dose.pkCompartments.deepPeripheralAmountNormalized).toFixed(2)}× · CL {dose.pkCompartments.effectiveClearanceMultiplier.toFixed(2)}×
                      </span>
                    )}
                    {dose.isCRI && dose.isInfusionRunning !== false && (
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
