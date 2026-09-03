import { ActiveDrugDose, PatientProfile, VitalSigns } from '../types/simulator';
import { ReceptorStateSnapshot } from './cellularReceptors';

export class DynamicInteractionsEngine {
  /**
   * Dynamically inspects the cellular and physiological receptor states to detect
   * emergent drug-drug interactions, allosteric synergies, receptor displacements, and lethal toxicities.
   */
  public static evaluateDynamicInteractions(
    patient: PatientProfile,
    receptors: ReceptorStateSnapshot,
    isVentilatorActive: boolean,
    isIntubated: boolean,
    activeDoses: ActiveDrugDose[] = []
  ): VitalSigns['activeDrugInteractions'] {
    const interactions: VitalSigns['activeDrugInteractions'] = [];
    const activeIds = new Set(activeDoses.filter((dose) => dose.currentCe > 0.01).map((dose) => dose.drugId));
    const hasAny = (ids: string[]): boolean => ids.some((id) => activeIds.has(id));

    // 1. Allosteric GABA-A Cooperativity Synergy (BZD + Propofol / Inhalation / Neurosteroid)
    if (receptors.bzdAllostericOccupancy > 0.20 && (receptors.propofolSiteOccupancy > 0.20 || receptors.volatileSiteOccupancy > 0.40 || receptors.neurosteroidSiteOccupancy > 0.20)) {
      interactions.push({
        title: 'Sinergismo Alostérico no Complexo GABA-A',
        severity: 'info',
        description: 'Potencialização molecular positiva da condutância de Cloro (gCl-). Redução sinérgica drástica da necessidade de dose hipnótica (MAC sparing de 50-70%) e relaxamento mandibular imediato.',
        pharmacologyMechanism: 'A ligação do benzodiazepínico no sítio alostérico gama/alfa aumenta a frequência de abertura do canal de cloreto ativado pelo propofol/isoflurano, hiperpolarizando os neurônios do córtex e sistema reticular.',
      });
    }

    // 2. Alpha-2 Vasoconstriction + Anticholinergic (Dexmedetomidine/Xylazine + Atropine)
    if (receptors.alpha2Drive > 0.25 && receptors.m2Drive < -0.25) {
      interactions.push({
        title: 'Descasamento de Pós-Carga Crítico: Alfa-2 + Anticolinérgico',
        severity: 'lethal',
        description: 'Taquicardia forçada contra resistência vascular sistêmica extrema. Elevação catastrófica do consumo miocárdico de oxigênio (MVO2), isquemia coronariana e alto risco de Fibrilação Ventricular.',
        pharmacologyMechanism: 'Bloqueio muscarínico M2 abole o freio vagal protetor enquanto a vasoconstrição alfa-2 periférica mantém a pós-carga em níveis críticos, precipitando falência ventricular esquerda aguda.',
      });
    }

    // 3. Adrenergic Hyperstimulation Storm (Excessive Beta-1 / Epinephrine)
    if (receptors.cAMPMyocardial > 2.2 || receptors.beta1Drive > 1.2) {
      interactions.push({
        title: 'Tempestade Adrenérgica e Sobrecarga de Cálcio Intracelular',
        severity: 'danger',
        description: 'Hiperativação adrenérgica promovendo taquiarritmias ventriculares malignas (TV/FV) e encurtamento da diástole com hipoperfusão coronariana.',
        pharmacologyMechanism: 'Níveis suprafisiológicos de AMPc via Gs fosforilam canais de cálcio do tipo L e fosfolambano no retículo sarcoplasmático, gerando pós-despolarizações tardias (DADs) arrhythmogenic.',
      });
    }

    // 4. Competitive Alpha-2 Displacement (Atipamezole)
    if (receptors.reversalCe.atipamezole > 0.08 && hasAny(['dexmedetomidine', 'xylazine', 'detomidine'])) {
      interactions.push({
        title: 'Reversão Competitiva Alfa-2 por Atipamezol',
        severity: 'info',
        description: 'Deslocamento competitivo dos agonistas alfa-2 nos receptores pré e pós-sinápticos. Restauração imediata da frequência cardíaca, tônus vasomotor e consciência.',
        pharmacologyMechanism: 'Antagonismo competitivo puro de altíssima seletividade (alfa-2:alfa-1 de 8520:1), eliminando a inibição Gi mediada na adenilil ciclase do locus coeruleus.',
      });
    }

    // 5. Competitive Opioid Reversal (Naloxone)
    if (receptors.reversalCe.naloxone > 0.08 && hasAny(['morphine', 'methadone', 'fentanyl', 'butorphanol', 'buprenorphine'])) {
      interactions.push({
        title: 'Reversão Competitiva de Receptores Mu-Opioides por Naloxona',
        severity: 'info',
        description: 'Deslocamento competitivo de opioides puros dos receptores mu. Restauração do drive respiratório bulbar e da sensibilidade medular ao CO2.',
        pharmacologyMechanism: 'Antagonista competitivo puro que reverte a inibição Gi nos neurônios do complexo pre-Bötzinger e reverte o bloqueio nociceptivo espinal.',
      });
    }

    // 6. Competitive Benzodiazepine Reversal (Flumazenil)
    if (receptors.reversalCe.flumazenil > 0.08 && hasAny(['midazolam', 'diazepam'])) {
      interactions.push({
        title: 'Neutralização Alostérica GABA-A por Flumazenil',
        severity: 'info',
        description: 'Ocupação do sítio de benzodiazepínicos com restauração do tônus muscular mandibular e reversão da sedação residual.',
        pharmacologyMechanism: 'Antagonista neutro competitivo no sítio omega-1/omega-2 do receptor GABA-A, impedindo a modulação alostérica positiva pelos benzodiazepínicos.',
      });
    }

    // 7. NMBA Paralysis without Mechanical Ventilation Support
    if (receptors.nmOccupancy > 0.25 && (!isVentilatorActive || !isIntubated)) {
      interactions.push({
        title: 'Bloqueio Neuromuscular Sem Suporte Ventilatório Mecânico',
        severity: 'lethal',
        description: 'Paralisia diafragmática e intercostal completa por bloqueio colinérgico nicotínico sem via aérea pérvia ou ventilação com pressão positiva. Asfixia aguda iminente!',
        pharmacologyMechanism: 'Antagonismo competitivo dos receptores nicotínicos (NM) na placa motora terminal impede a geração de potenciais de placa terminal e contração muscular.',
      });
    }

    // 8. Awareness under paralysis: the motor exam cannot be used as anesthesia depth.
    if (receptors.nmOccupancy > 0.35 && receptors.hypnoticEffect < 0.35) {
      interactions.push({
        title: 'Consciência Preservada sob Bloqueio Neuromuscular',
        severity: 'lethal',
        description: 'O paciente está imóvel, porém sem hipnose adequada. Ausência de movimento não significa inconsciência ou analgesia.',
        pharmacologyMechanism: 'O bloqueio nicotínico ocorre apenas na placa motora; não atravessa a barreira hematoencefálica e não deprime percepção cortical nem nocicepção.',
      });
    }

    // 9. Integrated sedative/opioid/induction respiratory synergy.
    if (receptors.centralSedation > 0.45 && receptors.respiratoryDepression > 0.58) {
      interactions.push({
        title: 'Somação Depressora Central de Sedativos e Opioides',
        severity: receptors.respiratoryDepression > 0.78 ? 'danger' : 'warning',
        description: 'A sedação combinada reduziu de forma não linear o drive ventilatório e a resposta ao CO₂; monitorar ventilação, não apenas SpO₂.',
        pharmacologyMechanism: 'Convergência de Gi opioide/alfa-2 e hiperpolarização GABAérgica nos circuitos bulbares reduz frequência e volume corrente.',
      });
    }

    // 10. Additive vasodilation/histamine burden.
    if (receptors.directBloodPressureEffect < -0.38 || receptors.acuteBolusHypotension > 0.5) {
      interactions.push({
        title: 'Carga Vasodilatadora e Redução de Retorno Venoso',
        severity: receptors.acuteBolusHypotension > 0.7 ? 'danger' : 'warning',
        description: 'Bloqueio vasomotor, venodilatação e/ou liberação de histamina estão reduzindo pré-carga, débito cardíaco e pressão arterial.',
        pharmacologyMechanism: 'Redução aditiva do tônus arterial e da capacitância venosa por bloqueio alfa-1, anestésicos gerais e efeitos de bólus rápido.',
      });
    }

    // 11. Sugammadex does not encapsulate atracurium.
    if (receptors.reversalCe.sugammadex > 0.05 && activeIds.has('atracurium')) {
      interactions.push({
        title: 'Sugamadex Ineficaz para Atracúrio',
        severity: 'danger',
        description: 'O bloqueio por atracúrio permanece. Manter ventilação e usar reversão apropriada quando indicada.',
        pharmacologyMechanism: 'Sugamadex encapsula bloqueadores aminosteroides; atracúrio é benzilisoquinolínico e não é seu substrato.',
      });
    }

    // 12. Feline Local Anesthetic Cardiotoxicity
    if (patient.species === 'feline' && receptors.naVBlockade > 0.20) {
      interactions.push({
        title: 'Intoxicação Miocárdica por Anestésico Local IV em Felino',
        severity: receptors.naVBlockade > 0.45 ? 'lethal' : 'danger',
        description: 'Bloqueio acentuado dos canais rápidos de sódio NaV1.5 e depressão do influxo de cálcio miocárdico em felinos. Risco iminente de AESP ou assistolia.',
        pharmacologyMechanism: 'Sensibilidade de espécie decorrente de menor densidade de canais de sódio e menor capacidade de tamponamento e depuração microssomal.',
      });
    }

    // 13. Multi-Modal Balanced Analgesia Synergy (Opioid + Alpha-2 + NMDA Antagonist)
    if (receptors.muOpioidDrive > 0.30 && receptors.alpha2Drive > 0.25 && receptors.nmdaBlockade > 0.20) {
      interactions.push({
        title: 'Analgesia Multimodal Preventiva Balanceada (Tríade O-A-K)',
        severity: 'info',
        description: 'Excelente sinergismo analgésico espinal e supraespinal com bloqueio de wind-up nociceptivo e estabilização hemodinâmica completa.',
        pharmacologyMechanism: 'Ação sinérgica: ativação de receptores mu e alfa-2 pré-sinápticos reduzindo liberação de substância P e glutamato no corno dorsal, associada ao bloqueio pós-sináptico dos receptores NMDA pela cetamina.',
      });
    }

    // 14. Ephedrine Hemodynamic Restoration in Inhalant-Induced Hypotension
    if (activeIds.has('ephedrine') && receptors.volatileSiteOccupancy > 0.25) {
      interactions.push({
        title: 'Resgate Hemodinâmico por Efedrina na Hipotensão por Inalatório',
        severity: 'info',
        description: 'Ação mista alfa-1 e beta-1 restaura volume sistólico e PAM deprimidos pelo anestésico volátil sem provocar vasoconstrição periférica excessiva ou bradicardia reflexa.',
        pharmacologyMechanism: 'Agonismo beta-1 miocárdico e alfa-1 vascular combinado à liberação de noradrenalina endógena compensa a depressão miocárdica e a venodilatação induzidas pelo isoflurano/sevoflurano.',
      });
    }

    // 15. Ephedrine Adrenergic Tachyphylaxis
    const ephedrineDoses = activeDoses.filter((d) => d.drugId === 'ephedrine');
    const totalEphedrineMgKg = ephedrineDoses.reduce((sum, d) => sum + d.dosePerKg, 0);
    if (activeIds.has('ephedrine') && totalEphedrineMgKg > 0.22) {
      interactions.push({
        title: 'Taquifilaxia Adrenérgica por Efedrina (Depleção Vesicular)',
        severity: 'warning',
        description: 'Doses repetidas de efedrina esgotaram as reservas pré-sinápticas de noradrenalina. A resposta vasopressora está diminuída; considerar agonista direto (Norepinefrina ou Dobutamina).',
        pharmacologyMechanism: 'A ação indireta da efedrina esvazia as vesículas de armazenamento de catecolaminas pré-sinápticas, reduzindo progressivamente a exocitose de noradrenalina a cada novo bólus.',
      });
    }

    return interactions;
  }
}
