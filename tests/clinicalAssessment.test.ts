import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSexBiochemicalReference,
  estimateRenalImpairment,
  estimateHepaticImpairment,
  interpretAsaScore,
} from '../src/engine/clinicalAssessmentEngine';
import { STANDARD_ELECTIVE_DOG, PRESET_SCENARIOS } from '../src/data/scenarios';

test('getSexBiochemicalReference: reflete diferenças fisiológicas realistas por sexo', () => {
  const maleDog = getSexBiochemicalReference('canine', 'Macho');
  const femaleDog = getSexBiochemicalReference('canine', 'Fêmea');
  const castratedMaleDog = getSexBiochemicalReference('canine', 'Macho Castrado');

  // Macho inteiro tem maior hematócrito basal devido ao estímulo androgênico medular
  assert.ok(maleDog.hematocritPct > femaleDog.hematocritPct, 'Macho inteiro deve ter Ht superior à fêmea');
  assert.equal(maleDog.hematocritPct, 48);
  assert.equal(femaleDog.hematocritPct, 42);

  // Macho inteiro tem maior creatinina sérica basal devido à maior proporção de massa muscular esquelética
  assert.ok(maleDog.creatinineMgDl > femaleDog.creatinineMgDl, 'Macho deve ter creatinina basal superior à fêmea');
  assert.equal(maleDog.creatinineMgDl, 1.1);
  assert.equal(femaleDog.creatinineMgDl, 0.8);

  // Macho castrado apresenta valores intermediários
  assert.ok(castratedMaleDog.creatinineMgDl >= femaleDog.creatinineMgDl);
  assert.ok(castratedMaleDog.hematocritPct < maleDog.hematocritPct);
});

test('estimateRenalImpairment: calcula adequadamente os estágios IRIS e gravidade', () => {
  // 1. Paciente hígido
  const normal = estimateRenalImpairment(
    { creatinineMgDl: 1.0, ureaMgDl: 25, sdmaUgDl: 9, urineSpecificGravity: 1.035, oliguriaAnuria: 'normal' },
    'canine',
    'Macho'
  );
  assert.ok(normal.severity <= 0.15, 'Função renal normal deve ter comprometimento mínimo (<15%)');
  assert.equal(normal.stageLabel, 'Função Renal Normal');

  // 2. IRIS 2 (Leve a moderado)
  const iris2 = estimateRenalImpairment(
    { creatinineMgDl: 2.2, ureaMgDl: 60, sdmaUgDl: 16, urineSpecificGravity: 1.025 },
    'canine',
    'Macho'
  );
  assert.ok(iris2.severity >= 0.20 && iris2.severity <= 0.45, 'IRIS 2 deve situar-se entre 20% e 45%');
  assert.match(iris2.stageLabel, /IRIS Estágio 2/);

  // 3. IRIS 3 (Moderado a grave)
  const iris3 = estimateRenalImpairment(
    { creatinineMgDl: 3.8, ureaMgDl: 110, sdmaUgDl: 26, urineSpecificGravity: 1.012 },
    'canine',
    'Macho'
  );
  assert.ok(iris3.severity >= 0.45 && iris3.severity <= 0.75, 'IRIS 3 deve situar-se entre 45% e 75%');
  assert.match(iris3.stageLabel, /IRIS Estágio 3/);

  // 4. IRIS 4 (Falência avançada / Anúria)
  const iris4 = estimateRenalImpairment(
    { creatinineMgDl: 6.8, ureaMgDl: 210, sdmaUgDl: 42, oliguriaAnuria: 'anuria' },
    'canine',
    'Macho'
  );
  assert.ok(iris4.severity >= 0.75, 'IRIS 4 deve situar-se acima de 75%');
  assert.match(iris4.stageLabel, /IRIS Estágio 4/);
});

test('estimateHepaticImpairment: distingue lesão enzimática de falência de síntese', () => {
  // 1. Fígado normal
  const normal = estimateHepaticImpairment({
    altUl: 30,
    alpUl: 40,
    totalBilirubinMgDl: 0.2,
    albuminGDl: 3.3,
    ptStatus: 'normal',
  });
  assert.equal(normal.severity, 0);

  // 2. Lesão enzimática leve (ALT elevada isolada com síntese normal)
  const enzymeOnly = estimateHepaticImpairment({
    altUl: 350,
    alpUl: 220,
    totalBilirubinMgDl: 0.3,
    albuminGDl: 3.2,
    ptStatus: 'normal',
  });
  assert.ok(enzymeOnly.severity > 0 && enzymeOnly.severity <= 0.35);

  // 3. Insuficiência hepática grave (Hipoalbuminemia crítica + Coagulopatia)
  const severe = estimateHepaticImpairment({
    altUl: 450,
    alpUl: 300,
    totalBilirubinMgDl: 2.8,
    albuminGDl: 1.7, // síntese gravemente comprometida
    ptStatus: 'prolonged', // coagulopatia
  });
  assert.ok(severe.severity >= 0.70, 'Hipoalbuminemia + TP prolongado deve gerar insuficiência > 70%');
  assert.match(severe.stageLabel, /Insuficiência Hepática Grave/);
});

