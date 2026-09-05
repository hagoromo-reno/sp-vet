import type { SurgicalProcedureDefinition } from '../types/simulator';

/** Standardized tissue events used to drive graded nociception and stress. */
export const SURGICAL_PROCEDURES: SurgicalProcedureDefinition[] = [
  { id: 'skin_incision', name: 'Incisão cutânea', description: 'Estímulo somático superficial, rápido e localizado.', intensity: 0.42, durationSeconds: 12, tissueLayer: 'cutaneous' },
  { id: 'muscle_dissection', name: 'Dissecção muscular', description: 'Tração e secção muscular com recrutamento sustentado.', intensity: 0.62, durationSeconds: 24, tissueLayer: 'muscular' },
  { id: 'periosteal_manipulation', name: 'Manipulação periosteal', description: 'Estímulo somático profundo de alta intensidade.', intensity: 0.86, durationSeconds: 20, tissueLayer: 'periosteal' },
  { id: 'visceral_traction', name: 'Tração visceral', description: 'Estímulo autonômico difuso, intenso e prolongado.', intensity: 0.92, durationSeconds: 30, tissueLayer: 'visceral' },
  { id: 'abdominal_closure', name: 'Síntese abdominal', description: 'Estímulo misto repetitivo durante o fechamento por planos.', intensity: 0.52, durationSeconds: 40, tissueLayer: 'mixed' },
];
