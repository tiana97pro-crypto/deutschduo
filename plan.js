/* DeutschDuo · Plan du jour
 * Bandeau affiché au-dessus de l'écran d'accueil « Réviser » (quand aucune session n'est en cours).
 * Dépend de window.DD (index.html). À charger APRÈS tous les modules.
 * Données propres : localStorage « dd_plan ».
 */
(function(){
'use strict';
const DD = window.DD;
if (!DD || !DD.store) return;
const esc = DD.esc, store = DD.store;

/* ---------- Réglages faciles à modifier ---------- */
const TOTAL = 90;      // durée du parcours en jours
// Activité principale du jour, selon le numéro du jour (modifiez l'ordre à volonté).
// Valeurs possibles : les identifiants de vos modules.
const ROTATION = ['schreiben', 'lesen', 'hoeren', 'schreiben', 'lesenb2', 'hoeren'];
const MAIN = {
  schreiben: 'Écrire un texte (Schreiben)',
  lesen: 'Lire un texte (Lesen)',
  lesenb2: 'Lecture niveau B2 (Lesen B2)',
  hoeren: 'Écouter un document (Hören)'
};
const DAY = 86400000;

/* ---------- Utilitaires ---------- */
const mid = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hasView = id => !!document.querySelector('nav button[data-view="' + id + '"]');
const rules = () => window.DD_RULES || {};

function load(){
  const p = store.get('dd_plan', null);
  return (p && typeof p === 'object' && p.days && typeof p.days === 'object')
    ? p : { start: Date.now(), days: {} };
}
function savePlan(p){
  const keys = Object.keys(p.days);
  for (let i = 0; i < keys.length - 150; i++) delete p.days[keys[i]];   // garde ~150 jours
  store.set('dd_plan', p);
}

/* ---------- Construction du plan du jour ---------- */
function buildActs(n){
  const acts = [{ id: 'cards' }];
  if (hasView('grammatik')){
    const e = store.get('dd_errors', {}) || {};
    const top = Object.keys(e).filter(k => e[k] && e[k].n).sort((a, b) => e[b].n - e[a].n).slice(0, 3);
    acts.push({ id: 'gram', rule: top.length ? top[n % top.length] : '' });
  }
  if (hasView('redemittel')) acts.push({ id: 'rm' });
  for (let k = 0; k < ROTATION.length; k++){
    const m = ROTATION[(n + k) % ROTATION.length];
    if (hasView(m)){ acts.push({ id: 'main', mod: m }); break; }
  }
  return acts;
}

/* ---------- État d'une activité ---------- */
function status(a, day, today){
  const manual = !!day.manual[a.id];
  if (a.id === 'cards'){
    const cards = store.get('dd_cards', []) || [];
    const log = store.get('dd_log', {}) || {};
    const s = store.get('dd_settings', {}) || {};
    const l = log[today] || {};
    const due = cards.filter(c => c.lastReview && c.due <= Date.now()).length;
    const room = Math.max(0, (s.newPerDay || 0) + (l.bonus || 0) - (l.newSeen || 0));
    const fresh = Math.min(room, cards.filter(c => !c.lastReview).length);
    const left = due + fresh;
    let detail;
    if (left > 0) detail = left + ' carte' + (left > 1 ? 's' : '') + ' (' + due + ' à revoir, ' + fresh + ' nouvelle' + (fresh > 1 ? 's' : '') + ') · démarrez la session ci-dessous';
    else detail = cards.length ? 'Rien à réviser pour le moment' : 'Aucune carte pour l\u2019instant';
    return { label: 'Réviser le carnet', detail: detail, done: left === 0, tick: false };
  }
  if (a.id === 'gram'){
    const sc = store.get('dd_pack_scores', {}) || {};
    const auto = Object.keys(sc).some(k => sc[k] && sc[k].date && DD.dayKey(sc[k].date) === today);
    const r = a.rule;
    return {
      label: r ? 'Grammaire : ' + (rules()[r] || r) : 'Grammaire : une fiche au choix',
      detail: r ? 'L\u2019un de vos points faibles du moment' : 'Pas encore de point faible enregistré',
      done: auto || manual, tick: true, go: 'grammatik', rule: r || ''
    };
  }
  if (a.id === 'rm'){
    return { label: 'Redemittel : parcourir et s\u2019entraîner', detail: 'Quelques expressions à réutiliser dans vos textes',
      done: manual, tick: true, go: 'redemittel' };
  }
  // activité principale
  let auto = false;
  if (a.mod === 'schreiben'){
    const t = store.get('dd_texts', []) || [];
    auto = t.some(x => x && x.ts && DD.dayKey(x.ts) === today);
  }
  return { label: MAIN[a.mod] || a.mod, detail: 'Activité principale du jour',
    done: auto || manual, tick: true, go: a.mod };
}

function completeStreak(plan){
  let c = 0, t = Date.now();
  const has = k => plan.days[k] && plan.days[k].complete;
  if (!has(DD.dayKey(t))) t -= DAY;
  while (c < 400 && has(DD.dayKey(t))){ c++; t -= DAY; }
  return c;
}

/* ---------- Rendu ---------- */
function injectStyle(){
  if (document.getElementById('pl-style')) return;
  const s = document.createElement('style'); s.id = 'pl-style';
  s.textContent = [
    '.pl{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 16px}',
    '.pl-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px}',
    '.pl-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}',
    '.pl-row:first-of-type{border-top:0}',
    '.pl-mark{width:22px;text-align:center;color:var(--muted);font-size:1.1rem}',
    '.pl-row.done .pl-mark{color:var(--good)}',
    '.pl-row.done .pl-t{color:var(--muted)}',
    '.pl-txt{flex:1;min-width:0}',
    '.pl-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
    '.pl-b{font:inherit;font-size:.88rem;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
    '.pl-b.go{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}',
    '.pl-ok{color:var(--good);margin:8px 0 0}'
  ].join('\n');
  document.head.appendChild(s);
}

function build(){
  injectStyle();
  const plan = load();
  const today = DD.dayKey();
  const n = Math.round((mid(Date.now()) - mid(plan.start)) / DAY) + 1;
  let day = plan.days[today];
  if (!day){ day = { acts: buildActs(n), manual: {}, complete: false }; plan.days[today] = day; }
  const rows = day.acts.map(a => ({ a: a, s: status(a, day, today) }));
  const all = rows.every(r => r.s.done);
  day.complete = all;
  savePlan(plan);
  const streak = completeStreak(plan);

  let h = '<section class="pl" aria-label="Plan du jour"><div class="pl-head"><b>Plan du jour</b>' +
    '<span class="hint">Jour ' + n + ' / ' + TOTAL + (streak ? ' · ' + streak + ' jour' + (streak > 1 ? 's' : '') + ' complet' + (streak > 1 ? 's' : '') + ' de suite' : '') + '</span></div>';
  h += rows.map(r => {
    const s = r.s;
    let b = '';
    if (s.go) b += '<button class="pl-b go" data-plan="go" data-go="' + esc(s.go) + '"' + (s.rule ? ' data-rule="' + esc(s.rule) + '"' : '') + '>Ouvrir</button>';
    if (s.tick) b += '<button class="pl-b" data-plan="tick" data-id="' + esc(r.a.id) + '">' + (day.manual[r.a.id] ? 'Annuler' : 'Marquer fait') + '</button>';
    return '<div class="pl-row' + (s.done ? ' done' : '') + '"><span class="pl-mark">' + (s.done ? '✓' : '○') + '</span>' +
      '<div class="pl-txt"><div class="pl-t"><b>' + esc(s.label) + '</b></div><div class="hint">' + esc(s.detail) + '</div></div>' +
      '<div class="pl-btns">' + b + '</div></div>';
  }).join('');
  if (all) h += '<p class="pl-ok"><b>Journée complète.</b></p>';
  return h + '</section>';
}

DD.planHtml = function(){
  try { return build(); } catch (e) { return ''; }
};

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-plan]'); if (!el) return;
  const a = el.dataset.plan;
  if (a === 'go'){
    if (el.dataset.rule) DD.pending = { rule: el.dataset.rule };
    DD.setView(el.dataset.go);
  } else if (a === 'tick'){
    const plan = load(), day = plan.days[DD.dayKey()]; if (!day) return;
    const id = el.dataset.id;
    day.manual[id] = !day.manual[id];
    savePlan(plan); DD.render();
  }
});

// Le premier rendu de la page a eu lieu avant le chargement de ce fichier.
if (DD.view === 'review') DD.render();
})();