test('interpretAsaScore: interpretação automatizada e sufixo de emergência', () => {
  // 1. Paciente padrão eletivo hígido -> ASA I
  const asa1 = interpretAsaScore({
    species: 'canine',
    ageYears: 3,
    ageMonths: 0,
    gender: 'Macho',
    cardiacCompromise: 'none',
    cardiacAuscultation: 'normal_sinus',
    respiratoryCompromise: 'none',
    respiratoryAuscultation: 'eupneic_clear',
    hemorrhageSeverity: 'none',
    renalSeverity: 0,
    hepaticSeverity: 0,
    isEmergency: false,
  });
  assert.equal(asa1.calculatedAsa, 'I');
  assert.equal(asa1.baseClass, 'I');

  // 2. Paciente eletivo que vira emergência -> ASA I-E
  const asa1E = interpretAsaScore({
    species: 'canine',
    ageYears: 3,
    ageMonths: 0,
    gender: 'Macho',
    cardiacCompromise: 'none',
    cardiacAuscultation: 'normal_sinus',
    respiratoryCompromise: 'none',
    respiratoryAuscultation: 'eupneic_clear',
    hemorrhageSeverity: 'none',
    renalSeverity: 0,
    hepaticSeverity: 0,
    isEmergency: true,
  });
  assert.equal(asa1E.calculatedAsa, 'I-E');

  // 3. Cardiopata leve ou idoso -> ASA II
  const asa2 = interpretAsaScore({
    species: 'canine',
    ageYears: 11,
    ageMonths: 0,
    gender: 'Macho Castrado',
    cardiacCompromise: 'mild',
    cardiacAuscultation: 'mild_murmur',
    respiratoryCompromise: 'none',
    respiratoryAuscultation: 'eupneic_clear',
    hemorrhageSeverity: 'none',
    renalSeverity: 0.1,
    hepaticSeverity: 0,
    isEmergency: false,
  });
  assert.equal(asa2.baseClass, 'II');

  // 4. Cardiopata moderado (ICC B2) com disfunção renal -> ASA III
  const asa3 = interpretAsaScore({
    species: 'canine',
    ageYears: 8,
    ageMonths: 0,
    gender: 'Macho',
    cardiacCompromise: 'moderate',
    cardiacAuscultation: 'loud_murmur',
    respiratoryCompromise: 'none',
    respiratoryAuscultation: 'eupneic_clear',
    hemorrhageSeverity: 'none',
    renalSeverity: 0.45,
    hepaticSeverity: 0,
    isEmergency: false,
  });
  assert.equal(asa3.baseClass, 'III');

  // 5. Choque hemorrágico descompensado de emergência -> ASA IV-E
  const asa4E = interpretAsaScore({
    species: 'canine',
    ageYears: 4,
    ageMonths: 0,
    gender: 'Macho',
    cardiacCompromise: 'moderate',
    cardiacAuscultation: 'normal_sinus',
    respiratoryCompromise: 'moderate',
    respiratoryAuscultation: 'moderate_crackles_wheezes',
    hemorrhageSeverity: 'severe',
    renalSeverity: 0.5,
    hepaticSeverity: 0.4,
    isEmergency: true,
  });
  assert.equal(asa4E.calculatedAsa, 'IV-E');
  assert.equal(asa4E.baseClass, 'IV');
});

test('STANDARD_ELECTIVE_DOG é o paciente canino índice 0 em PRESET_SCENARIOS', () => {
  assert.equal(PRESET_SCENARIOS[0].id, STANDARD_ELECTIVE_DOG.id);
  assert.equal(PRESET_SCENARIOS[0].asa, 'I');
  assert.equal(PRESET_SCENARIOS[0].species, 'canine');
  assert.ok(PRESET_SCENARIOS[0].labMarkers !== undefined);
  assert.ok(PRESET_SCENARIOS[0].clinicalAssessment !== undefined);
});
