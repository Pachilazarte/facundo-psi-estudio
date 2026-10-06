// Colores y medidas de la app. Son los mismos tonos de la web (crema y verde esmeralda).
// Ninguna pantalla define colores propios: todo sale de acá.

export const tema = {
  fondo: '#FBF8F3',
  superficie: '#FFFFFF',
  superficieSuave: '#F4EFE7',
  borde: '#E7E1D8',
  texto: '#1F2937',
  textoSuave: '#5B6472',
  acento: '#047857',
  acentoIcono: '#059669',
  acentoSuave: '#D1FAE5',
  textoSobreAcento: '#FFFFFF',
  error: '#B91C1C',
  errorSuave: '#FEE2E2',
  aviso: '#92400E',
  avisoSuave: '#FEF3C7',
  velo: 'rgba(15, 23, 42, 0.45)',
} as const;

// Ningún toque se hace en algo más chico que esto (recomendación de Apple y Android).
export const TOQUE_MINIMO = 44;
