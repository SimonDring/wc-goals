export function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip diacritics
    .trim()
    .toLowerCase();
}

// Each array lists spellings that mean the same team; first element is canonical display.
const ALIAS_GROUPS = [
  ["Czechia", "Czech Republic"],
  ["South Korea", "Korea Republic", "Korea, South"],
  ["USA", "United States", "United States of America", "USMNT"],
  ["Côte d'Ivoire", "Ivory Coast", "Cote d'Ivoire"],
  ["Cabo Verde", "Cape Verde"],
  ["Türkiye", "Turkey"],
  ["DR Congo", "Congo DR", "Democratic Republic of Congo", "DR Congo (Zaire)"],
];
const ALIAS_LOOKUP = new Map();
for (const group of ALIAS_GROUPS) {
  const canonicalKey = normalizeName(group[0]);
  for (const spelling of group) {
    ALIAS_LOOKUP.set(normalizeName(spelling), canonicalKey);
  }
}
export function resolveTeamKey(name) {
  const norm = normalizeName(name);
  return ALIAS_LOOKUP.get(norm) ?? norm;
}

const PLAYED = new Set(["FINISHED", "IN_PLAY", "PAUSED"]);
export function tallyTeamGoals(matches) {
  const table = new Map();
  const bump = (rawName, goals) => {
    const key = resolveTeamKey(rawName);
    const row = table.get(key) ?? { display: rawName, goals: 0, matchesPlayed: 0 };
    row.goals += goals;
    row.matchesPlayed += 1;
    table.set(key, row);
  };
  for (const m of matches) {
    if (!PLAYED.has(m.status)) continue;
    const home = m.score?.fullTime?.home ?? 0;
    const away = m.score?.fullTime?.away ?? 0;
    bump(m.homeTeam.name, home);
    bump(m.awayTeam.name, away);
  }
  return table;
}
