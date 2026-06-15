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
  ["Türkiye", "Turkey"],
  ["DR Congo", "Congo DR", "Democratic Republic of Congo", "DR Congo (Zaire)"],
  ["Iran", "IR Iran", "Iran (Islamic Republic of)"],
  ["Cabo Verde", "Cape Verde", "Cape Verde Islands"],
  ["Bosnia and Herzegovina", "Bosnia-Herzegovina", "Bosnia & Herzegovina"],
];
const ALIAS_LOOKUP = new Map();
for (const group of ALIAS_GROUPS) {
  const canonicalKey = normalizeName(group[0]);
  for (const spelling of group) {
    ALIAS_LOOKUP.set(normalizeName(spelling), canonicalKey);
  }
}
const CANONICAL_DISPLAY = new Map();
for (const group of ALIAS_GROUPS) {
  CANONICAL_DISPLAY.set(normalizeName(group[0]), group[0]);
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
    const row = table.get(key) ?? { display: CANONICAL_DISPLAY.get(key) ?? rawName, goals: 0, matchesPlayed: 0 };
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

function withRanks(sortedPeople) {
  let lastGoals = null;
  let lastRank = 0;
  return sortedPeople.map((p, i) => {
    const rank = p.goals === lastGoals ? lastRank : i + 1;
    lastGoals = p.goals;
    lastRank = rank;
    return { ...p, rank };
  });
}
// Every team appearing in the tournament feed (any status), key -> canonical display.
// A team that hasn't kicked off yet is still in the roster; it just has 0 goals.
export function rosterFromMatches(matches) {
  const roster = new Map();
  for (const m of matches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t?.name) continue;
      const key = resolveTeamKey(t.name);
      if (!roster.has(key)) roster.set(key, CANONICAL_DISPLAY.get(key) ?? t.name);
    }
  }
  return roster;
}
export function buildLeaderboard(matches, assignments, now = new Date()) {
  const table = tallyTeamGoals(matches);
  const roster = rosterFromMatches(matches);
  const goalsFor = (teamName) => table.get(resolveTeamKey(teamName))?.goals ?? 0;
  // Every team in the tournament, including those yet to play (0 goals, 0 played).
  const teams = [...roster.entries()]
    .map(([key, display]) => {
      const row = table.get(key);
      return { team: display, goals: row?.goals ?? 0, matchesPlayed: row?.matchesPlayed ?? 0 };
    })
    .sort((a, b) => b.goals - a.goals || a.team.localeCompare(b.team, "en"));
  // Only flag assignments whose team never appears in the tournament at all
  // (a genuine name mismatch or non-qualifier) — not teams simply yet to play.
  const rosterKeys = new Set(roster.keys());
  const unmatchedTeams = [];
  for (const pair of Object.values(assignments)) {
    for (const teamName of pair) {
      if (!rosterKeys.has(resolveTeamKey(teamName)) && !unmatchedTeams.includes(teamName)) {
        unmatchedTeams.push(teamName);
      }
    }
  }
  const peopleSorted = Object.entries(assignments)
    .map(([name, pair]) => {
      const breakdown = pair.map(goalsFor);
      return { name, teams: pair, breakdown, goals: breakdown.reduce((sum, g) => sum + g, 0) };
    })
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "en"));
  const people = withRanks(peopleSorted);
  const ascending = [...people].sort((a, b) => a.goals - b.goals || a.name.localeCompare(b.name, "en"));
  return {
    updatedAt: now.toISOString(),
    teams,
    people,
    topMost: people.slice(0, 10),
    topLeast: ascending.slice(0, 10),
    unmatchedTeams,
  };
}
