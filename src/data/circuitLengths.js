const CIRCUIT_LENGTHS_METERS = Object.freeze({
  melbourne: 5278,
  shanghai: 5451,
  suzuka: 5807,
  sakhir: 5412,
  bahrain: 5412,
  jeddah: 6174,
  miami: 5412,
  'miami gardens': 5412,
  imola: 4909,
  monaco: 3337,
  'monte carlo': 3337,
  barcelona: 4657,
  montmelo: 4657,
  montreal: 4361,
  spielberg: 4318,
  silverstone: 5891,
  'spa-francorchamps': 7004,
  spa: 7004,
  budapest: 4381,
  zandvoort: 4259,
  monza: 5793,
  baku: 6003,
  singapore: 4940,
  'marina bay': 4940,
  austin: 5513,
  'mexico city': 4304,
  'sao paulo': 4309,
  interlagos: 4309,
  'las vegas': 6201,
  lusail: 5419,
  'yas marina circuit': 5281,
  'yas island': 5281,
  madrid: 5474,
});

const normalizeLocation = (location) => (
  String(location ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
);

/**
 * Circuit configuration lengths are deliberately explicit rather than inferred.
 * A new or revised layout should remain unavailable until its official length is
 * confirmed and added here.
 */
export const getCircuitLengthMeters = (location) => (
  CIRCUIT_LENGTHS_METERS[normalizeLocation(location)] ?? null
);

