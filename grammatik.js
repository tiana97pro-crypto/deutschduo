/* DeutschDuo · module Grammatik
   Hub de règles, fiches et exercices depuis des "packs" (GitHub ou import manuel),
   plus deux générateurs d'exercices par code (déclinaison/prépositions, connecteurs).
   Nécessite index.html (objet window.DD). */
(function () {
'use strict';
if (!window.DD) return;
const DD = window.DD, $ = DD.$, esc = DD.esc, store = DD.store, toast = DD.toast;

const RULES = {
  verb_nebensatz: 'Verbe en fin de subordonnée', verb_hauptsatz: 'Verbe en 2e position', inversion: 'Inversion sujet-verbe',
  konjunktiv2: 'Subjonctif II', konjunktiv1: 'Subjonctif I (discours rapporté)', passiv: 'Passif',
  partizip: 'Participes (attribut, présent)', relativsatz: 'Propositions relatives', adjektiv: 'Déclinaison des adjectifs',
  artikel_genus: 'Article et genre', kasus: 'Cas (Akkusativ, Dativ, Genitiv)', wechselpraep: 'Prépositions à double cas',
  praep_verb: 'Verbes à préposition', praep_kasus: 'Prépositions et cas', konnektoren: 'Connecteurs (weil, obwohl, deshalb…)',
  infinitiv_zu: 'Infinitif avec zu', nominalisierung: 'Nominalisation', tempus: 'Temps (Perfekt, Präteritum, Plusquamperfekt)',
  trennbar: 'Verbes séparables', reflexiv: 'Verbes pronominaux', negation: 'Négation', pronomen: 'Pronoms',
  mittelfeld: 'Ordre des mots (Mittelfeld)', komparation: 'Comparatif et superlatif', plural: 'Pluriel des noms',
  modalverb: 'Verbes de modalité', rechtschreibung: 'Orthographe', zeichensetzung: 'Ponctuation (virgules)',
  wortwahl: 'Choix du mot', register: 'Registre de langue', autre: 'Autre'
};

/* ---------- Style ---------- */
const css = document.createElement('style');
css.textContent = `
.gr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:6px}
.gr-card{text-align:left;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:14px;cursor:pointer;font:inherit;color:var(--ink)}
.gr-card:hover{border-color:var(--brand)}
.gr-card b{display:block;font:600 1rem/1.3 'Literata',Georgia,serif;margin-bottom:6px}
.gr-card span{color:var(--muted);font-size:.85rem}
.gr-card.weak{border-left-color:var(--hard)}
.gr-sec{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px;margin-top:14px}
.gr-sec h2,.gr-sec h3{margin:0 0 8px;font-size:1.02rem}
.gr-sec + .gr-sec{margin-top:10px}
.gr-ex{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:20px}
.gr-q{font:400 1.25rem/1.6 'Literata',Georgia,serif;overflow-wrap:anywhere}
.gr-opts{display:flex;flex-direction:column;gap:8px;margin-top:16px}
.gr-opt{text-align:left;min-height:48px;padding:10px 14px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.gr-opt:hover{border-color:var(--brand)}
.gr-opt.pick{border-color:var(--brand);background:var(--soft)}
.gr-opt.ok{border-color:var(--good);background:var(--soft);color:var(--good)}
.gr-opt.bad{border-color:var(--bad);color:var(--bad)}
.gr-bank{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.gr-built{min-height:52px;border:1px dashed var(--line);border-radius:8px;padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;margin-top:8px}
.gr-tok{min-height:38px;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.gr-tok:hover{border-color:var(--brand)}
.gr-fb{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
.gr-fb.ok{color:var(--good)} .gr-fb.bad{color:var(--bad)}
.gr-fb p{color:var(--ink);margin:6px 0 0;font-weight:400}
.gr-score{font:600 2rem 'Literata',Georgia,serif;color:var(--brand)}
details.gr-imp{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px 14px}
details.gr-imp summary{cursor:pointer;font-weight:500;padding:10px 0}
`;
document.head.appendChild(css);

/* ---------- Packs : chargement, validation ---------- */
let packs = {}, loadErrors = [], loading = true, noIndex = false;

function validatePack(raw, fallbackId){
  const errs = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['ce n\u2019est pas un objet JSON valide'] };
  if (raw.format !== 'deutschduo-pack') errs.push('le champ "format" doit valoir "deutschduo-pack"');
  const id = (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : (fallbackId || '');
  if (!id) errs.push('le champ "id" est manquant');
  if (!RULES[raw.rule]) errs.push('le champ "rule" ("' + raw.rule + '") n\u2019est pas une règle reconnue');
  const lesson = raw.lesson || {};
  if (!lesson.title) errs.push('la leçon n\u2019a pas de "title"');
  if (!lesson.summary) errs.push('la leçon n\u2019a pas de "summary"');
  const sections = Array.isArray(lesson.sections) ? lesson.sections.filter(s => s && s.heading && s.body) : [];
  if (!sections.length) errs.push('aucune section valide dans "sections" (il faut "heading" et "body")');
  const examples = Array.isArray(lesson.examples) ? lesson.examples.filter(e => e && e.de && e.fr) : [];
  const pitfalls = Array.isArray(lesson.pitfalls) ? lesson.pitfalls.filter(Boolean).map(String) : [];
  const exRaw = Array.isArray(raw.exercises) ? raw.exercises : [];
  const exercises = [];
  exRaw.forEach(e => {
    if (!e || !e.type) return;
    if (e.type === 'gap'){ if (e.prompt && Array.isArray(e.answers) && e.answers.length) exercises.push({ type: 'gap', prompt: String(e.prompt), answers: e.answers.map(String), explanation: String(e.explanation || '') }); }
    else if (e.type === 'choice'){ if (e.prompt && Array.isArray(e.options) && e.options.length >= 2 && Number.isInteger(e.answer) && e.answer >= 0 && e.answer < e.options.length) exercises.push({ type: 'choice', prompt: String(e.prompt), options: e.options.map(String), answer: e.answer, explanation: String(e.explanation || '') }); }
    else if (e.type === 'order'){ if (e.sentence && String(e.sentence).trim().split(/\s+/).length >= 2) exercises.push({ type: 'order', sentence: String(e.sentence).trim(), explanation: String(e.explanation || '') }); }
    else if (e.type === 'transform'){ if (e.prompt && Array.isArray(e.answers) && e.answers.length) exercises.push({ type: 'transform', prompt: String(e.prompt), answers: e.answers.map(String), explanation: String(e.explanation || '') }); }
  });
  if (!exercises.length) errs.push('aucun exercice valide (vérifiez "type" et les champs requis pour ce type)');
  if (errs.length) return { ok: false, errors: errs };
  return { ok: true, pack: { id, rule: raw.rule,
    lesson: { title: String(lesson.title), level: String(lesson.level || ''), summary: String(lesson.summary),
      sections: sections.map(s => ({ heading: String(s.heading), body: String(s.body) })),
      examples: examples.map(e => ({ de: String(e.de), fr: String(e.fr), note: String(e.note || '') })),
      pitfalls },
    exercises } };
}

function loadImported(){
  const list = store.get('dd_imported_packs', []) || [];
  list.forEach(p => { packs[p.id] = p; });
}
async function loadPacks(){
  loading = true; loadErrors = []; loadImported(); rerenderIfActive();
  try {
    const idxRes = await fetch('packs/index.json', { cache: 'no-store' });
    if (!idxRes.ok) throw new Error('no-index');
    const idx = await idxRes.json();
    const ids = Array.isArray(idx.packs) ? idx.packs : [];
    for (const id of ids){
      try {
        const r = await fetch('packs/' + id + '.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        const data = await r.json();
        if (data && data.format && data.format !== 'deutschduo-pack') continue; // pack d'un autre module (ex. Lesen B2) : ignoré ici
        const v = validatePack(data, id);
        if (v.ok) packs[v.pack.id] = v.pack;
        else loadErrors.push(id + ' : ' + v.errors.join(', '));
      } catch (e) { loadErrors.push(id + ' : fichier introuvable ou illisible dans packs/'); }
    }
  } catch (e) { noIndex = true; }
  loading = false; rerenderIfActive();
}
function rerenderIfActive(){ if (DD.view === 'grammatik') DD.render(); }

function packsByRule(){
  const m = {};
  Object.keys(packs).forEach(id => { const p = packs[id]; (m[p.rule] = m[p.rule] || []).push(p); });
  return m;
}
function weakCounts(){ return store.get('dd_errors', {}) || {}; }

/* ---------- Générateurs par code (aucune requête IA) ---------- */
const NOUNS = [
  ['Entscheidung', 'f'], ['Herausforderung', 'f'], ['Gesellschaft', 'f'], ['Umwelt', 'f'], ['Zukunft', 'f'],
  ['Verantwortung', 'f'], ['Wirtschaft', 'f'], ['Arbeit', 'f'], ['Regierung', 'f'], ['Meinung', 'f'], ['Erfahrung', 'f'],
  ['Vorteil', 'm'], ['Nachteil', 'm'], ['Unterricht', 'm'], ['Bericht', 'm'], ['Konsum', 'm'], ['Klimawandel', 'm'],
  ['Arbeitsmarkt', 'm'], ['Erfolg', 'm'], ['Streit', 'm'], ['Alltag', 'm'], ['Fortschritt', 'm'],
  ['Problem', 'n'], ['Unternehmen', 'n'], ['Ergebnis', 'n'], ['System', 'n'], ['Verhalten', 'n'], ['Gesetz', 'n'],
  ['Interesse', 'n'], ['Ziel', 'n'], ['Risiko', 'n'], ['Argument', 'n']
];
const PREP = [
  ['für', 'akk', 'für'], ['ohne', 'akk', 'ohne'], ['gegen', 'akk', 'gegen'], ['durch', 'akk', 'durch'],
  ['mit', 'dat', 'mit'], ['bei', 'dat', 'bei'], ['nach', 'dat', 'nach'], ['von', 'dat', 'von'], ['aus', 'dat', 'aus'],
  ['wegen', 'gen', 'wegen'], ['während', 'gen', 'während'], ['trotz', 'gen', 'trotz'], ['aufgrund', 'gen', 'aufgrund']
];
const ART = {
  def: { m: { nom: 'der', akk: 'den', dat: 'dem', gen: 'des' }, f: { nom: 'die', akk: 'die', dat: 'der', gen: 'der' }, n: { nom: 'das', akk: 'das', dat: 'dem', gen: 'des' } },
  indef: { m: { nom: 'ein', akk: 'einen', dat: 'einem', gen: 'eines' }, f: { nom: 'eine', akk: 'eine', dat: 'einer', gen: 'einer' }, n: { nom: 'ein', akk: 'ein', dat: 'einem', gen: 'eines' } }
};
const CASE_NAME = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function shuffled(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const ART_POOL = { def: ['der', 'die', 'das', 'den', 'dem', 'des'], indef: ['ein', 'eine', 'einen', 'einem', 'einer', 'eines'] };
function genDeclension(n){
  const out = [];
  for (let k = 0; k < n; k++){
    const [noun, g] = pick(NOUNS), [prep, c] = pick(PREP), kind = Math.random() < 0.5 ? 'def' : 'indef';
    const correct = ART[kind][g][c];
    const distractors = shuffled(ART_POOL[kind].filter(x => x !== correct)).slice(0, 3);
    const options = shuffled([correct].concat(distractors));
    const answer = options.indexOf(correct);
    const genNote = c === 'gen' && (g === 'm' || g === 'n') ? ' Notez aussi le nom : il prend -s ou -es au Genitiv (' + noun + 's / ' + noun + 'es).' : '';
    out.push({ type: 'choice', prompt: 'Complétez : « … ' + prep + ' ___ ' + noun + '. »',
      options, answer,
      explanation: 'La préposition « ' + prep + ' » se construit toujours avec le ' + CASE_NAME[c] + '. Article ' + (kind === 'def' ? 'défini' : 'indéfini') + ', genre ' + (g === 'm' ? 'masculin' : g === 'f' ? 'féminin' : 'neutre') + '.' + genNote });
  }
  return out;
}
const KONNEKT = [
  { a: 'Ich bleibe heute zu Hause', b: 'ich bin erkältet', rel: 'weil', note: 'cause' },
  { a: 'Er hat die Prüfung bestanden', b: 'er kaum gelernt hat', rel: 'obwohl', note: 'concession' },
  { a: 'Die Firma investiert in Solarenergie', b: 'sie will die Umwelt schützen', rel: 'weil', note: 'cause' },
  { a: 'Sie spricht drei Sprachen', b: 'sie im Ausland studiert hat', rel: 'weil', note: 'cause' },
  { a: 'Der Zug hatte Verspätung', b: 'kam ich pünktlich an', rel: 'trotzdem', note: 'concession-invers' },
  { a: 'Es regnet stark', b: 'gehen wir spazieren', rel: 'trotzdem', note: 'concession-invers' },
  { a: 'Die Kosten sind gestiegen', b: 'kaufen viele Kunden weniger', rel: 'deshalb', note: 'consequence-invers' },
  { a: 'Er hat hart trainiert', b: 'hat er den Marathon geschafft', rel: 'deshalb', note: 'consequence-invers' },
  { a: 'Sie lernt jeden Tag Vokabeln', b: 'sie die Prüfung bestehen will', rel: 'damit', note: 'but' },
  { a: 'Die Regierung erhöht die Steuern', b: 'sie mehr Geld für Schulen ausgeben will', rel: 'damit', note: 'but' },
  { a: 'Viele arbeiten von zu Hause', b: 'das spart Zeit und Fahrtkosten', rel: 'weil', note: 'cause' },
  { a: 'Das Projekt wurde verschoben', b: 'es gab technische Probleme', rel: 'weil', note: 'cause' }
];
function genKonnektoren(n){
  const opts = ['weil', 'obwohl', 'deshalb', 'trotzdem', 'damit'];
  const out = [];
  for (let k = 0; k < n; k++){
    const p = pick(KONNEKT);
    const choices = shuffled([p.rel].concat(shuffled(opts.filter(x => x !== p.rel)).slice(0, 3)));
    const answer = choices.indexOf(p.rel);
    const pos = (p.note === 'concession-invers' || p.note === 'consequence-invers') ? 'Verbe en 2e position (inversion)' : 'Verbe rejeté en fin de proposition';
    out.push({ type: 'choice', prompt: 'Quel connecteur convient le mieux ?\n« ' + p.a + ', ___ ' + p.b + '. »',
      options: choices, answer,
      explanation: 'Avec « ' + p.rel + ' » : ' + pos + '. Relisez la phrase entière pour vérifier le sens (cause, concession, conséquence, but).' });
  }
  return out;
}

/* ---------- Comparaison des réponses tapées ---------- */
const norm = s => String(s || '').trim().toLowerCase().replace(/[.,;:!?"„“]/g, '').replace(/\s+/g, ' ');
const fold = s => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
function matches(input, answers){
  const a = norm(input); if (!a) return false;
  return answers.some(ans => { const b = norm(ans); return a === b || fold(a) === fold(b); });
}

/* ---------- État ---------- */
let view = 'hub';       // hub | lesson | drill | done
let curPack = null, curRuleFilter = null;
let queue = [], qi = 0, score = { correct: 0, total: 0 }, exState = null, source = '';
let importMsg = '';

function startDrill(exercises, label, packId){
  queue = shuffled(exercises); qi = 0; score = { correct: 0, total: 0 }; exState = null; source = label;
  curPack = packId || null; view = 'drill'; rerenderIfActive();
}
function currentExercise(){ return queue[qi]; }
function submitAnswer(payload){
  const ex = currentExercise(); if (!ex || exState) return;
  let ok = false;
  if (ex.type === 'choice') ok = payload.i === ex.answer;
  else if (ex.type === 'gap' || ex.type === 'transform') ok = matches(payload.text, ex.answers);
  else if (ex.type === 'order') ok = payload.tokens.join(' ') === (ex._tokens || ex.sentence.match(/\S+/g)).join(' ');
  score.total++; if (ok) score.correct++;
  exState = { ok, payload };
  if (curPack) savePackProgress(curPack, score);
  rerenderIfActive();
}
function nextExercise(){
  qi++; exState = null;
  if (qi >= queue.length){ view = 'done'; if (curPack) savePackProgress(curPack, score, true); }
  rerenderIfActive();
}
function savePackProgress(id, sc, finished){
  const p = store.get('dd_pack_scores', {}) || {};
  const prev = p[id];
  if (!prev || sc.total >= prev.total) p[id] = { correct: sc.correct, total: sc.total, date: Date.now(), finished: !!finished || (prev && prev.finished) };
  store.set('dd_pack_scores', p);
}

/* ---------- Rendu : hub ---------- */
function ruleCard(rid, list){
  const w = (weakCounts()[rid] || {}).n || 0;
  const done = list.some(p => { const s = (store.get('dd_pack_scores', {}) || {})[p.id]; return s && s.finished; });
  return '<button class="gr-card' + (w >= 3 ? ' weak' : '') + '" data-sa="openrule" data-r="' + esc(rid) + '">' +
    '<b>' + esc(RULES[rid] || rid) + '</b>' +
    '<span>' + list.length + ' fiche' + (list.length > 1 ? 's' : '') + (w ? ' · ' + w + ' erreur' + (w > 1 ? 's' : '') : '') + (done ? ' · faite' : '') + '</span></button>';
}
function renderHub(m){
  const byRule = packsByRule();
  const wc = weakCounts();
  const ruleIds = Object.keys(byRule).sort((a, b) => ((wc[b] || {}).n || 0) - ((wc[a] || {}).n || 0) || RULES[a].localeCompare(RULES[b]));
  const weakNoPack = Object.keys(wc).filter(r => (wc[r].n || 0) >= 2 && !byRule[r] && RULES[r]).sort((a, b) => wc[b].n - wc[a].n);

  let h = '<h1>Grammatik</h1>';
  if (loading) h += '<p class="hint">Chargement des fiches…</p>';
  if (noIndex && !loading && !Object.keys(packs).length) h += '<p class="hint">Aucun dossier de fiches trouvé pour l\u2019instant sur cette adresse. Vous pouvez déjà utiliser les entraînements ci-dessous, ou importer un pack manuellement.</p>';
  if (loadErrors.length) h += '<div class="warn">Certaines fiches n\u2019ont pas pu être chargées :<br>' + loadErrors.map(esc).join('<br>') + '</div>';

  h += '<h2 style="margin-top:20px">Entraînement libre (sans quota)</h2><div class="gr-grid">' +
    '<button class="gr-card" data-sa="drill-gen" data-g="dekl"><b>Artikel & Präpositionen</b><span>Déclinaison à volonté</span></button>' +
    '<button class="gr-card" data-sa="drill-gen" data-g="konn"><b>Konnektoren</b><span>Relier deux phrases</span></button></div>';

  if (ruleIds.length){
    h += '<h2 style="margin-top:22px">Vos fiches</h2><div class="gr-grid">' + ruleIds.map(r => ruleCard(r, byRule[r])).join('') + '</div>';
  }
  if (weakNoPack.length){
    h += '<p class="hint" style="margin-top:14px">Points faibles repérés dans Schreiben, sans fiche pour l\u2019instant : ' +
      weakNoPack.map(r => esc(RULES[r])).join(', ') + '.</p>';
  }

  h += '<details class="gr-imp"><summary>Importer un pack manuellement</summary>' +
    '<p class="hint">Collez ici le JSON d\u2019un pack généré (par exemple avec GPT). Il ne sera visible que sur cet appareil, contrairement aux fiches déposées sur GitHub dans packs/.</p>' +
    '<textarea id="gr-imp-text" rows="4" placeholder="Collez le JSON du pack ici"></textarea>' +
    '<div class="row"><button class="btn" data-sa="import">Importer</button></div>' +
    (importMsg ? '<p class="hint" style="margin-top:8px">' + esc(importMsg) + '</p>' : '') +
    '</details>';
  m.innerHTML = h;
}

/* ---------- Rendu : leçon ---------- */
function renderLesson(m){
  const p = curPack, l = p.lesson;
  let h = '<button class="link" data-sa="back">← Grammatik</button><h1>' + esc(l.title) + '</h1>';
  if (l.level) h += '<p class="hint">Niveau ' + esc(l.level) + '</p>';
  h += '<p>' + esc(l.summary) + '</p>';
  l.sections.forEach(s => { h += '<div class="gr-sec"><h3>' + esc(s.heading) + '</h3><p>' + esc(s.body) + '</p></div>'; });
  if (l.examples.length){
    h += '<div class="gr-sec"><h2>Exemples</h2>' + l.examples.map(e =>
      '<p><b>' + esc(e.de) + '</b><br><span class="hint">' + esc(e.fr) + (e.note ? ' · ' + esc(e.note) : '') + '</span></p>').join('') + '</div>';
  }
  if (l.pitfalls.length){
    h += '<div class="gr-sec"><h2>Erreurs fréquentes</h2><ul style="margin:0;padding-left:20px">' + l.pitfalls.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }
  const sc = (store.get('dd_pack_scores', {}) || {})[p.id];
  h += '<div class="row" style="margin-top:18px"><button class="btn primary big" data-sa="start-pack">' + (sc ? 'Refaire les exercices' : 'Commencer les exercices') + '</button></div>';
  if (sc) h += '<p class="hint" style="margin-top:8px">Dernier score : ' + sc.correct + ' / ' + sc.total + '.</p>';
  m.innerHTML = h;
}

/* ---------- Rendu : exercice ---------- */
function gapHtml(ex){
  return '<div class="gr-q">' + esc(ex.prompt).replace(/___/g, '<span class="gap" style="width:6ch"></span>') + '</div>' +
    '<input type="text" id="gr-ans" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin-top:16px" aria-label="Votre réponse">' +
    '<div class="row" style="margin-top:14px"><button class="btn primary" data-sa="check">Vérifier</button></div>';
}
function choiceHtml(ex){
  return '<div class="gr-q">' + esc(ex.prompt).replace(/\n/g, '<br>') + '</div>' +
    '<div class="gr-opts">' + ex.options.map((o, i) => '<button class="gr-opt" data-sa="pick" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>';
}
function orderHtml(ex){
  if (!ex._tokens) ex._tokens = ex.sentence.match(/\S+/g);
  if (!ex._bank){ do { ex._bank = shuffled(ex._tokens); } while (ex._tokens.length > 1 && ex._bank.join(' ') === ex._tokens.join(' ')); ex._builtIdx = []; }
  const builtWords = ex._builtIdx.map(i => ex._bank[i]);
  return '<div class="gr-q">Remettez les mots dans l\u2019ordre :</div>' +
    '<div class="gr-built" id="gr-built">' + (ex._builtIdx.length ? ex._builtIdx.map((bi, pos) => '<button class="gr-tok" data-sa="rm" data-i="' + pos + '">' + esc(ex._bank[bi]) + '</button>').join('') : '<span class="hint">Touchez les mots ci-dessous.</span>') + '</div>' +
    '<div class="gr-bank">' + ex._bank.map((t, i) => ex._builtIdx.includes(i) ? '' : '<button class="gr-tok" data-sa="add" data-i="' + i + '">' + esc(t) + '</button>').join('') + '</div>' +
    '<div class="row" style="margin-top:16px"><button class="btn" data-sa="reset-order">Recommencer</button><button class="btn primary" data-sa="check-order"' + (ex._builtIdx.length === ex._tokens.length ? '' : ' disabled') + '>Vérifier</button></div>';
}
function transformHtml(ex){
  return '<div class="gr-q">' + esc(ex.prompt).replace(/\n/g, '<br>') + '</div>' +
    '<textarea id="gr-ans" rows="2" style="margin-top:16px" lang="de" spellcheck="false" aria-label="Votre réponse"></textarea>' +
    '<div class="row" style="margin-top:14px"><button class="btn primary" data-sa="check">Vérifier</button></div>';
}
function feedbackHtml(ex){
  if (!exState) return '';
  const k = exState.ok ? 'ok' : 'bad';
  let shown = '';
  if (ex.type === 'gap' || ex.type === 'transform') shown = 'Réponse attendue : <b>' + esc(ex.answers[0]) + '</b>';
  else if (ex.type === 'choice') shown = '';
  else if (ex.type === 'order') shown = 'Phrase correcte : <b>' + esc(ex.sentence) + '</b>';
  return '<div class="gr-fb ' + k + '">' + (exState.ok ? 'Correct.' : 'Pas tout à fait.') +
    (shown ? '<p>' + shown + '</p>' : '') + (ex.explanation ? '<p>' + esc(ex.explanation) + '</p>' : '') + '</div>' +
    '<div class="row" style="margin-top:14px"><button class="btn primary big" data-sa="next">' + (qi + 1 >= queue.length ? 'Voir le résultat' : 'Suivant') + '</button></div>';
}
function renderDrill(m){
  const ex = currentExercise();
  if (!ex){ view = 'hub'; return renderHub(m); }
  const pct = Math.round(qi / queue.length * 100);
  let body = ex.type === 'gap' ? gapHtml(ex) : ex.type === 'choice' ? choiceHtml(ex) : ex.type === 'order' ? orderHtml(ex) : transformHtml(ex);
  if (exState && ex.type === 'choice'){
    body = '<div class="gr-q">' + esc(ex.prompt).replace(/\n/g, '<br>') + '</div><div class="gr-opts">' +
      ex.options.map((o, i) => 'gr-opt' + (i === ex.answer ? ' ok' : (i === exState.payload.i ? ' bad' : ''))).map((cls, i) =>
        '<button class="' + cls + '" disabled>' + esc(ex.options[i]) + '</button>').join('') + '</div>';
  }
  m.innerHTML = '<button class="link" data-sa="quit">Arrêter</button>' +
    '<div class="topline" style="margin-top:8px"><span>' + source + ' · ' + (qi + 1) + ' / ' + queue.length + '</span><span>' + score.correct + ' / ' + score.total + '</span></div>' +
    '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
    '<div class="gr-ex">' + body + feedbackHtml(ex) + '</div>';
  const a = $('#gr-ans'); if (a) a.focus();
}
function renderDone(m){
  m.innerHTML = '<h1>Terminé</h1><div class="gr-ex"><p class="gr-score">' + score.correct + ' / ' + score.total + '</p>' +
    '<p class="hint">' + (score.correct === score.total ? 'Sans faute.' : 'Continuez : la répétition est ce qui fixe une règle.') + '</p></div>' +
    '<div class="row" style="margin-top:16px"><button class="btn primary" data-sa="redo">Refaire</button><button class="btn" data-sa="back">Retour à Grammatik</button></div>';
}

/* ---------- Rendu principal ---------- */
function render(box){
  if (DD.pending && DD.pending.rule){
    const rule = DD.pending.rule; DD.pending = null;
    const list = packsByRule()[rule];
    if (list && list.length){ curPack = list[0]; view = 'lesson'; }
    else { curRuleFilter = rule; view = 'hub'; }
  }
  if (view === 'lesson' && curPack) renderLesson(box);
  else if (view === 'drill') renderDrill(box);
  else if (view === 'done') renderDone(box);
  else { view = 'hub'; renderHub(box); }
}

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  if (DD.view !== 'grammatik') return;
  const el = e.target.closest('[data-sa]'); if (!el) return;
  const a = el.dataset.sa;
  if (a === 'openrule'){
    const list = packsByRule()[el.dataset.r];
    if (list && list.length){ curPack = list[0]; view = 'lesson'; DD.render(); window.scrollTo(0, 0); }
  } else if (a === 'back'){ view = 'hub'; curPack = null; DD.render(); window.scrollTo(0, 0); }
  else if (a === 'start-pack') startDrill(curPack.exercises, curPack.lesson.title, curPack.id);
  else if (a === 'drill-gen'){
    const g = el.dataset.g;
    if (g === 'dekl') startDrill(genDeclension(12), 'Artikel & Präpositionen', null);
    else startDrill(genKonnektoren(12), 'Konnektoren', null);
  }
  else if (a === 'quit'){ view = 'hub'; DD.render(); }
  else if (a === 'redo'){ startDrill(queue.map(x => x), source, curPack ? curPack.id : null); }
  else if (a === 'check'){
    const ex = currentExercise(); const v = $('#gr-ans'); if (!v) return;
    submitAnswer(ex.type === 'gap' || ex.type === 'transform' ? { text: v.value } : {});
  }
  else if (a === 'pick'){ if (!exState) submitAnswer({ i: Number(el.dataset.i) }); }
  else if (a === 'add'){
    const ex = currentExercise(); const i = Number(el.dataset.i);
    if (ex._builtIdx.includes(i)) return;
    ex._builtIdx.push(i); DD.render();
  }
  else if (a === 'rm'){
    const ex = currentExercise(); const pos = Number(el.dataset.i);
    ex._builtIdx.splice(pos, 1); DD.render();
  }
  else if (a === 'reset-order'){ const ex = currentExercise(); ex._builtIdx = []; DD.render(); }
  else if (a === 'check-order'){ const ex = currentExercise(); submitAnswer({ tokens: ex._builtIdx.map(i => ex._bank[i]) }); }
  else if (a === 'next') nextExercise();
  else if (a === 'import'){
    const t = $('#gr-imp-text'); if (!t || !t.value.trim()){ importMsg = 'Collez d\u2019abord le texte du pack.'; DD.render(); return; }
    let data; try { data = JSON.parse(t.value); } catch (e) { importMsg = 'Le texte collé n\u2019est pas un JSON valide.'; DD.render(); return; }
    const v = validatePack(data);
    if (!v.ok){ importMsg = 'Pack refusé : ' + v.errors.join(' ; ') + '.'; DD.render(); return; }
    packs[v.pack.id] = v.pack;
    const list = store.get('dd_imported_packs', []) || [];
    const i = list.findIndex(p => p.id === v.pack.id);
    if (i >= 0) list[i] = v.pack; else list.push(v.pack);
    store.set('dd_imported_packs', list);
    importMsg = 'Pack « ' + v.pack.id + ' » importé.'; toast('Pack importé.'); DD.render();
  }
});

DD.register({ id: 'grammatik', label: 'Grammatik', render });
loadPacks();
})();
