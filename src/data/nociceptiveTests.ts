import type { NociceptiveTestDefinition } from '../types/simulator';

/**
 * Testes padronizados de nocicepção e sensibilidade dolorosa realizados
 * no exame físico pré-anestésico e durante a monitorização da profundidade cirúrgica.
 */
export const NOCICEPTIVE_TESTS: NociceptiveTestDefinition[] = [
  {
    id: 'pinch_interdigital',
    name: 'Pinçamento Interdigital (Pinça Halsted)',
    description: 'Aplica compressão na membrana interdigital com pinça hemostática. Testa o reflexo espinhal de retirada (pedal) e a resposta autonômica a dor somática.',
    intensity: 0.65,
    durationSeconds: 6,
    type: 'somatic_superficial',
    targetTissue: 'Pele e membrana interdigital (Fibras A-delta & C)',
  },
  {
    id: 'pressure_periosteal',
    name: 'Pressão Periosteal / Coxim Profundo',
    description: 'Compressão firme sobre periósteo tibial/radial ou coxim plantar profundo. Avalia nocicepção somática de alta intensidade.',
    intensity: 0.85,
    durationSeconds: 6,
    type: 'somatic_deep',
    targetTissue: 'Periósteo e coxim profundo (Nociceptores somáticos de limiar elevado)',
  },
  {
    id: 'visceral_traction',
    name: 'Palpação / Tração Visceral',
    description: 'Tração de peritônio/mesentério ou compressão visceral profunda. Testa a cobertura analgésica visceral (onde cetamina isolada é insuficiente e opioides são mandatórios).',
    intensity: 0.80,
    durationSeconds: 8,
    type: 'visceral',
    targetTissue: 'Peritônio visceral e mesentério (Fibras C aferentes autonômicas)',
  },
  {
    id: 'pinch_tail_cutaneous',
    name: 'Pinçamento da Cauda / Flanco',
    description: 'Estímulo superficial em prega de pele para testar resposta em sedação leve ou planos superficiais de indução.',
    intensity: 0.40,
    durationSeconds: 5,
    type: 'somatic_superficial',
    targetTissue: 'Prega cutânea do flanco / cauda (Mecanonociceptores superficiais)',
  },
];
