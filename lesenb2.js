/* DeutschDuo · module Lesen B2
   Bibliothèque de textes de compréhension B2, questions taggées par compétence,
   explications avec citation du texte, vocabulaire, tableau de compétences,
   reprise espacée des questions ratées. Contenu chargé depuis packs/ (aucun
   appel IA nécessaire pour lire ou répondre). Nécessite index.html (window.DD). */
(function () {
'use strict';
if (!window.DD) return;
const DD = window.DD, $ = DD.$, esc = DD.esc, store = DD.store, toast = DD.toast;

const SKILLS = {
  main_idea: 'Idée principale', detail: 'Détail précis', inference: 'Inférence (implicite)',
  vocab_context: 'Vocabulaire en contexte', paraphrase: 'Paraphrase', opinion: "Opinion de l'auteur",
  connector: 'Connecteur', other: 'Autre'
};
const REVIEW_STEPS = [1, 3, 7, 14]; // jours

/* ---------- Style ---------- */
const css = document.createElement('style');
css.textContent = `
.rb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px}
.rb-card{text-align:left;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:14px;cursor:pointer;font:inherit;color:var(--ink)}
.rb-card:hover{border-color:var(--brand)}
.rb-card b{display:block;font:600 1.02rem/1.3 'Literata',Georgia,serif;margin-bottom:6px}
.rb-card span{color:var(--muted);font-size:.85rem}
.rb-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.rb-sec{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;margin-top:14px}
.rb-sec h2{margin:0 0 10px;font-size:1.05rem}
.rb-bar{height:8px;background:var(--soft);border-radius:4px;overflow:hidden;margin:4px 0 2px}
.rb-bar i{display:block;height:100%;background:var(--brand)}
.rb-skillrow{display:flex;justify-content:space-between;font-size:.88rem;color:var(--muted);margin-top:10px}
.rb-skillrow:first-of-type{margin-top:0}
.rb-text{white-space:pre-wrap;font:400 1.12rem/1.85 'Literata',Georgia,serif}
.rb-v{text-decoration:underline dotted var(--brand);text-decoration-thickness:1px;cursor:pointer}
.rb-vcard{background:var(--soft);border-radius:8px;padding:10px 12px;margin-top:10px;font-size:.95rem}
.rb-q{font:400 1.2rem/1.6 'Literata',Georgia,serif;overflow-wrap:anywhere}
.rb-quote{margin-top:12px;padding:10px 12px;border-left:3px solid var(--brand);background:var(--soft);font-style:italic;font-size:.95rem}
`;
document.head.appendChild(css);

/* ---------- Packs ---------- */
let packs = {}, loadErrors = [], loading = true;
function validatePack(raw, fallbackId){
  const errs = [];
  if (!raw || typeof raw !== 'object' || raw.format !== 'deutschduo-lesen-pack') return { ok: false, errors: ["format attendu : \"deutschduo-lesen-pack\""] };
  const id = (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : (fallbackId || '');
  if (!id) errs.push('"id" manquant');
  if (!raw.title) errs.push('"title" manquant');
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (text.split(/\s+/).length < 40) errs.push('"text" trop court ou manquant');
  const vocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary.filter(v => v && v.word && v.meaning).map(v => ({ word: String(v.word), meaning: String(v.meaning), example: String(v.example || ''), synonyms: Array.isArray(v.synonyms) ? v.synonyms.map(String) : [] })) : [];
  const connectors = Array.isArray(raw.connectors) ? raw.connectors.filter(c => c && c.word).map(c => ({ word: String(c.word), function: String(c.function || '') })) : [];
  const pre = raw.prereading && raw.prereading.question && Array.isArray(raw.prereading.options) && raw.prereading.options.length >= 2
    ? { question: String(raw.prereading.question), options: raw.prereading.options.map(String) } : null;
  const qRaw = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = [];
  qRaw.forEach((q, i) => {
    if (!q || !q.type) return;
    const skill = SKILLS[q.skill] ? q.skill : 'other';
    const quote = (typeof q.quote === 'string' && q.quote.trim() && text.includes(q.quote.trim())) ? q.quote.trim() : '';
    const base = { id: String(q.id || ('q' + i)), skill, explanation: String(q.explanation || ''), tip: String(q.tip || ''), quote };
    if (q.type === 'choice' && q.prompt && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
      questions.push(Object.assign(base, { type: 'choice', prompt: String(q.prompt), options: q.options.map(String), answer: q.answer }));
    else if (q.type === 'gap' && q.prompt && Array.isArray(q.answers) && q.answers.length)
      questions.push(Object.assign(base, { type: 'gap', prompt: String(q.prompt), answers: q.answers.map(String) }));
  });
  if (!questions.length) errs.push('aucune question valide (type "choice" ou "gap" avec les champs requis)');
  if (errs.length) return { ok: false, errors: errs };
  return { ok: true, pack: { id, level: String(raw.level || ''), topic: String(raw.topic || ''), textType: String(raw.textType || ''),
    title: String(raw.title), estMinutes: Number(raw.estMinutes) || Math.max(5, Math.round(text.split(/\s+/).length / 25)),
    prereading: pre, text, vocabulary, connectors, questions } };
}
function loadImported(){ (store.get('dd_imported_read_packs', []) || []).forEach(p => { packs[p.id] = p; }); }
async function loadPacks(){
  loading = true; loadErrors = []; packs = {}; loadImported(); rerenderIfActive();
  try {
    const idxRes = await fetch('packs/index.json', { cache: 'no-store' });
    if (idxRes.ok){
      const idx = await idxRes.json();
      const ids = Array.isArray(idx.packs) ? idx.packs : [];
      for (const id of ids){
        if (packs[id]) continue;
        try {
          const r = await fetch('packs/' + id + '.json', { cache: 'no-store' });
          if (!r.ok) continue;
          const data = await r.json();
          if (data && data.format === 'deutschduo-lesen-pack'){
            const v = validatePack(data, id);
            if (v.ok) packs[v.pack.id] = v.pack; else loadErrors.push(id + ' : ' + v.errors.join(', '));
          }
        } catch (e) { /* pas un pack de lecture, ou fichier illisible : ignoré ici */ }
      }
    }
  } catch (e) { /* pas de dossier packs/ pour l'instant */ }
  loading = false; rerenderIfActive();
}
function rerenderIfActive(){ if (DD.view === 'lesenb2') DD.render(); }

/* ---------- Progression ---------- */
function skillStats(){ return store.get('dd_read_skill', {}) || {}; }
function bumpSkill(skill, ok){
  const s = skillStats(); const e = s[skill] = s[skill] || { correct: 0, total: 0 };
  e.total++; if (ok) e.correct++; store.set('dd_read_skill', s);
}
function readScores(){ return store.get('dd_read_scores', {}) || {}; }
function saveReadScore(id, correct, total){
  const s = readScores(); s[id] = { correct, total, date: Date.now(), finished: true }; store.set('dd_read_scores', s);
}
function missedQueue(){ return store.get('dd_read_missed', []) || []; }
function saveMissed(list){ store.set('dd_read_missed', list); }
function pushMissed(packTitle, q){
  const list = missedQueue();
  const key = (curPack ? curPack.id : '') + '::' + q.id;
  const i = list.findIndex(x => x.key === key);
  const entry = { key, packTitle, q, step: 0, due: Date.now() + REVIEW_STEPS[0] * 86400000 };
  if (i >= 0) list[i] = entry; else list.push(entry);
  saveMissed(list);
}
function resolveMissed(key, ok){
  const list = missedQueue(); const i = list.findIndex(x => x.key === key); if (i < 0) return;
  if (ok){ list.splice(i, 1); } else { const e = list[i]; e.step = Math.min(e.step + 1, REVIEW_STEPS.length - 1); e.due = Date.now() + REVIEW_STEPS[e.step] * 86400000; }
  saveMissed(list);
}
function dueMissed(){ const now = Date.now(); return missedQueue().filter(x => x.due <= now); }

/* ---------- Comparaison texte (gap) ---------- */
const norm = s => String(s || '').trim().toLowerCase().replace(/[.,;:!?"„“]/g, '').replace(/\s+/g, ' ');
const fold = s => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
function matches(input, answers){ const a = norm(input); if (!a) return false; return answers.some(x => { const b = norm(x); return a === b || fold(a) === fold(b); }); }

/* ---------- État ---------- */
let view = 'hub';   // hub | pre | read | quiz | done | review
let curPack = null, preChoice = null;
let queue = [], qi = 0, score = { correct: 0, total: 0 }, exState = null, reviewMode = false;
let openVocab = null, importMsg = '';

function openPack(p){
  curPack = p; preChoice = null; view = p.prereading ? 'pre' : 'read'; DD.render(); window.scrollTo(0, 0);
}
function startQuiz(){
  queue = curPack.questions.slice(); qi = 0; score = { correct: 0, total: 0 }; exState = null; reviewMode = false;
  view = 'quiz'; DD.render(); window.scrollTo(0, 0);
}
function startReview(){
  const due = dueMissed();
  if (!due.length){ toast('Rien à revoir pour le moment.'); return; }
  queue = due.map(x => Object.assign({}, x.q, { _key: x.key })); qi = 0; score = { correct: 0, total: 0 }; exState = null; reviewMode = true; curPack = null;
  view = 'quiz'; DD.render(); window.scrollTo(0, 0);
}
function currentQ(){ return queue[qi]; }
function submit(payload){
  const q = currentQ(); if (!q || exState) return;
  let ok = false;
  if (q.type === 'choice') ok = payload.i === q.answer;
  else ok = matches(payload.text, q.answers);
  score.total++; if (ok) score.correct++;
  exState = { ok, payload };
  if (!reviewMode) bumpSkill(q.skill, ok);
  if (reviewMode) resolveMissed(q._key, ok);
  else if (!ok && curPack) pushMissed(curPack.title, q);
  DD.render();
}
function next(){
  qi++; exState = null;
  if (qi >= queue.length){
    if (!reviewMode && curPack) saveReadScore(curPack.id, score.correct, score.total);
    view = 'done';
  }
  DD.render(); window.scrollTo(0, 0);
}

/* ---------- Rendu : hub ---------- */
function dashboardHtml(){
  const s = skillStats(); const keys = Object.keys(s).filter(k => s[k].total > 0);
  if (!keys.length) return '';
  const rows = keys.sort((a, b) => (s[a].correct / s[a].total) - (s[b].correct / s[b].total)).map(k => {
    const pct = Math.round(s[k].correct / s[k].total * 100);
    return '<div class="rb-skillrow"><span>' + esc(SKILLS[k] || k) + '</span><span>' + pct + '%</span></div><div class="rb-bar"><i style="width:' + pct + '%"></i></div>';
  }).join('');
  const weakest = keys.slice().sort((a, b) => (s[a].correct / s[a].total) - (s[b].correct / s[b].total))[0];
  return '<div class="rb-sec"><h2>Vos compétences</h2>' + rows +
    (weakest ? '<p class="hint" style="margin-top:10px">À travailler en priorité : ' + esc(SKILLS[weakest]) + '.</p>' : '') + '</div>';
}
function renderHub(m){
  let h = '<h1>Lesen B2</h1>';
  if (loading) h += '<p class="hint">Chargement des textes…</p>';
  if (loadErrors.length) h += '<div class="warn">Certains textes n\u2019ont pas pu être chargés :<br>' + loadErrors.map(esc).join('<br>') + '</div>';
  const due = dueMissed();
  if (due.length) h += '<div class="row"><button class="btn primary big" data-sa="review">Reprendre vos erreurs (' + due.length + ')</button></div>';
  h += dashboardHtml();
  const ids = Object.keys(packs);
  const sc = readScores();
  if (!ids.length && !loading){
    h += '<p class="hint" style="margin-top:14px">Aucun texte pour l\u2019instant. Générez-en un avec GPT au format attendu, ou importez le pack de démonstration ci-dessous.</p>';
  } else {
    h += '<h2 style="margin-top:20px">Textes disponibles</h2><div class="rb-grid">' + ids.map(id => {
      const p = packs[id], s = sc[id];
      return '<button class="rb-card" data-sa="open" data-id="' + esc(id) + '"><b>' + esc(p.title) + '</b>' +
        '<span>' + [p.level, p.topic, p.textType].filter(Boolean).join(' · ') + (p.estMinutes ? ' · ' + p.estMinutes + ' min' : '') + '</span>' +
        (s ? '<div class="rb-tags"><span class="chip">Fait · ' + s.correct + '/' + s.total + '</span></div>' : '') + '</button>';
    }).join('') + '</div>';
  }
  h += '<details class="gr-imp" style="margin-top:20px"><summary>Importer un texte manuellement</summary>' +
    '<p class="hint">Collez le JSON d\u2019un pack de lecture. Il ne sera visible que sur cet appareil.</p>' +
    '<textarea id="rb-imp-text" rows="4" placeholder="Collez le JSON ici"></textarea>' +
    '<div class="row"><button class="btn" data-sa="import">Importer</button></div>' +
    (importMsg ? '<p class="hint" style="margin-top:8px">' + esc(importMsg) + '</p>' : '') + '</details>';
  m.innerHTML = h;
}

/* ---------- Rendu : avant lecture ---------- */
function renderPre(m){
  const p = curPack.prereading;
  m.innerHTML = '<button class="link" data-sa="back">← Lesen B2</button><h1>' + esc(curPack.title) + '</h1>' +
    '<div class="rb-sec"><h2>Avant de lire</h2><p>' + esc(p.question) + '</p><div class="gr-opts">' +
    p.options.map((o, i) => '<button class="gr-opt' + (preChoice === i ? ' pick' : '') + '" data-sa="pre" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>' +
    '<div class="row" style="margin-top:16px"><button class="btn primary" data-sa="toread"' + (preChoice == null ? ' disabled' : '') + '>Lire le texte</button></div></div>';
}

/* ---------- Rendu : lecture ---------- */
function highlightVocab(text, vocab){
  if (!vocab.length) return esc(text);
  let out = esc(text);
  vocab.forEach((v, i) => {
    const stem = v.word.replace(/^(der|die|das)\s+/, '');
    const re = new RegExp('(' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'gi');
    out = out.replace(re, m => '<span class="rb-v" data-sa="vocab" data-i="' + i + '">' + m + '</span>');
  });
  return out;
}
function renderRead(m){
  const p = curPack;
  let h = '<button class="link" data-sa="back">← Lesen B2</button><h1>' + esc(p.title) + '</h1>' +
    '<p class="hint">' + [p.level, p.topic, p.textType].filter(Boolean).join(' · ') + '</p>' +
    '<p class="hint">Les mots soulignés ont une fiche de vocabulaire : touchez-les pour la voir.</p>' +
    '<div class="rb-sec"><div class="rb-text">' + highlightVocab(p.text, p.vocabulary) + '</div></div>';
  if (openVocab != null && p.vocabulary[openVocab]){
    const v = p.vocabulary[openVocab];
    h += '<div class="rb-vcard"><b>' + esc(v.word) + '</b> — ' + esc(v.meaning) +
      (v.example ? '<div class="hint" style="margin-top:4px">' + esc(v.example) + '</div>' : '') +
      (v.synonyms.length ? '<div class="hint">Synonymes : ' + v.synonyms.map(esc).join(', ') + '</div>' : '') + '</div>';
  }
  if (p.connectors.length){
    h += '<div class="rb-sec"><h2>Connecteurs à repérer</h2>' + p.connectors.map(c => '<span class="chip" style="margin:0 6px 6px 0;display:inline-block">' + esc(c.word) + (c.function ? ' · ' + esc(c.function) : '') + '</span>').join('') + '</div>';
  }
  h += '<div class="row" style="margin-top:18px"><button class="btn primary big" data-sa="toquiz">Passer aux questions (' + p.questions.length + ')</button></div>';
  m.innerHTML = h;
}

/* ---------- Rendu : quiz ---------- */
function feedback(q){
  if (!exState) return '';
  const k = exState.ok ? 'ok' : 'bad';
  let h = '<div class="gr-fb ' + k + '">' + (exState.ok ? 'Correct.' : 'Pas tout à fait.') + '</div>';
  if (q.type === 'gap') h += '<p class="hint">Réponse attendue : <b>' + esc(q.answers[0]) + '</b></p>';
  if (q.quote) h += '<div class="rb-quote">« ' + esc(q.quote) + ' »</div>';
  if (q.explanation) h += '<p style="margin-top:10px">' + esc(q.explanation) + '</p>';
  if (q.tip) h += '<p class="hint" style="margin-top:6px">' + esc(q.tip) + '</p>';
  h += '<div class="row" style="margin-top:14px"><button class="btn primary big" data-sa="next">' + (qi + 1 >= queue.length ? 'Voir le résultat' : 'Suivant') + '</button></div>';
  return h;
}
function renderQuiz(m){
  const q = currentQ(); if (!q){ view = 'hub'; return renderHub(m); }
  const pct = Math.round(qi / queue.length * 100);
  let body = '<span class="chip">' + esc(SKILLS[q.skill] || q.skill) + '</span><div class="gr-q" style="margin-top:10px">' + esc(q.prompt).replace(/\n/g, '<br>') + '</div>';
  if (q.type === 'choice'){
    if (!exState) body += '<div class="gr-opts">' + q.options.map((o, i) => '<button class="gr-opt" data-sa="pick" data-i="' + i + '">' + esc(o) + '</button>').join('') + '</div>';
    else body += '<div class="gr-opts">' + q.options.map((o, i) => '<button class="gr-opt' + (i === q.answer ? ' ok' : (i === exState.payload.i ? ' bad' : '')) + '" disabled>' + esc(o) + '</button>').join('') + '</div>';
  } else {
    body += '<input type="text" id="rb-ans" autocomplete="off" style="margin-top:14px" aria-label="Votre réponse"' + (exState ? ' disabled' : '') + '>' +
      (exState ? '' : '<div class="row" style="margin-top:14px"><button class="btn primary" data-sa="check">Vérifier</button></div>');
  }
  m.innerHTML = '<button class="link" data-sa="quit">Arrêter</button>' +
    '<div class="topline" style="margin-top:8px"><span>' + (reviewMode ? 'Révision' : curPack.title) + ' · ' + (qi + 1) + ' / ' + queue.length + '</span><span>' + score.correct + ' / ' + score.total + '</span></div>' +
    '<div class="progress"><i style="width:' + pct + '%"></i></div><div class="gr-ex">' + body + feedback(q) + '</div>';
  const a = $('#rb-ans'); if (a) a.focus();
}
function renderDone(m){
  m.innerHTML = '<h1>Terminé</h1><div class="gr-ex"><p class="gr-score">' + score.correct + ' / ' + score.total + '</p>' +
    (curPack && curPack.vocabulary.length ? '<div class="row" style="margin-top:14px"><button class="btn" data-sa="addvoc">Ajouter le vocabulaire au carnet (' + curPack.vocabulary.length + ')</button></div>' : '') + '</div>' +
    '<div class="row" style="margin-top:16px"><button class="btn" data-sa="back">Retour à Lesen B2</button></div>';
}

/* ---------- Rendu principal ---------- */
function render(box){
  if (view === 'pre' && curPack) renderPre(box);
  else if (view === 'read' && curPack) renderRead(box);
  else if (view === 'quiz') renderQuiz(box);
  else if (view === 'done') renderDone(box);
  else { view = 'hub'; renderHub(box); }
}

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  if (DD.view !== 'lesenb2') return;
  const el = e.target.closest('[data-sa]'); if (!el) return;
  const a = el.dataset.sa;
  if (a === 'open'){ const p = packs[el.dataset.id]; if (p) openPack(p); }
  else if (a === 'back'){ view = 'hub'; curPack = null; openVocab = null; DD.render(); window.scrollTo(0, 0); }
  else if (a === 'pre'){ preChoice = Number(el.dataset.i); DD.render(); }
  else if (a === 'toread'){ view = 'read'; DD.render(); window.scrollTo(0, 0); }
  else if (a === 'toquiz') startQuiz();
  else if (a === 'vocab'){ openVocab = openVocab === Number(el.dataset.i) ? null : Number(el.dataset.i); DD.render(); }
  else if (a === 'pick'){ submit({ i: Number(el.dataset.i) }); }
  else if (a === 'check'){ const v = $('#rb-ans'); if (v) submit({ text: v.value }); }
  else if (a === 'next') next();
  else if (a === 'quit'){ view = 'hub'; curPack = null; DD.render(); }
  else if (a === 'review') startReview();
  else if (a === 'addvoc' && curPack){
    let n = 0; curPack.vocabulary.forEach(v => { if (DD.addWord({ de: v.word, fr: v.meaning, ctx: v.example }) === 'added') n++; });
    toast(n + ' mots ajoutés au carnet.');
  }
  else if (a === 'import'){
    const t = $('#rb-imp-text'); if (!t || !t.value.trim()){ importMsg = 'Collez d\u2019abord le JSON.'; DD.render(); return; }
    let data; try { data = JSON.parse(t.value); } catch (e) { importMsg = 'JSON illisible.'; DD.render(); return; }
    const v = validatePack(data);
    if (!v.ok){ importMsg = 'Pack refusé : ' + v.errors.join(' ; ') + '.'; DD.render(); return; }
    packs[v.pack.id] = v.pack;
    const list = store.get('dd_imported_read_packs', []) || [];
    const i = list.findIndex(p => p.id === v.pack.id); if (i >= 0) list[i] = v.pack; else list.push(v.pack);
    store.set('dd_imported_read_packs', list);
    importMsg = 'Texte « ' + v.pack.id + ' » importé.'; toast('Texte importé.'); DD.render();
  }
});

DD.register({ id: 'lesenb2', label: 'Lesen B2', render });
loadPacks();
})();
