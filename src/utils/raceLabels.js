const normalizeForMatch = (value = "") => (
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
);

const TRACK_LABELS = [
  ["albert park", "Albert Park"],
  ["shanghai", "Shanghai"],
  ["suzuka", "Suzuka"],
  ["bahrain", "Bahrain"],
  ["jeddah", "Jeddah"],
  ["miami", "Miami"],
  ["enzo e dino ferrari", "Imola"],
  ["imola", "Imola"],
  ["monaco", "Monaco"],
  ["barcelona-catalunya", "Barcelona-Catalunya"],
  ["gilles-villeneuve", "Gilles-Villeneuve"],
  ["red bull ring", "Red Bull Ring"],
  ["silverstone", "Silverstone"],
  ["spa-francorchamps", "Spa"],
  ["hungaroring", "Hungaroring"],
  ["zandvoort", "Zandvoort"],
  ["monza", "Monza"],
  ["baku", "Baku"],
  ["marina bay", "Marina Bay"],
  ["americas", "COTA"],
  ["hermanos rodriguez", "Hermanos Rodriguez"],
  ["jose carlos pace", "Interlagos"],
  ["las vegas", "Las Vegas Strip"],
  ["lusail", "Lusail"],
  ["yas marina", "Yas Marina"],
];

const stripGrandPrix = (value = "") => (
  value.replace(/\s+grand prix$/i, "").trim()
);

export const getTrackName = (race = {}) => {
  const circuit = race.circuit ?? "";
  const grandPrix = race.grand_prix ?? "";
  const matchValue = normalizeForMatch(`${circuit} ${grandPrix}`);
  const matchedTrack = TRACK_LABELS.find(([needle]) => matchValue.includes(needle));

  if (matchedTrack) return matchedTrack[1];

  const circuitName = circuit.split(",")[0]?.trim();
  if (circuitName) return circuitName;

  const grandPrixName = stripGrandPrix(grandPrix);
  if (grandPrixName) return grandPrixName;

  return race.round ? `R${race.round}` : "Unknown";
};
