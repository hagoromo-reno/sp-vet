import { getDrugFormulations, volumePerDoseUnit } from '../../data/drugFormulations';
import React, { useEffect, useState } from 'react';
import { EMERGENCY_DRUG_IDS } from '../../data/emergencyDrugs';
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
  getSpeciesDrugRoutes,
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
  requestedDrugId?: string;
  patient: PatientProfile;
  activeDoses: ActiveDrugDose[];
  onAdministerDrug: (dose: Omit<ActiveDrugDose, 'id' | 'administeredAtSimTime' | 'peakEffectSimTime' | 'currentCe' | 'currentCp' | 'deliveryElapsedSec' | 'isFullyDelivered' | 'isFastBolusShockTriggered'>) => void;
  onStopCRI: (doseId: string) => void;
}

const DRUG_CATEGORIES = [
          { id: 'all', label: 'Todos' },
          { id: 'emergency', label: 'Emergência & Reversores' },
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
        ] as const;

export const DrugAdministrationModal: React.FC<DrugAdministrationModalProps> = ({
  patient,
  activeDoses,
  onAdministerDrug,
  onStopCRI,
  requestedDrugId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DrugCategory | 'all' | 'emergency'>('all');
  const [selectedDrug, setSelectedDrug] = useState<DrugDefinition>(VETERINARY_DRUG_DATABASE[0]);
  
  // Custom dosage inputs
  const [selectedRoute, setSelectedRoute] = useState<DrugRoute>('IV');
  const [adminSpeed, setAdminSpeed] = useState<AdministrationSpeed>('bolus_slow');
  const [customDosePerKg, setCustomDosePerKg] = useState<number>(() => {
    const recommended = getSpeciesDoseRange(VETERINARY_DRUG_DATABASE[0], patient.species);
    return recommended ? (recommended.min + recommended.max) / 2 : 0;
  });
  const [preparationId, setPreparationId] = useState(getDrugFormulations(VETERINARY_DRUG_DATABASE[0])[0].id);
  const preparations = getDrugFormulations(selectedDrug);
  const preparation = preparations.find(item => item.id === preparationId) ?? preparations[0];
  const customConcentrationMgMl = preparation.concentrationMgMl;
  const [isCRI, setIsCRI] = useState(false);
  const [deliverySeconds, setDeliverySeconds] = useState(60);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const recommended = getSpeciesDoseRange(selectedDrug, patient.species, isCRI);
    setCustomDosePerKg(recommended ? (recommended.min + recommended.max) / 2 : 0);
    setAdminErrorMsg(null);
  }, [patient.species, patient.weightKg, selectedDrug, isCRI, preparationId]);

  // Helper to normalize strings for accent-insensitive search
  const normalizeSearch = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Filtered drug catalog
  const filteredDrugs = VETERINARY_DRUG_DATABASE.filter((drug) => {
    const q = normalizeSearch(searchQuery.trim());
    const matchesSearch = !q ||
      normalizeSearch(drug.name).includes(q) ||
      (drug.brandName && normalizeSearch(drug.brandName).includes(q)) ||
      (drug.aliases && drug.aliases.some(alias => normalizeSearch(alias).includes(q))) ||
      normalizeSearch(drug.description).includes(q) ||
      normalizeSearch(drug.category).includes(q) ||
      (q.includes('nalox') && drug.id === 'naloxone') ||
      (q.includes('naxol') && drug.id === 'naloxone') ||
      (q.includes('atipa') && drug.id === 'atipamezole') ||
      (q.includes('fluma') && drug.id === 'flumazenil') ||
      (q.includes('revers') && (drug.category === 'antagonist_reversal' || drug.category === 'nmba_reversal'));

    const isEmergencyDrug = EMERGENCY_DRUG_IDS.has(drug.id) ||
      drug.category === 'antagonist_reversal' ||
      drug.category === 'nmba_reversal' ||
      drug.category === 'emergency_inotrope';

    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'emergency' && isEmergencyDrug) ||
      drug.category === selectedCategory ||
      (selectedCategory === 'fluid_crystalloid' && (drug.category === 'fluid_colloid' || drug.category === 'blood_product')) ||
      (selectedCategory === 'antagonist_reversal' && (drug.category === 'antagonist_reversal' || drug.category === 'nmba_reversal')) ||
      (selectedCategory === 'emergency_inotrope' && (drug.category === 'emergency_inotrope' || drug.id === 'epinephrine' || drug.id === 'norepinephrine' || drug.id === 'dobutamine' || drug.id === 'ephedrine'));

    const hasSpeciesRegimen = Boolean(getSpeciesDoseRange(drug, patient.species) || getSpeciesDoseRange(drug, patient.species, true));
    return matchesSearch && matchesCategory && hasSpeciesRegimen;
  });

  const handleSelectDrug = (drug: DrugDefinition) => {
    setSelectedDrug(drug);
    setDeliverySeconds(drug.id === 'calcium_gluconate' ? 600 : 60);
    const hasValidatedRate = drug.doseUnit.includes('/min') || drug.doseUnit.includes('/h');
    const isDefaultCRI = hasValidatedRate && getSpeciesDrugRoutes(drug, patient.species).includes('CRI');
    const recommended = getSpeciesDoseRange(drug, patient.species, isDefaultCRI);
    const initialDose = recommended ? (recommended.min + recommended.max) / 2 : 0;
    setCustomDosePerKg(initialDose);
    setPreparationId(getDrugFormulations(drug)[0].id);
    const routes = getSpeciesDrugRoutes(drug, patient.species);
    // For emergency / reversal drugs, prefer IV if available, then IV_slow, then IM
    const defaultRoute = isDefaultCRI ? 'CRI' : (
      routes.includes('IV') ? 'IV' : routes.includes('IV_slow') ? 'IV_slow' : routes.find(r => r !== 'CRI') || 'IV'
    );
    setSelectedRoute(defaultRoute);
    setIsCRI(isDefaultCRI);
    setAdminSpeed(isDefaultCRI ? 'infusion_cri' : (drug.category === 'antagonist_reversal' && drug.id === 'naloxone' ? 'bolus_rapid' : 'bolus_slow'));
  };

  useEffect(() => {
    const availableDrug = getSpeciesDoseRange(selectedDrug, patient.species)
      ? selectedDrug
      : VETERINARY_DRUG_DATABASE.find(drug => getSpeciesDoseRange(drug, patient.species));
    if (availableDrug) handleSelectDrug(availableDrug);
  }, [patient.species]);

  useEffect(() => {
    const drug = VETERINARY_DRUG_DATABASE.find(item => item.id === requestedDrugId);
    if (drug) { setSelectedCategory('emergency'); setSearchQuery(''); handleSelectDrug(drug); }
  }, [requestedDrugId]);

  const isRateDose = isTimeBasedDoseUnit(selectedDrug.doseUnit);
  const hasCriOption = Boolean(selectedDrug.recommendedCriDose?.[patient.species]);
  const canUseCRI = (isRateDose || hasCriOption) && getSpeciesDrugRoutes(selectedDrug, patient.species).includes('CRI');
  const canUseBolus = !isRateDose && getSpeciesDrugRoutes(selectedDrug, patient.species).some((route) => route !== 'CRI');
  const canUseRapidBolus = canUseBolus && getSpeciesDrugRoutes(selectedDrug, patient.species).includes('IV');
  const recommendedRange = getSpeciesDoseRange(selectedDrug, patient.species, isCRI);
  const activeDoseUnit = (isCRI && selectedDrug.criDoseUnit) ? selectedDrug.criDoseUnit : selectedDrug.doseUnit;
  const selectableRoutes = getSpeciesDrugRoutes(selectedDrug, patient.species).filter((route) => isCRI ? route === 'CRI' : route !== 'CRI');
  const routePK = getRoutePharmacokinetics(selectedDrug, selectedRoute);
  const isExtravascularInjection = selectedRoute === 'SC' || selectedRoute === 'IM';

  // Calculations for chosen drug and patient weight
  const calculatedAdministration = calculateAdministration(
    selectedDrug,
    customDosePerKg,
    patient.weightKg,
    customConcentrationMgMl,
    isCRI
  );
  const volumeFactor = volumePerDoseUnit(selectedDrug, patient.weightKg, customConcentrationMgMl, isCRI);
  const selectedVolume = customDosePerKg * volumeFactor;
  const volumeUnit = isCRI ? 'mL/h' : 'mL';
  const describeAmount = (dose: number) => {
    const volume = dose * volumeFactor;
    if (activeDoseUnit.startsWith('ml/kg')) return `${formatDecimal(volume, 4)} ${volumeUnit}`;
    const nativeAmount = dose * patient.weightKg * (isCRI && activeDoseUnit.endsWith('/min') ? 60 : 1);
    const mass = selectedDrug.unit === 'mcg' ? nativeAmount / 1000 : nativeAmount;
    return `${formatDecimal(mass, 4)} ${selectedDrug.unit === 'mEq' ? 'mEq' : 'mg'}${isCRI ? '/h' : ''} · ${formatDecimal(volume, 4)} ${volumeUnit}`;
  };
  const totalDoseAmount = calculatedAdministration.doseAmount;
  const calculatedVolumeMl = calculatedAdministration.volumeMl;

  const handleAdminister = () => {
    const validationErrors = validateAdministrationCommand(patient, selectedDrug, {
      route: selectedRoute,
      administrationSpeed: isCRI ? 'infusion_cri' : adminSpeed,
      isCRI,
      dosePerKg: customDosePerKg,
      concentrationMgMl: customConcentrationMgMl,
      deliveryDurationSec: isCRI ? undefined : adminSpeed === 'bolus_rapid' ? 4 : deliverySeconds,
    });
    if (validationErrors.length > 0) {
      setAdminErrorMsg(validationErrors.join(' '));
      setAdminSuccessMsg(null);
      return;
    }
    const deliveryDuration = adminSpeed === 'bolus_rapid' ? 4 : adminSpeed === 'bolus_slow' ? deliverySeconds : 0;
    const ratePerMin = isCRI
      ? (activeDoseUnit.endsWith('/h') ? customDosePerKg / 60 : customDosePerKg)
      : undefined;

    onAdministerDrug({
      preparation: { ...preparation },
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
      : `Administrado: ${selectedDrug.name} (${formatDecimal(customDosePerKg, 2)} ${activeDoseUnit} = ${formatDecimal(calculatedVolumeMl, 4)} mL) [${adminSpeed.replace('_', ' ').toUpperCase()}]`
    );
    setAdminErrorMsg(null);
    setTimeout(() => setAdminSuccessMsg(null), 3500);
  };

  // Emergency shortcuts open the same dose editor; they never inject a preset.
  const handleQuickEmergencyDose = (drugId: string, speed?: AdministrationSpeed) => {
    const drug = VETERINARY_DRUG_DATABASE.find(item => item.id === drugId);
    if (!drug) return;
    setSelectedCategory('emergency');
    setSearchQuery('');
    handleSelectDrug(drug);
    if (speed) setAdminSpeed(speed);
    const routes = getSpeciesDrugRoutes(drug, patient.species);
    if (routes.includes('IV')) {
      setSelectedRoute('IV');
    } else if (routes.includes('IV_slow')) {
      setSelectedRoute('IV_slow');
    }
    setAdminSuccessMsg(null);
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
    <div className="bg-[#0f0f12] border border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col space-y-4 shadow-2xl font-sans text-zinc-100">
      {/* Top Header: Title & Context & Emergency Toolbar */}
      <div className="flex flex-col gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700/50 text-emerald-400">
              <Syringe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Prescrição e administração
                </h3>

              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Paciente: <strong className="text-white font-medium">{patient.name}</strong> · Peso: <strong className="text-emerald-300 font-medium">{patient.weightKg} kg</strong> · Espécie: <strong className="text-cyan-300 font-medium">{formatSpecies(patient.species).toUpperCase()}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Emergency Quick-Dose Strip */}
        <details className="drug-quick-picks">
          <summary>Seleção rápida · Emergência e reversores</summary>
          <div>

          <button
            onClick={() => handleQuickEmergencyDose('epinephrine', 'bolus_rapid')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-600/70 text-rose-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Epinefrina 0.01 mg/kg IV rápido na PCR"
          >
            Adrenalina (PCR)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('ephedrine', 'bolus_slow')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Efedrina 0.1 mg/kg IV lento (Hipotensão)"
          >
            Efedrina (Hipotensão)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('atropine', 'bolus_rapid')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Atropina 0.03 mg/kg IV na bradicardia severa"
          >
            Atropina (Bradicardia)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('atipamezole', 'bolus_slow')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/70 text-cyan-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Atipamezol Reversão Alfa-2"
          >
            Atipamezol (Alfa-2)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('naloxone', 'bolus_rapid')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-600/70 text-purple-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Naloxona Reversão de Opioides"
          >
            Naloxona (Opioide)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('flumazenil', 'bolus_slow')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-600/70 text-indigo-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Flumazenil Reversão de Benzodiazepínicos"
          >
            Flumazenil (Benzo)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('sugammadex', 'bolus_rapid')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Sugamadex Reversão de Bloqueador NMBA"
          >
            Sugamadex (NMBA)
          </button>
          <button
            onClick={() => handleQuickEmergencyDose('lipid_emulsion_20', 'bolus_slow')}
            className="text-[11px] font-mono-code font-bold px-2.5 py-1 rounded bg-yellow-950/80 hover:bg-yellow-900 border border-yellow-600/70 text-yellow-100 transition whitespace-nowrap shadow-sm cursor-pointer"
            title="Emulsão Lipídica 20% Resgate de Intoxicação por Anestésicos Locais"
          >
            Intralipid (20%)
          </button>
          </div>
        </details>
      </div>

      <div className="drug-filters">
        <label>Buscar medicamento
          <input type="search" placeholder="Nome, marca ou categoria…" value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)} />
        </label>
        <label>Categoria
          <select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value as DrugCategory | 'all' | 'emergency')}>
            {DRUG_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
      </div>

      {/* Main Two-Column Layout */}
      <p className="text-xs text-zinc-400">{filteredDrugs.length} medicamentos ou soluções com regime cadastrado para {formatSpecies(patient.species)}. Doses e taxas de infusão são específicas da espécie.</p>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Drug Selection List (5 cols) */}
        <div className="lg:col-span-5 max-h-[390px] overflow-y-auto space-y-1.5 pr-1">
          {filteredDrugs.length === 0 && <div className="empty-search">
            <p>Nenhum medicamento encontrado.</p><p className="mt-1 text-xs">Tente outro nome ou altere a categoria.</p>
            <button className="ui-button" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>Limpar filtros</button>
          </div>}
          {filteredDrugs.map((drug) => {
            const isSelected = selectedDrug.id === drug.id;
            const rec = getSpeciesDoseRange(drug, patient.species);
            return (
              <button type="button" aria-pressed={isSelected}
                key={drug.id}
                onClick={() => handleSelectDrug(drug)}
                className={`drug-choice p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500/60'
                    : rec
                      ? 'bg-zinc-900/80 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700'
                      : 'bg-zinc-950/50 border-zinc-850 opacity-60'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <span>{drug.name}</span>
                    {EMERGENCY_DRUG_IDS.has(drug.id) && <span className="text-[10px] text-rose-300">EMERGÊNCIA</span>}
                    {drug.brandName && (
                      <span className="text-[11px] text-zinc-400 font-normal truncate">
                        ({drug.brandName})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {drug.description}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono-code">
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold block">
                    {rec ? `${rec.typical} ${drug.doseUnit}` : 'sem dose'}
                  </span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Lag: {drug.transitLagSecondsIV || 20}s
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Drug Precision Calculator & Velocity Station (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-xl">
          {/* Header Info */}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-base font-extrabold text-emerald-400 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                {selectedDrug.name}
              </h4>
              <span className="text-[10px] px-2.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono-code uppercase font-semibold">
                {DRUG_CATEGORIES.find(category => category.id === selectedDrug.category)?.label ?? selectedDrug.category}
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{selectedDrug.description}</p>
            {selectedDrug.evidenceNote && <div className="mt-3 rounded border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              <strong>{selectedDrug.experimentalRegimen ? 'Referência experimental · simulação' : 'Evidência e limites do regime'}</strong>
              <p className="mt-1 leading-relaxed">{selectedDrug.evidenceNote}</p>
            </div>}
          </div>

          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-3 text-xs">
            <label className="block">Frasco / apresentação
              <select aria-label="Frasco / apresentação" className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded p-2" value={preparation.id} onChange={event => setPreparationId(event.target.value)}>
                {preparations.map(item => <option key={item.id} value={item.id}>{item.name} · {item.label}{item.vialVolumeMl ? ` · ${item.vialVolumeMl} mL` : ''}</option>)}
              </select>
            </label>
            {preparation.sourceUrl && <a className="text-cyan-300 underline" href={preparation.sourceUrl} target="_blank" rel="noreferrer">Consultar apresentação no fabricante</a>}
            <p className="text-zinc-400">Ao trocar a apresentação, o volume inicia na média aritmética da faixa. Faixas informativas do simulador para a espécie e o modo selecionados.</p>
            <label className="flex justify-between items-center gap-2">{isCRI ? 'Taxa da bomba' : 'Volume a aspirar'} ({volumeUnit})
              <input aria-label={isCRI ? 'Taxa em mL por hora' : 'Volume em mL'} type="number" min="0" step="any" value={Number.isFinite(selectedVolume) ? Number(selectedVolume.toPrecision(10)) : 0}
                onChange={event => setCustomDosePerKg(Number(event.target.value) / volumeFactor)}
                className="w-32 bg-zinc-900 border border-zinc-700 rounded p-2 text-emerald-300" />
            </label>
            {recommendedRange && <>
              <input aria-label="Ajustar volume" type="range" min="0" max={recommendedRange.max * volumeFactor * 2.5} step="any" value={selectedVolume}
                onChange={event => setCustomDosePerKg(Number(event.target.value) / volumeFactor)} className="w-full accent-emerald-500" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300">
                <div>Mínimo de referência<br />{describeAmount(recommendedRange.min)}</div>
                <div className="text-emerald-300">Média da faixa<br />{describeAmount((recommendedRange.min + recommendedRange.max) / 2)}</div>
                <div>Máximo de referência<br />{describeAmount(recommendedRange.max)}</div>
              </div>
            </>}
            <p className="text-emerald-300 font-bold">Quantidade selecionada: {describeAmount(customDosePerKg)}</p>
            <p>Dose resultante: {formatDecimal(customDosePerKg, 4)} {activeDoseUnit} · Paciente: {patient.weightKg} kg</p>
            {!isCRI && preparation.vialVolumeMl && selectedVolume > preparation.vialVolumeMl && <p className="text-amber-300">O volume exige {Math.ceil(selectedVolume / preparation.vialVolumeMl)} frascos desta apresentação.</p>}
          </div>

          {!isCRI && adminSpeed === 'bolus_slow' && (selectedRoute === 'IV' || selectedRoute === 'IV_slow') && (
            <label className="flex items-center justify-between gap-3 text-xs text-zinc-300">
              Tempo de administração (segundos)
              <input aria-label="Tempo de administração em segundos" type="number" min="1" max="3600" value={deliverySeconds}
                onChange={event => setDeliverySeconds(Number(event.target.value))}
                className="w-28 bg-zinc-950 border border-zinc-700 rounded p-2 text-emerald-300" />
            </label>
          )}
          {/* Mode and Velocity Selection */}
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2">
            <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Modo e Velocidade de Aplicação:
              </span>
              <span className="text-[11px] text-zinc-400 font-mono-code font-normal">
                Início ({selectedRoute}): ~{Math.round(routePK.transitLagSeconds)}s + biofase
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
                  if (bolusRange) setCustomDosePerKg((bolusRange.min + bolusRange.max) / 2);
                }}
                disabled={!canUseRapidBolus}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  adminSpeed === 'bolus_rapid' && !isCRI
                     ? 'bg-rose-950/70 border-rose-500 text-rose-100 ring-1 ring-rose-500/60'
                    : canUseRapidBolus
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-rose-400">
                  <Zap className="w-3 h-3" />
                  Bólus Rápido
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Push direto (&lt; 5s)</div>
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
                  if (bolusRange) setCustomDosePerKg((bolusRange.min + bolusRange.max) / 2);
                }}
                disabled={!canUseBolus}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  adminSpeed === 'bolus_slow' && !isCRI
                    ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/60'
                    : canUseBolus
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-emerald-400">
                  <Clock className="w-3 h-3" />
                  {isExtravascularInjection ? `Aplicação ${selectedRoute}` : 'Bólus Lento'}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{isExtravascularInjection ? 'Absorção gradual' : 'Tempo ajustável'}</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!canUseCRI) return;
                  setAdminSpeed('infusion_cri');
                  setIsCRI(true);
                  setSelectedRoute('CRI');
                  const criRange = getSpeciesDoseRange(selectedDrug, patient.species, true);
                  if (criRange) setCustomDosePerKg((criRange.min + criRange.max) / 2);
                }}
                disabled={!canUseCRI}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                  isCRI
                    ? 'bg-cyan-950/70 border-cyan-500 text-cyan-100 ring-1 ring-cyan-500/60'
                    : canUseCRI
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-xs font-bold font-mono-code flex items-center gap-1 text-cyan-400">
                  <Clock className="w-3 h-3" />
                  Infusão CRI
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{canUseCRI ? 'Bomba contínua' : 'Não catalogado'}</div>
              </button>
            </div>

            {/* Dynamic Warnings */}
            {isAboveRecommendedMaximum && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">DOSE ACIMA DA FAIXA:</strong> {formatDecimal(customDosePerKg, 4)} {activeDoseUnit} equivale a {(customDosePerKg / recommendedRange.max).toFixed(1)}× o limite catalogado.
                </div>
              </div>
            )}
            {isPropofolFastApnea && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="text-rose-300">ALERTA FARMACOLÓGICO:</strong> Bólus rápido de Propofol causará apneia imediata e queda abrupta da PAM por vasodilatação periférica.
                </div>
              </div>
            )}
            {isAlpha2RapidShock && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500 text-xs text-amber-200 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">ALERTA ALFA-2:</strong> Bólus rápido provoca pico transitório de vasoconstrição periférica seguido de intensa bradicardia reflexa e BAV 2º grau.
                </div>
              </div>
            )}
            {isBovineXylazineDanger && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500 text-xs text-rose-200 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="text-rose-300">PERIGO LETAL EM BOVINO:</strong> Bovinos são 10x mais sensíveis a agonistas alfa-2 que equinos. Essa dose causará colapso cardiovascular agudo!
                </div>
              </div>
            )}
            {isFelineLidocaineDanger && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-500 text-xs text-rose-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="text-rose-300">TOXICIDADE EM GATO:</strong> Felinos têm deficiência enzimática para depuração de lidocaína IV. Bólus rápido provoca colapso neuro/cardiotóxico fulminante!
                </div>
              </div>
            )}
            {isFelinePropofolWarning && (
              <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-500 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300">PARTICULARIDADE FELINA:</strong> Gatos possuem deficiência na glucuronidação fenólica (UGT1A6). Infusões contínuas geram risco de corpúsculos de Heinz.
                </div>
              </div>
            )}
            {isKclBolusDanger && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-600 text-xs text-rose-100 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="text-rose-300">LETALIDADE MÁXIMA:</strong> Cloreto de potássio NUNCA deve ser aplicado em bólus rápido IV! Provocará parada cardíaca imediata em assistolia!
                </div>
              </div>
            )}
          </div>

          {/* Calculated Output Display & Syringe */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">
                {isCRI ? `Dose por ${activeDoseUnit.endsWith('/min') ? 'min' : 'h'}` : `Dose total (${patient.weightKg} kg)`}:
              </span>
              <strong className="text-base text-white font-mono-code font-bold block mt-0.5">
                {formatDecimal(totalDoseAmount, 4)} {selectedDrug.unit}
              </strong>
            </div>

            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">{isCRI ? 'Taxa da bomba CRI:' : 'Volume a injetar:'}</span>
              <strong className="text-lg text-emerald-400 font-mono-code font-bold block mt-0.5">
                {isCRI ? `${formatDecimal(calculatedAdministration.pumpRateMlPerHour, 2)} mL/h` : `${formatDecimal(calculatedVolumeMl, 4)} mL`}
              </strong>
            </div>

            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">Via de Aplicação:</span>
              <select
                value={selectedRoute}
                onChange={(e) => {
                  const route = e.target.value as DrugRoute;
                  setSelectedRoute(route);
                  const routeIsCri = route === 'CRI';
                  setIsCRI(routeIsCri);
                  setAdminSpeed(routeIsCri ? 'infusion_cri' : 'bolus_slow');
                }}
                className="bg-zinc-900 text-white text-xs rounded border border-zinc-700 font-mono-code w-full px-2 py-1 mt-1 focus:outline-none focus:border-emerald-500"
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
              disabled={!recommendedRange || !Number.isFinite(customDosePerKg) || customDosePerKg <= 0 || selectableRoutes.length === 0}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold font-mono-code transition flex items-center justify-center space-x-2 shadow-lg cursor-pointer ${
                !recommendedRange || !Number.isFinite(customDosePerKg) || customDosePerKg <= 0 || selectableRoutes.length === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : adminSpeed === 'bolus_rapid'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
              }`}
            >
              <Syringe className="w-4 h-4" />
              <span>
                {isCRI
                  ? `INICIAR INFUSÃO CONTÍNUA (CRI) ${formatDecimal(selectedVolume, 4)} mL/h`
                  : `ADMINISTRAR ${formatDecimal(calculatedVolumeMl, 4)} mL (${selectedRoute}) — ${isExtravascularInjection ? 'Absorção gradual' : adminSpeed === 'bolus_rapid' ? 'Bólus rápido' : 'Bólus lento'}`}
              </span>
            </button>
          </div>

          {adminSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/70 text-xs text-emerald-200 font-mono-code flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{adminSuccessMsg}</span>
            </div>
          )}
          {adminErrorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/70 text-xs text-rose-200 font-mono-code flex items-start space-x-2">
              <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{adminErrorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Drug Concentration / CRI Infusions Status Table */}
      {activeDoses.length > 0 && (
        <div className="mt-2 pt-3 border-t border-zinc-800">
          <h4 className="text-xs font-bold text-zinc-200 mb-2.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Fármacos em Circulação Ativa (Sítio Efetor Ce & Eliminação)</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeDoses.map((dose) => {
              const inTransit = (dose.transitLagRemainingSec || 0) > 0;
              const definition = VETERINARY_DRUG_DATABASE.find((drug) => drug.id === dose.drugId);
              const effectOccupancy = hillResponse(dose.currentCe);
              const exposure = definition ? analyzeDrugExposure(dose, definition) : undefined;
              const isResidual = exposure ? !exposure.isEffectActive : false;
              return (
                <div
                  key={dose.id}
                  className={`p-3 rounded-xl flex items-center justify-between text-xs ${
                    isResidual
                      ? 'bg-zinc-950/60 border border-zinc-800/50 opacity-70'
                      : 'bg-zinc-950 border border-zinc-800'
                  }`}
                >
                  <div className="pr-2 truncate">
                    <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                      <span>{dose.drugName}</span>
                      {definition?.category === 'antagonist_reversal' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-600 text-purple-200 font-mono-code font-bold">
                          REVERSOR
                        </span>
                      )}
                      {inTransit && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 border border-amber-600 text-amber-300 font-mono-code">
                          Trânsito: {Math.ceil(dose.transitLagRemainingSec || 0)}s
                        </span>
                      )}
                      {/* Clinical effect status badge */}
                      {exposure && !inTransit && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono-code font-bold ${
                          exposure.isEffectActive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                            : exposure.clinicalEffectStatus === 'efeito subterapêutico'
                              ? 'bg-zinc-800 text-amber-400 border border-amber-800/40'
                              : 'bg-zinc-800 text-zinc-500 border border-zinc-700/40'
                        }`}>
                          {exposure.isEffectActive ? 'ATIVO' : exposure.clinicalEffectStatus === 'efeito subterapêutico' ? 'SUBTERAP.' : 'S/ EFEITO'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 font-mono-code truncate">
                      {formatDecimal(dose.dosePerKg, 2)} {dose.isCRI && definition?.criDoseUnit ? definition.criDoseUnit : (definition?.doseUnit || '')} · {dose.route} · {dose.isCRI
                        ? `${formatDecimal(dose.criRateMlPerHour, 2)} mL/h`
                        : `${formatDecimal(dose.volumeMl, 2)} mL`}
                    </div>
                    {dose.preparation && <p className="text-xs text-cyan-300">{dose.preparation.name} · {dose.preparation.label}</p>}
                    {/* Visual Ce Bar */}
                    <div className="w-32 bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isResidual ? 'bg-zinc-600' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.round(effectOccupancy * 100)}%` }}
                      />
                    </div>
                    {exposure && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono-code">
                        {Math.round(exposure.eliminatedFraction * 100)}% eliminado
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 font-mono-code">
                    <span className={`text-xs font-bold block ${isResidual ? 'text-zinc-500' : 'text-emerald-300'}`}>
                      Ce: {dose.currentCe.toFixed(2)}×
                    </span>
                    <span className={`text-[10px] block ${isResidual ? 'text-zinc-500' : 'text-cyan-300'}`}>
                      Cp: {dose.currentCp.toFixed(2)}×
                    </span>
                    {exposure && (
                      <span className={`text-[10px] block ${isResidual ? 'text-zinc-500' : 'text-amber-300'}`}>
                        {exposure.phaseLabel}
                      </span>
                    )}
                    {exposure?.estimatedEffectMinutesRemaining !== undefined && (
                      <span className="text-[10px] text-amber-300 block font-semibold">
                        ~{formatDecimal(exposure.estimatedEffectMinutesRemaining, 0)} min restantes
                      </span>
                    )}
                    {dose.isCRI && dose.isInfusionRunning !== false && (
                      <button
                        onClick={() => onStopCRI(dose.id)}
                        className="mt-1.5 text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-700 hover:bg-rose-900 transition flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
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
