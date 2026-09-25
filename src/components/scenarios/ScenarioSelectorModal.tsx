import React, { useState, useMemo } from 'react';
import { PatientProfile, SpeciesType, ASAStatus } from '../../types/simulator';
import { PRESET_SCENARIOS, STANDARD_ELECTIVE_DOG } from '../../data/scenarios';
import { SPECIES_DATABASE } from '../../data/speciesData';
import { formatSpecies } from '../../utils/formatters';
import {
  estimateRenalImpairment,
  estimateHepaticImpairment,
  interpretAsaScore,
  getSexBiochemicalReference,
  GenderType,
  CardiacCompromiseLevel,
  CardiacAuscultationType,
  RespiratoryCompromiseLevel,
  RespiratoryAuscultationType,
  HemorrhageLevel,
  BiochemicalLabMarkers,
} from '../../engine/clinicalAssessmentEngine';
import {
  FolderHeart,
  Plus,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  Dog,
  Cat,
  Activity,
  Heart,
  Stethoscope,
  FlaskConical,
  AlertTriangle,
  Flame,
  Droplet,
  Info,
  Scale,
  RefreshCw,
  Sliders,
  ChevronRight,
} from 'lucide-react';

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

  // -------------------------------------------------------------------------
  // Custom Patient Builder State
  // -------------------------------------------------------------------------
  const [name, setName] = useState('Thor (Cão Padrão Eletivo)');
  const [species, setSpecies] = useState<SpeciesType>('canine');
  const [breed, setBreed] = useState('Labrador Retriever');
  const [ageYears, setAgeYears] = useState(3);
  const [ageMonths, setAgeMonths] = useState(0);
  const [weightKg, setWeightKg] = useState(20.0);
  const [gender, setGender] = useState<GenderType>('Macho');
  const [procedure, setProcedure] = useState('Orquiectomia Eletiva / Procedimento Limpo');
  const [history, setHistory] = useState(
    'Paciente hígido sem histórico de morbidades. Jejum pré-operatório respeitado. Exames laboratoriais e ausculta normais.'
  );

  // Biochemical markers state
  const [creatinineMgDl, setCreatinineMgDl] = useState(1.1);
  const [ureaMgDl, setUreaMgDl] = useState(28);
  const [sdmaUgDl, setSdmaUgDl] = useState(9);
  const [urineSpecificGravity, setUrineSpecificGravity] = useState(1.035);
  const [oliguriaAnuria, setOliguriaAnuria] = useState<'normal' | 'oliguria' | 'anuria'>('normal');

  const [altUl, setAltUl] = useState(35);
  const [alpUl, setAlpUl] = useState(55);
  const [totalBilirubinMgDl, setTotalBilirubinMgDl] = useState(0.2);
  const [albuminGDl, setAlbuminGDl] = useState(3.3);
  const [ptStatus, setPtStatus] = useState<'normal' | 'prolonged'>('normal');

  // Clinical assessment state
  const [cardiacCompromise, setCardiacCompromise] = useState<CardiacCompromiseLevel>('none');
  const [cardiacAuscultation, setCardiacAuscultation] = useState<CardiacAuscultationType>('normal_sinus');
  const [respiratoryCompromise, setRespiratoryCompromise] = useState<RespiratoryCompromiseLevel>('none');
  const [respiratoryAuscultation, setRespiratoryAuscultation] = useState<RespiratoryAuscultationType>('eupneic_clear');
  const [hemorrhageSeverity, setHemorrhageSeverity] = useState<HemorrhageLevel>('none');
  const [isEmergency, setIsEmergency] = useState(false);

  // ASA Management
  const [manualAsaOverride, setManualAsaOverride] = useState(false);
  const [manualAsa, setManualAsa] = useState<ASAStatus>('I');

  // Manual direct impairment overrides (optional, if user wants to tweak slider directly)
  const [overrideHepaticPct, setOverrideHepaticPct] = useState<number | null>(null);
  const [overrideRenalPct, setOverrideRenalPct] = useState<number | null>(null);

  // PostgreSQL Patients State
  const [serverPatients, setServerPatients] = useState<any[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  const loadPatientsFromServer = async () => {
    setIsLoadingPatients(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('spvet_session_token') : null;
      const res = await fetch('/api/patients', {
        headers: token ? { 'Authorization': `Bearer ${token}`, 'x-session-token': token } : {}
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.patients)) {
        setServerPatients(data.patients);
      }
    } catch (e) {
      console.warn('[Patients] Falha ao carregar pacientes do servidor:', e);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  React.useEffect(() => {
    loadPatientsFromServer();
  }, []);

  const handleDeletePatient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir este paciente personalizado do banco de dados?')) return;
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('spvet_session_token') : null;
      await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'x-session-token': token } : {}
      });
    } catch (err) {
      alert('Erro ao excluir paciente.');
    }
  };

  const customPatientsList: any[] = useMemo(() => {
    return serverPatients
      .filter((p) => !p.is_default)
      .map((p) => {
        const parsed = typeof p.profile_data === 'string' ? JSON.parse(p.profile_data) : p.profile_data;
        return {
          ...parsed,
          id: p.id,
          name: p.name,
          species: p.species,
          breed: p.breed || parsed?.breed,
          gender: p.gender || parsed?.gender,
          weightKg: Number(p.weight_kg || parsed?.weightKg),
          asa: p.asa || parsed?.asa,
          scenarioTitle: p.scenario_title || parsed?.scenarioTitle || p.name,
          scenarioDescription: p.scenario_description || parsed?.scenarioDescription || '',
          _authorName: p.author_name,
          _authorEmail: p.author_email,
          _isCustom: true,
        };
      });
  }, [serverPatients]);

  // -------------------------------------------------------------------------
  // Calculations & Physiological Derivations
  // -------------------------------------------------------------------------
  const sexReference = useMemo(
    () => getSexBiochemicalReference(species, gender),
    [species, gender]
  );

  const calculatedRenal = useMemo(
    () =>
      estimateRenalImpairment(
        {
          creatinineMgDl,
          ureaMgDl,
          sdmaUgDl,
          urineSpecificGravity,
          oliguriaAnuria,
        },
        species,
        gender
      ),
    [creatinineMgDl, ureaMgDl, sdmaUgDl, urineSpecificGravity, oliguriaAnuria, species, gender]
  );

  const effectiveRenalSeverity = overrideRenalPct !== null ? overrideRenalPct / 100 : calculatedRenal.severity;

  const calculatedHepatic = useMemo(
    () =>
      estimateHepaticImpairment({
        altUl,
        alpUl,
        totalBilirubinMgDl,
        albuminGDl,
        ptStatus,
      }),
    [altUl, alpUl, totalBilirubinMgDl, albuminGDl, ptStatus]
  );

  const effectiveHepaticSeverity = overrideHepaticPct !== null ? overrideHepaticPct / 100 : calculatedHepatic.severity;

  const calculatedAsaResult = useMemo(
    () =>
      interpretAsaScore({
        species,
        ageYears,
        ageMonths,
        gender,
        cardiacCompromise,
        cardiacAuscultation,
        respiratoryCompromise,
        respiratoryAuscultation,
        hemorrhageSeverity,
        renalSeverity: effectiveRenalSeverity,
        hepaticSeverity: effectiveHepaticSeverity,
        isEmergency,
        comorbidities: {
          brachycephalic: breed.toLowerCase().includes('buldogue') || breed.toLowerCase().includes('pug'),
        },
      }),
    [
      species,
      ageYears,
      ageMonths,
      gender,
      cardiacCompromise,
      cardiacAuscultation,
      respiratoryCompromise,
      respiratoryAuscultation,
      hemorrhageSeverity,
      effectiveRenalSeverity,
      effectiveHepaticSeverity,
      isEmergency,
      breed,
    ]
  );

  const finalAsa = manualAsaOverride ? manualAsa : calculatedAsaResult.calculatedAsa;

  // Sync baseline labs with sex when requested
  const handleApplySexDefaults = (targetGender = gender, targetSpecies = species) => {
    const ref = getSexBiochemicalReference(targetSpecies, targetGender);
    setCreatinineMgDl(ref.creatinineMgDl);
    setAlbuminGDl(ref.albuminGDl);
    setUreaMgDl(ref.ureaMgDl);
    setSdmaUgDl(ref.sdmaUgDl);
    setUrineSpecificGravity(ref.urineSpecificGravity);
    setAltUl(ref.altUl);
    setAlpUl(ref.alpUl);
    setTotalBilirubinMgDl(ref.totalBilirubinMgDl);
    setOverrideHepaticPct(null);
    setOverrideRenalPct(null);
  };

  // Populate Customizer with existing template data
  const handleLoadTemplateIntoCustomizer = (scenario: PatientProfile) => {
    setName(scenario.name);
    setSpecies(scenario.species);
    setBreed(scenario.breed);
    setAgeYears(scenario.ageYears);
    setAgeMonths(scenario.ageMonths);
    setWeightKg(scenario.weightKg);
    setGender(scenario.gender as GenderType);
    setProcedure(scenario.surgicalProcedure);
    setHistory(scenario.clinicalHistory);

    if (scenario.labMarkers) {
      setCreatinineMgDl(scenario.labMarkers.creatinineMgDl ?? 1.0);
      setUreaMgDl(scenario.labMarkers.ureaMgDl ?? 28);
      setSdmaUgDl(scenario.labMarkers.sdmaUgDl ?? 9);
      setUrineSpecificGravity(scenario.labMarkers.urineSpecificGravity ?? 1.035);
      setOliguriaAnuria(scenario.labMarkers.oliguriaAnuria ?? 'normal');
      setAltUl(scenario.labMarkers.altUl ?? 35);
      setAlpUl(scenario.labMarkers.alpUl ?? 50);
      setTotalBilirubinMgDl(scenario.labMarkers.totalBilirubinMgDl ?? 0.2);
      setAlbuminGDl(scenario.labMarkers.albuminGDl ?? 3.2);
      setPtStatus(scenario.labMarkers.ptStatus ?? 'normal');
    } else {
      handleApplySexDefaults(scenario.gender as GenderType, scenario.species);
    }

    if (scenario.clinicalAssessment) {
      setCardiacCompromise(scenario.clinicalAssessment.cardiacCompromise ?? 'none');
      setCardiacAuscultation((scenario.clinicalAssessment.cardiacAuscultation as CardiacAuscultationType) ?? 'normal_sinus');
      setRespiratoryCompromise(scenario.clinicalAssessment.respiratoryCompromise ?? 'none');
      setRespiratoryAuscultation((scenario.clinicalAssessment.respiratoryAuscultation as RespiratoryAuscultationType) ?? 'eupneic_clear');
      setHemorrhageSeverity(scenario.clinicalAssessment.hemorrhageSeverity ?? 'none');
      setIsEmergency(scenario.clinicalAssessment.isEmergency ?? false);
      setManualAsaOverride(scenario.clinicalAssessment.asaManualOverride ?? false);
      setManualAsa(scenario.asa);
    } else {
      setIsEmergency(scenario.asa.endsWith('E'));
      setManualAsa(scenario.asa);
    }

    setActiveTab('custom');
  };

  // Launch created custom patient
  const handleLaunchCustomPatient = async () => {
    const speciesInfo = SPECIES_DATABASE[species];
    const sexRef = getSexBiochemicalReference(species, gender);

    // Dynamic hemodynamic baselines derived from compromise
    let baselineHr = speciesInfo.normalVitals.hrTypical;
    let baselineMap = speciesInfo.normalVitals.mapTypical;
    let baselineRr = speciesInfo.normalVitals.rrTypical;
    let baselineHct = sexRef.hematocritPct;
    let normalBloodVol = Math.round(weightKg * speciesInfo.bloodVolumeMlPerKg);
    let effectiveBloodVol = normalBloodVol;
    let hypovolemiaSeverity = 0;

    // Hemorrhage adjustments
    if (hemorrhageSeverity === 'severe') {
      hypovolemiaSeverity = 0.7;
      effectiveBloodVol = Math.round(normalBloodVol * 0.65);
      baselineHct = Math.max(18, Math.round(baselineHct * 0.55));
      baselineMap = 48;
      baselineHr = Math.round(speciesInfo.normalVitals.hrMax * 1.15);
      baselineRr = 36;
    } else if (hemorrhageSeverity === 'moderate') {
      hypovolemiaSeverity = 0.35;
      effectiveBloodVol = Math.round(normalBloodVol * 0.82);
      baselineHct = Math.round(baselineHct * 0.80);
      baselineMap = 68;
      baselineHr = Math.round(speciesInfo.normalVitals.hrMax * 0.95);
      baselineRr = 26;
    } else if (hemorrhageSeverity === 'mild') {
      hypovolemiaSeverity = 0.15;
      effectiveBloodVol = Math.round(normalBloodVol * 0.92);
      baselineHct = Math.round(baselineHct * 0.92);
    }

    // Cardiac compromise adjustments
    if (cardiacCompromise === 'severe') {
      baselineHr = Math.min(speciesInfo.normalVitals.hrMax * 1.1, 160);
      baselineMap = Math.min(baselineMap, 65);
    }

    const newPatient: PatientProfile = {
      id: `custom_${Date.now()}`,
      name,
      species,
      breed,
      ageYears,
      ageMonths,
      weightKg,
      gender,
      asa: finalAsa,
      scenarioTitle: `Caso: ${name}`,
      scenarioDescription: `Paciente ${formatSpecies(species)} (${gender}), ${weightKg} kg, submetido a ${procedure}. Classificação ASA ${finalAsa}.`,
      clinicalHistory: history,
      surgicalProcedure: procedure,
      baselineVitals: {
        hr: baselineHr,
        rr: baselineRr,
        sysBP: Math.round(baselineMap * 1.35),
        diaBP: Math.round(baselineMap * 0.75),
        map: baselineMap,
        tempC: speciesInfo.normalVitals.tempTypicalC,
        spo2: respiratoryCompromise === 'severe' ? 90 : respiratoryCompromise === 'moderate' ? 94 : speciesInfo.normalVitals.spo2Normal,
        etco2: speciesInfo.normalVitals.etco2Typical,
        bloodVolumeMl: effectiveBloodVol,
        hctPct: baselineHct,
        potassiumMeqL: 4.2,
        lactateMmolL: hemorrhageSeverity === 'severe' ? 6.2 : hemorrhageSeverity === 'moderate' ? 2.8 : 1.2,
        glucoseMgDl: 95,
      },
      pathologyConditions: {
        hepaticDysfunctionSeverity: effectiveHepaticSeverity,
        renalDysfunctionSeverity: effectiveRenalSeverity,
        hypovolemiaSeverity,
        cardiacFailureDCM: cardiacCompromise === 'severe' || cardiacCompromise === 'moderate',
        cardiacCompromiseSeverity: cardiacCompromise === 'severe' ? 0.75 : cardiacCompromise === 'moderate' ? 0.45 : cardiacCompromise === 'mild' ? 0.20 : 0,
        traumaHemorrhage: hemorrhageSeverity === 'severe',
        brachycephalicObstruction: breed.toLowerCase().includes('buldogue') || breed.toLowerCase().includes('pug'),
      },
      clinicalAssessment: {
        isEmergency,
        cardiacCompromise,
        cardiacAuscultation,
        respiratoryCompromise,
        respiratoryAuscultation,
        hemorrhageSeverity,
        autoCalculatedAsa: calculatedAsaResult.calculatedAsa,
        asaManualOverride: manualAsaOverride,
        asaJustification: manualAsaOverride
          ? `Classificação ASA ${finalAsa} definida manualmente pelo anestesista (Cálculo sugerido: ASA ${calculatedAsaResult.calculatedAsa}).`
          : calculatedAsaResult.justification,
      },
      labMarkers: {
        creatinineMgDl,
        ureaMgDl,
        sdmaUgDl,
        urineSpecificGravity,
        oliguriaAnuria,
        altUl,
        alpUl,
        totalBilirubinMgDl,
        albuminGDl,
        ptStatus,
      },
    };

    // Salvar paciente no PostgreSQL vinculado ao médico veterinário autenticado
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('spvet_session_token') : null;
      if (token) {
        await fetch('/api/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-session-token': token,
          },
          body: JSON.stringify({
            id: newPatient.id,
            name: newPatient.name,
            species: newPatient.species,
            breed: newPatient.breed,
            gender: newPatient.gender,
            ageYears: newPatient.ageYears,
            ageMonths: newPatient.ageMonths,
            weightKg: newPatient.weightKg,
            asa: newPatient.asa,
            scenarioTitle: newPatient.scenarioTitle,
            scenarioDescription: newPatient.scenarioDescription,
            clinicalHistory: newPatient.clinicalHistory,
            surgicalProcedure: newPatient.surgicalProcedure,
            profileData: newPatient,
          }),
        });
      }
    } catch (e) {
      console.warn('[PatientSync] Paciente iniciado em sessão; persistência no banco pendente:', e);
    }

    onSelectScenario(newPatient);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#0b0c10] border border-[#222330] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1c1d29] bg-gradient-to-r from-[#0d0f17] via-[#090b10] to-[#0d0f17]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <FolderHeart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  SELETOR & CONSTRUTOR DE PACIENTES
                </h3>
                <span className="text-[10px] font-mono-code font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Cão Padrão Eletivo & Casos Customizados
                </span>
              </div>
              <p className="text-xs text-[#8e8e9f]">
                Selecione o paciente canino de referência ASA I ou personalize biomarcadores, ausculta e perfil ASA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#888899] hover:text-white hover:bg-[#1a1c29] transition cursor-pointer"
            title="Fechar Seletor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1c1d29] bg-[#08090d] px-4 pt-1">
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-3 px-5 text-xs font-bold font-mono-code transition border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'presets'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-[#7a7a8c] hover:text-[#e1e1e6]'
            }`}
          >
            <Dog className="w-4 h-4" />
            <span>CÃO PADRÃO ELETIVO & MODELOS CLÍNICOS</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-5 text-xs font-bold font-mono-code transition border-b-2 flex items-center space-x-2 cursor-pointer ${
              activeTab === 'custom'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-[#7a7a8c] hover:text-[#e1e1e6]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>CONSTRUTOR & CUSTOMIZADOR AVANÇADO</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'presets' ? (
            <div className="space-y-4">
              {/* 1. HIGHLIGHTED STANDARD ELECTIVE DOG CARD */}
              <div className="rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-br from-[#0c2415] via-[#09150e] to-[#0a1014] p-4 sm:p-5 shadow-lg shadow-emerald-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono-code font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-black uppercase">
                      ★ Paciente Canino Padrão Eletivo
                    </span>
                    <span className="text-xs font-mono-code font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                      ASA I (Hígido)
                    </span>
                    <span className="text-xs text-zinc-300 font-semibold">
                      {STANDARD_ELECTIVE_DOG.name} · {STANDARD_ELECTIVE_DOG.breed} ({STANDARD_ELECTIVE_DOG.weightKg} kg · Macho)
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {STANDARD_ELECTIVE_DOG.scenarioDescription}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-code text-emerald-300/80 pt-1">
                    <span>Função Renal: 100% íntegra (Creat 1.1 mg/dL)</span>
                    <span>·</span>
                    <span>Função Hepática: 100% íntegra (Albumina 3.3 g/dL)</span>
                    <span>·</span>
                    <span>Ausculta: Ritmo Sinusal Límpido</span>
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => onSelectScenario(STANDARD_ELECTIVE_DOG)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    INICIAR CÃO PADRÃO
                  </button>
                  <button
                    onClick={() => handleLoadTemplateIntoCustomizer(STANDARD_ELECTIVE_DOG)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition border border-zinc-700 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Editar no Customizador
                  </button>
                </div>
              </div>

              {/* 1.5 CUSTOM PATIENTS SAVED IN POSTGRESQL */}
              {customPatientsList.length > 0 && (
                <div className="rounded-xl border border-cyan-500/30 bg-[#0a0f18] p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-black font-mono-code text-cyan-300 uppercase tracking-wider">
                        Meus Pacientes Personalizados no Banco de Dados ({customPatientsList.length})
                      </h4>
                    </div>
                    <span className="text-[11px] text-cyan-400/80 font-mono">
                      ✓ Salvos no PostgreSQL da sua assinatura
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customPatientsList.map((scenario: any) => {
                      const isCurrent = scenario.id === currentPatientId;
                      return (
                        <div
                          key={scenario.id}
                          className={`p-3.5 rounded-xl border transition flex flex-col justify-between group ${
                            isCurrent
                              ? 'bg-[#0f2415] border-emerald-500 shadow-md shadow-emerald-950/40'
                              : 'bg-[#10131d] border-cyan-900/40 hover:border-cyan-500/60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                                {scenario.scenarioTitle || scenario.name}
                              </span>
                              <span className="text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                                ASA {scenario.asa}
                              </span>
                            </div>

                            <div className="text-xs text-zinc-300 font-semibold mb-1">
                              {scenario.name} · {scenario.breed} ({scenario.weightKg} kg · {scenario.gender} · {formatSpecies(scenario.species).toUpperCase()})
                            </div>

                            {scenario._authorName && (
                              <div className="text-[10px] text-cyan-400/80 font-mono mb-1">
                                Cadastrado por: {scenario._authorName} ({scenario._authorEmail})
                              </div>
                            )}

                            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
                              {scenario.scenarioDescription}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-[#1c1d29] flex items-center justify-between text-[11px] font-mono-code">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleLoadTemplateIntoCustomizer(scenario)}
                                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <Sliders className="w-3 h-3" />
                                Editar
                              </button>
                              <button
                                onClick={(e) => handleDeletePatient(scenario.id, e)}
                                className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer transition ml-2"
                              >
                                <X className="w-3 h-3" />
                                Excluir
                              </button>
                            </div>

                            <button
                              onClick={() => onSelectScenario(scenario)}
                              className={`font-bold flex items-center gap-1 cursor-pointer transition ${
                                isCurrent ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              {isCurrent ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Ativo
                                </>
                              ) : (
                                <>Iniciar Simulação →</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. OTHER SCENARIOS AVAILABLE FOR DIRECT USE OR CUSTOMIZATION */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold font-mono-code text-[#a5a5b5] uppercase tracking-wider">
                    Modelos Clínicos Disponíveis para Seleção ou Customização
                  </h4>
                  <span className="text-[11px] text-[#717182]">
                    Clique em &quot;Personalizar&quot; para abrir os biomarcadores e o cálculo ASA de qualquer caso
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_SCENARIOS.slice(1).map((scenario) => {
                    const isCurrent = scenario.id === currentPatientId;
                    return (
                      <div
                        key={scenario.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col justify-between group ${
                          isCurrent
                            ? 'bg-[#0f2415] border-emerald-500 shadow-md shadow-emerald-950/40'
                            : 'bg-[#101118] border-[#20212e] hover:border-[#383a4f] hover:bg-[#141520]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-[#f5f5f5] group-hover:text-emerald-300 transition">
                              {scenario.scenarioTitle}
                            </span>
                            <span
                              className={`text-[10px] font-bold font-mono-code px-2 py-0.5 rounded-full ${
                                scenario.asa.startsWith('I') && !scenario.asa.startsWith('IV')
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : scenario.asa.startsWith('II')
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : scenario.asa.startsWith('III')
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              ASA {scenario.asa}
                            </span>
                          </div>

                          <div className="text-xs text-[#d4d4d4] font-semibold mb-1">
                            {scenario.name} · {scenario.breed} ({scenario.weightKg} kg · {scenario.gender} · {formatSpecies(scenario.species).toUpperCase()})
                          </div>

                          <p className="text-xs text-[#888899] line-clamp-2 mb-2">
                            {scenario.scenarioDescription}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[#1c1d29] flex items-center justify-between text-[11px] font-mono-code">
                          <button
                            onClick={() => handleLoadTemplateIntoCustomizer(scenario)}
                            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            <Sliders className="w-3 h-3" />
                            Personalizar este caso
                          </button>

                          <button
                            onClick={() => onSelectScenario(scenario)}
                            className={`font-bold flex items-center gap-1 cursor-pointer transition ${
                              isCurrent ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            {isCurrent ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Ativo
                              </>
                            ) : (
                              <>Selecionar Direto →</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CUSTOM PATIENT BUILDER WITH REAL-TIME LABS & ASA ENGINE                  */
            /* ========================================================================= */
            <div className="space-y-5 font-mono-code text-xs">
              {/* SECTION 1: BASIC DEMOGRAPHICS & SEX-BASED BIOCHEMICAL FEEDBACK */}
              <div className="rounded-xl border border-[#222332] bg-[#101118] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1f202e] pb-2">
                  <div className="flex items-center gap-2">
                    <Dog className="w-4 h-4 text-emerald-400" />
                    <span className="font-extrabold text-white uppercase tracking-wide">
                      1. Identificação & Dados Básicos
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8e8e9f]">Espécie, Raça, Idade e Sexo</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Nome do Paciente:</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Espécie:</label>
                    <select
                      value={species}
                      onChange={(e) => {
                        const sp = e.target.value as SpeciesType;
                        setSpecies(sp);
                        const defW = { canine: 20, feline: 4.5, equine: 500, bovine: 500 }[sp];
                        setWeightKg(defW);
                        setBreed(sp === 'canine' ? 'SRD' : sp === 'feline' ? 'DSH' : 'Mestiço');
                        handleApplySexDefaults(gender, sp);
                      }}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white capitalize focus:outline-none focus:border-emerald-500"
                    >
                      <option value="canine">Canino (Cão)</option>
                      <option value="feline">Felino (Gato)</option>
                      <option value="equine">Equino (Cavalo)</option>
                      <option value="bovine">Bovino</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Raça:</label>
                    <input
                      type="text"
                      value={breed}
                      onChange={(e) => setBreed(e.target.value)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Peso Corporal (kg):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={weightKg}
                      onChange={(e) => setWeightKg(parseFloat(e.target.value) || 1)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-emerald-400 font-extrabold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Idade (Anos):</label>
                    <input
                      type="number"
                      min="0"
                      value={ageYears}
                      onChange={(e) => setAgeYears(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Idade (Meses adicionais):</label>
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={ageMonths}
                      onChange={(e) => setAgeMonths(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">
                      Sexo (Modifica Bioquímica Fisiológica):
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => {
                        const newGender = e.target.value as GenderType;
                        setGender(newGender);
                        handleApplySexDefaults(newGender, species);
                      }}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Macho">Macho (Inteiro)</option>
                      <option value="Macho Castrado">Macho Castrado</option>
                      <option value="Fêmea">Fêmea (Inteira)</option>
                      <option value="Fêmea Castrada">Fêmea Castrada</option>
                    </select>
                  </div>
                </div>

                {/* SEX PHYSIOLOGICAL BIOCHEMICAL IMPACT BANNER */}
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-200 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Impacto Fisiológico do Sexo na Bioquímica & Hematologia:</strong>{' '}
                    {sexReference.explanation}
                    <div className="mt-1 flex flex-wrap gap-2 text-cyan-300">
                      <span>• Ht Esperado: {sexReference.hematocritPct}%</span>
                      <span>• Creatinina Basal: {sexReference.creatinineMgDl} mg/dL</span>
                      <span>• Albumina Basal: {sexReference.albuminGDl} g/dL</span>
                      <button
                        onClick={() => handleApplySexDefaults()}
                        className="ml-auto underline hover:text-white flex items-center gap-1 cursor-pointer"
                        title="Redefinir exames para o padrão fisiológico deste sexo"
                      >
                        <RefreshCw className="w-3 h-3" /> Aplicar Valores Fisiológicos deste Sexo
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: BIOCHEMICAL MARKERS & ESTIMATED ORGAN DYSFUNCTION */}
              <div className="rounded-xl border border-[#222332] bg-[#101118] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1f202e] pb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-white uppercase tracking-wide">
                      2. Marcadores Bioquímicos & Estimador Renal / Hepático
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8e8e9f]">
                    Cálculo automatizado do comprometimento de eliminação
                  </span>
                </div>

                {/* RENAL SUB-PANEL */}
                <div className="p-3.5 rounded-xl border border-sky-900/40 bg-sky-950/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-4 h-4 text-sky-400" />
                      <strong className="text-white">Função Renal & Filtração Glomerular</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-sky-950 text-sky-300 border border-sky-700/50">
                        {calculatedRenal.stageLabel}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-black bg-sky-900/60 text-sky-200">
                        Comprometimento: {overrideRenalPct !== null ? overrideRenalPct : calculatedRenal.percent}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400">{calculatedRenal.clinicalSummary}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Creatinina (mg/dL):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.2"
                        value={creatinineMgDl}
                        onChange={(e) => {
                          setCreatinineMgDl(parseFloat(e.target.value) || 0.5);
                          setOverrideRenalPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-sky-300 font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Ureia / BUN (mg/dL):
                      </label>
                      <input
                        type="number"
                        min="5"
                        value={ureaMgDl}
                        onChange={(e) => {
                          setUreaMgDl(parseInt(e.target.value) || 15);
                          setOverrideRenalPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        SDMA (µg/dL):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={sdmaUgDl}
                        onChange={(e) => {
                          setSdmaUgDl(parseInt(e.target.value) || 5);
                          setOverrideRenalPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Densidade Urinária:
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="1.000"
                        max="1.080"
                        value={urineSpecificGravity}
                        onChange={(e) => {
                          setUrineSpecificGravity(parseFloat(e.target.value) || 1.030);
                          setOverrideRenalPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Débito Urinário:
                      </label>
                      <select
                        value={oliguriaAnuria}
                        onChange={(e) => {
                          setOliguriaAnuria(e.target.value as 'normal' | 'oliguria' | 'anuria');
                          setOverrideRenalPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      >
                        <option value="normal">Normal (&gt; 1 mL/kg/h)</option>
                        <option value="oliguria">Oligúria (&lt; 0.5 mL/kg/h)</option>
                        <option value="anuria">Anúria (&lt; 0.1 mL/kg/h)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400">
                    <span>Ajuste fino manual do comprometimento renal:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overrideRenalPct !== null ? overrideRenalPct : calculatedRenal.percent}
                      onChange={(e) => setOverrideRenalPct(Number(e.target.value))}
                      className="flex-1 cursor-pointer accent-sky-400"
                    />
                    <span className="w-12 text-right font-bold text-sky-300">
                      {overrideRenalPct !== null ? overrideRenalPct : calculatedRenal.percent}%
                    </span>
                    {overrideRenalPct !== null && (
                      <button
                        onClick={() => setOverrideRenalPct(null)}
                        className="text-xs text-sky-400 underline hover:text-white cursor-pointer"
                      >
                        Recalcular
                      </button>
                    )}
                  </div>
                </div>

                {/* HEPATIC SUB-PANEL */}
                <div className="p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <strong className="text-white">Função Hepática & Capacidade Sintética</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-700/50">
                        {calculatedHepatic.stageLabel}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-black bg-amber-900/60 text-amber-200">
                        Comprometimento: {overrideHepaticPct !== null ? overrideHepaticPct : calculatedHepatic.percent}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400">{calculatedHepatic.clinicalSummary}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        ALT / TGP (U/L):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={altUl}
                        onChange={(e) => {
                          setAltUl(parseInt(e.target.value) || 20);
                          setOverrideHepaticPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        FA / ALP (U/L):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={alpUl}
                        onChange={(e) => {
                          setAlpUl(parseInt(e.target.value) || 30);
                          setOverrideHepaticPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Bilirrubina (mg/dL):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.0"
                        value={totalBilirubinMgDl}
                        onChange={(e) => {
                          setTotalBilirubinMgDl(parseFloat(e.target.value) || 0.1);
                          setOverrideHepaticPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Albumina (g/dL):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="6.0"
                        value={albuminGDl}
                        onChange={(e) => {
                          setAlbuminGDl(parseFloat(e.target.value) || 2.5);
                          setOverrideHepaticPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-amber-300 font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[#8e8e9f] block mb-1">
                        Tempo de Protrombina (TP):
                      </label>
                      <select
                        value={ptStatus}
                        onChange={(e) => {
                          setPtStatus(e.target.value as 'normal' | 'prolonged');
                          setOverrideHepaticPct(null);
                        }}
                        className="w-full bg-[#161722] border border-[#2c2e40] rounded p-1.5 text-white focus:outline-none"
                      >
                        <option value="normal">Normal (Síntese Preservada)</option>
                        <option value="prolonged">Prolongado (Coagulopatia)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400">
                    <span>Ajuste fino manual do comprometimento hepático:</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overrideHepaticPct !== null ? overrideHepaticPct : calculatedHepatic.percent}
                      onChange={(e) => setOverrideHepaticPct(Number(e.target.value))}
                      className="flex-1 cursor-pointer accent-amber-400"
                    />
                    <span className="w-12 text-right font-bold text-amber-300">
                      {overrideHepaticPct !== null ? overrideHepaticPct : calculatedHepatic.percent}%
                    </span>
                    {overrideHepaticPct !== null && (
                      <button
                        onClick={() => setOverrideHepaticPct(null)}
                        className="text-xs text-amber-400 underline hover:text-white cursor-pointer"
                      >
                        Recalcular
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: CARDIAC, RESPIRATORY, HEMORRHAGE & AUSCULTATION */}
              <div className="rounded-xl border border-[#222332] bg-[#101118] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1f202e] pb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span className="font-extrabold text-white uppercase tracking-wide">
                      3. Avaliação Cardíaca, Respiratória, Volemia & Ausculta
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8e8e9f]">
                    Achados do exame físico com impacto direto na classificação ASA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[#8e8e9f] block mb-1">
                      Comprometimento Cardíaco:
                    </label>
                    <select
                      value={cardiacCompromise}
                      onChange={(e) => setCardiacCompromise(e.target.value as CardiacCompromiseLevel)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded p-2 text-white focus:outline-none"
                    >
                      <option value="none">Ausente (Coração Hígido)</option>
                      <option value="mild">Leve (ICC B1 assintomático, sem remodelamento)</option>
                      <option value="moderate">Moderado (ICC B2, aumento de AE/VE, sopro importante)</option>
                      <option value="severe">Grave (ICC C/D descompensada, arritmias ventriculares)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">
                      Ausculta Cardíaca (Estetoscopia):
                    </label>
                    <select
                      value={cardiacAuscultation}
                      onChange={(e) => setCardiacAuscultation(e.target.value as CardiacAuscultationType)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded p-2 text-white focus:outline-none"
                    >
                      <option value="normal_sinus">Ritmo Sinusal Regular (B1/B2 normofonéticas)</option>
                      <option value="sinus_arrhythmia">Arritmia Sinusal Respiratória (Fisiológica)</option>
                      <option value="mild_murmur">Sopro Sistólico Leve (Grau I-II/VI)</option>
                      <option value="loud_murmur">Sopro Holossistólico Moderado/Grave (Grau III-VI/VI)</option>
                      <option value="gallop_rhythm">Ritmo de Galope S3/S4 (Sobrecarga Miocárdica)</option>
                      <option value="arrhythmic_irregular">Extrassístoles / Ritmo Irregular com Déficit</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">
                      Capacidade & Ausculta Respiratória:
                    </label>
                    <select
                      value={respiratoryAuscultation}
                      onChange={(e) => {
                        const val = e.target.value as RespiratoryAuscultationType;
                        setRespiratoryAuscultation(val);
                        if (val === 'severe_respiratory_failure') setRespiratoryCompromise('severe');
                        else if (val === 'moderate_crackles_wheezes') setRespiratoryCompromise('moderate');
                        else if (val === 'mild_stridor') setRespiratoryCompromise('mild');
                        else setRespiratoryCompromise('none');
                      }}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded p-2 text-white focus:outline-none"
                    >
                      <option value="eupneic_clear">Eupneico / Murmúrio vesicular límpido (SpO2 &gt; 98%)</option>
                      <option value="mild_stridor">Estridor inspiratório leve / Estenose nasal (SpO2 95-97%)</option>
                      <option value="moderate_crackles_wheezes">Estertores crepitantes úmidos / Sibilos (SpO2 91-94%)</option>
                      <option value="severe_respiratory_failure">Insuficiência respiratória severa / Cianose (SpO2 &lt; 90%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">
                      Hemorragia / Perda Volêmica / Choque:
                    </label>
                    <select
                      value={hemorrhageSeverity}
                      onChange={(e) => setHemorrhageSeverity(e.target.value as HemorrhageLevel)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded p-2 text-white focus:outline-none"
                    >
                      <option value="none">Nenhuma (Normovolemia íntegra)</option>
                      <option value="mild">Leve (&lt; 10% perda estimada de sangue)</option>
                      <option value="moderate">Moderada (15-25% perda, taquicardia compensatória)</option>
                      <option value="severe">Grave / Choque Hemorrágico (&gt; 30% perda, colapso de PAM)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex flex-col justify-center">
                    <label className="text-[#8e8e9f] block mb-1">Caráter do Procedimento:</label>
                    <div
                      onClick={() => setIsEmergency(!isEmergency)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                        isEmergency
                          ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                          : 'bg-[#161722] border-[#2c2e40] text-[#a0a0b0] hover:bg-[#1a1b28]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEmergency}
                        onChange={(e) => setIsEmergency(e.target.checked)}
                        className="w-4 h-4 accent-rose-500 cursor-pointer"
                      />
                      <div>
                        <strong className="block text-xs text-white">
                          Procedimento em Caráter de Urgência / Emergência (Sufixo &apos;E&apos;)
                        </strong>
                        <span className="text-[11px] text-zinc-400">
                          Adiciona &apos;E&apos; à classificação ASA (ex: ASA II-E, ASA III-E, ASA IV-E). Paciente não pôde ser estabilizado eletivamente.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: AUTOMATED ASA INTERPRETATION & MANUAL OVERRIDE */}
              <div className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-[#0c1815] to-[#101520] p-4 sm:p-5 space-y-3 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-sm font-extrabold text-white tracking-wide uppercase">
                        4. Interpretação & Classificação do Estado Físico ASA
                      </h4>
                      <p className="text-[11px] text-zinc-400">
                        Cálculo baseado nas diretrizes ACVAA/ASA com opção de ajuste manual pelo anestesista
                      </p>
                    </div>
                  </div>

                  {/* Toggle between Auto and Manual */}
                  <div className="flex items-center bg-[#090b10] border border-[#222535] rounded-xl p-1">
                    <button
                      onClick={() => setManualAsaOverride(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        !manualAsaOverride
                          ? 'bg-emerald-500 text-black shadow'
                          : 'text-[#888899] hover:text-white'
                      }`}
                    >
                      Cálculo Automático
                    </button>
                    <button
                      onClick={() => {
                        setManualAsaOverride(true);
                        setManualAsa(calculatedAsaResult.calculatedAsa);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        manualAsaOverride
                          ? 'bg-amber-500 text-black shadow'
                          : 'text-[#888899] hover:text-white'
                      }`}
                    >
                      Ajuste Manual
                    </button>
                  </div>
                </div>

                {/* Live ASA Display Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-[#07090e] border border-[#1e2333]">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 uppercase font-bold">Classificação Final:</span>
                      <span
                        className={`text-base font-mono-code font-black px-3 py-0.5 rounded-lg border ${
                          finalAsa.startsWith('I') && !finalAsa.startsWith('IV')
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                            : finalAsa.startsWith('II')
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60'
                            : finalAsa.startsWith('III')
                            ? 'bg-amber-950 text-amber-300 border-amber-500/60'
                            : 'bg-rose-950 text-rose-300 border-rose-500/60'
                        }`}
                      >
                        ASA {finalAsa}
                      </span>
                      {!manualAsaOverride && (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Calculado pelo Motor Clínico
                        </span>
                      )}
                      {manualAsaOverride && (
                        <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                          <Sliders className="w-3.5 h-3.5" /> Definido Manualmente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed pt-1">
                      {manualAsaOverride
                        ? `Classificação fixada manualmente em ASA ${finalAsa}. O motor clínico sugeriu ${calculatedAsaResult.calculatedAsa} com base no exame.`
                        : calculatedAsaResult.justification}
                    </p>
                  </div>

                  {/* Manual Selector Buttons if in Manual Mode */}
                  {manualAsaOverride && (
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {(['I', 'II', 'III', 'IV', 'V', 'I-E', 'II-E', 'III-E', 'IV-E', 'V-E'] as ASAStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            onClick={() => setManualAsa(st)}
                            className={`px-2.5 py-1 rounded text-xs font-bold font-mono transition cursor-pointer ${
                              manualAsa === st
                                ? 'bg-amber-500 text-black shadow'
                                : 'bg-[#151722] text-zinc-400 hover:text-white border border-[#252838]'
                            }`}
                          >
                            {st}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 5: PROCEDURE & CLINICAL HISTORY */}
              <div className="rounded-xl border border-[#222332] bg-[#101118] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Procedimento Cirúrgico Proposto:</label>
                    <input
                      type="text"
                      value={procedure}
                      onChange={(e) => setProcedure(e.target.value)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#8e8e9f] block mb-1">Histórico Clínico & Anamnese:</label>
                    <input
                      type="text"
                      value={history}
                      onChange={(e) => setHistory(e.target.value)}
                      className="w-full bg-[#161722] border border-[#2c2e40] rounded-lg p-2 text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: CONFIRMATION & LAUNCH BUTTON */}
              <div className="pt-2">
                <button
                  onClick={handleLaunchCustomPatient}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black font-black text-sm tracking-wide transition shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer uppercase"
                >
                  <Sparkles className="w-4 h-4" />
                  Carregar e Iniciar Simulação com este Paciente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
