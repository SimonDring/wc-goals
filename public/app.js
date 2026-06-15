const FAV_KEY = "wc-goals-fav";
const $ = (sel) => document.querySelector(sel);

function favName() { return localStorage.getItem(FAV_KEY) || ""; }
function setFav(name) {
  if (favName() === name) localStorage.removeItem(FAV_KEY);
  else localStorage.setItem(FAV_KEY, name);
}

function timeAgo(iso) {
  if (!iso) return "not updated yet";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

function personLi(p, { showStar = true } = {}) {
  const li = document.createElement("li");
  li.dataset.search = (p.name + " " + p.teams.join(" ")).toLowerCase();
  if (p.name === favName()) li.classList.add("fav");
  li.innerHTML = `
    <span class="rank">${p.rank}</span>
    <span>
      <span class="name">${p.name}</span><br>
      <span class="sub">${p.teams[0]} ${p.breakdown[0]} + ${p.teams[1]} ${p.breakdown[1]}</span>
    </span>
    <span class="goals">${p.goals}</span>
    ${showStar ? `<button class="star ${p.name === favName() ? "on" : ""}" title="Favourite">★</button>` : ""}`;
  const star = li.querySelector(".star");
  if (star) star.addEventListener("click", () => { setFav(p.name); render(window.__data); });
  return li;
}

function teamLi(t, i) {
  const li = document.createElement("li");
  li.dataset.search = t.team.toLowerCase();
  if (i === 0 && t.goals > 0) li.classList.add("leader");
  li.innerHTML = `
    <span class="rank">${i + 1}</span>
    <span><span class="name">${i === 0 && t.goals > 0 ? "🏆 " : ""}${t.team}</span><br>
      <span class="sub">${t.matchesPlayed} played</span></span>
    <span class="goals">${t.goals}</span>`;
  return li;
}

function fill(ol, items, fn) {
  ol.replaceChildren();
  items.forEach((it, i) => ol.appendChild(fn(it, i)));
}

function render(data) {
  window.__data = data;
  const ago = timeAgo(data.updatedAt);
  $("#updated").textContent = data.updatedAt ? "Updated " + ago : ago;

  // pin the favourited person to the very top of the page
  const mine = data.people.find((p) => p.name === favName());
  if (mine) {
    fill($("#mypick"), [mine], (p) => personLi(p));
    $("#mypick-head").classList.remove("hidden");
  } else {
    $("#mypick").replaceChildren();
    $("#mypick-head").classList.add("hidden");
  }

  // data.people is sorted most-goals-first; ascending is the reverse order
  const peopleAsc = [...data.people].sort(
    (a, b) => a.goals - b.goals || a.name.localeCompare(b.name, "en"));

  // Dashboard: top 3 of each category
  fill($("#dash-most"), data.people.slice(0, 3), (p) => personLi(p));
  fill($("#dash-least"), peopleAsc.slice(0, 3), (p) => personLi(p));
  fill($("#dash-teams"), data.teams.slice(0, 3), teamLi);

  // Full overall leaderboards
  fill($("#people-desc"), data.people, (p) => personLi(p));
  fill($("#people-asc"), peopleAsc, (p) => personLi(p));

  // Every team
  fill($("#teams-all"), data.teams, teamLi);

  $("#unmatched").textContent = data.unmatchedTeams.length
    ? `Note: no live data yet for ${data.unmatchedTeams.join(", ")} (showing 0).`
    : "";
  applySearch();
}

function applySearch() {
  const q = $("#search").value.trim().toLowerCase();
  document.querySelectorAll(".board li").forEach((li) => {
    li.classList.toggle("hidden", q && !li.dataset.search.includes(q));
  });
}

function initTabs() {
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      $("#" + btn.dataset.tab).classList.add("active");
    });
  });
}

$("#search").addEventListener("input", applySearch);
initTabs();
fetch("data.json")
  .then((r) => r.json())
  .then(render)
  .catch(() => { $("#updated").textContent = "Could not load scores."; });
