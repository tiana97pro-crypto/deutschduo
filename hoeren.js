/* DeutschDuo · module Hören
   Écoute par synthèse vocale du navigateur (aucun fichier audio, aucun quota),
   transcription cachée par défaut, questions de compréhension taggées par
   compétence, vocabulaire, tableau de compétences, reprise des erreurs.
   Contenu chargé depuis packs/ (format "deutschduo-hoeren-pack").
   Nécessite index.html (objet window.DD). */
(function () {
'use strict';
if (!window.DD) return;
const DD = window.DD, $ = DD.$, esc = DD.esc, store = DD.store, toast = DD.toast;

const SKILLS = {
  main_idea: 'Idée principale', detail: 'Détail précis', inference: 'Inférence (implicite)',
  vocab_context: 'Vocabulaire en contexte', paraphrase: 'Paraphrase', opinion: "Opinion de l'auteur",
  connector: 'Connecteur', other: 'Autre'
};
const REVIEW_STEPS = [1, 3, 7, 14];
const SPEEDS = [{ v: 0.7, l: 'Lent' }, { v: 1, l: 'Normal' }, { v: 1.3, l: 'Rapide' }];

/* ---------- Style ---------- */
const css = document.createElement('style');
css.textContent = `
.hr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px}
.hr-card{text-align:left;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:10px;padding:14px;cursor:pointer;font:inherit;color:var(--ink)}
.hr-card:hover{border-color:var(--brand)}
.hr-card b{display:block;font:600 1.02rem/1.3 'Literata',Georgia,serif;margin-bottom:6px}
.hr-card span{color:var(--muted);font-size:.85rem}
.hr-sec{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px;margin-top:14px}
.hr-sec h2{margin:0 0 10px;font-size:1.05rem}
.hr-play{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hr-speed{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.hr-speed button{padding:8px 12px;border:0;background:var(--surface);color:var(--ink);font:inherit;font-size:.85rem;cursor:pointer}
.hr-speed button.on{background:var(--brand);color:var(--brand-ink)}
.hr-sent{display:inline}
.hr-sent.cur{background:var(--soft);border-radius:3px;box-shadow:0 2px 0 var(--brand)}
.hr-text{white-space:pre-wrap;font:400 1.12rem/1.85 'Literata',Georgia,serif}
.hr-vcard{background:var(--soft);border-radius:8px;padding:10px 12px;margin-top:10px;font-size:.95rem}
.hr-quote{margin-top:12px;padding:10px 12px;border-left:3px solid var(--brand);background:var(--soft);font-style:italic;font-size:.95rem}
`;
document.head.appendChild(css);

/* ---------- Voix allemande ---------- */
let deVoice = null, voicesReady = false;
function pickVoice(){
  const list = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  deVoice = list.find(v => v.lang && v.lang.toLowerCase().startsWith('de')) || null;
  voicesReady = list.length > 0;
}
if (window.speechSynthesis){
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', () => { pickVoice(); rerenderIfActive(); });
}

/* ---------- Packs ---------- */
let packs = {}, loadErrors = [], loading = true;
function validatePack(raw, fallbackId){
  const errs = [];
  if (!raw || typeof raw !== 'object' || raw.format !== 'deutschduo-hoeren-pack') return { ok: false, errors: ['format attendu : "deutschduo-hoeren-pack"'] };
  const id = (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : (fallbackId || '');
  if (!id) errs.push('"id" manquant');
  if (!raw.title) errs.push('"title" manquant');
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (text.split(/\s+/).length < 25) errs.push('"text" (transcription) trop court ou manquant');
  const vocabulary = Array.isArray(raw.vocabulary) ? raw.vocabulary.filter(v => v && v.word && v.meaning).map(v => ({ word: String(v.word), meaning: String(v.meaning), example: String(v.example || ''), synonyms: Array.isArray(v.synonyms) ? v.synonyms.map(String) : [] })) : [];
  const connectors = Array.isArray(raw.connectors) ? raw.connectors.filter(c => c && c.word).map(c => ({ word: String(c.word), function: String(c.function || '') })) : [];
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
  return { ok: true, pack: { id, level: String(raw.level || ''), topic: String(raw.topic || ''),
    title: String(raw.title), estMinutes: Number(raw.estMinutes) || Math.max(3, Math.round(text.split(/\s+/).length / 25)),
    text, vocabulary, connectors, questions } };
}
function loadImported(){ (store.get('dd_imported_hear_packs', []) || []).forEach(p => { packs[p.id] = p; }); }
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
          if (data && data.format === 'deutschduo-hoeren-pack'){
            const v = validatePack(data, id);
            if (v.ok) packs[v.pack.id] = v.pack; else loadErrors.push(id + ' : ' + v.errors.join(', '));
          }
        } catch (e) { /* pas un pack Hören, ou fichier illisible : ignoré ici */ }
      }
    }
  } catch (e) { /* pas de dossier packs/ pour l'instant */ }
  loading = false; rerenderIfActive();
}
function rerenderIfActive(){ if (DD.view === 'hoeren') DD.render(); }

/* ---------- Progression ---------- */
function skillStats(){ return store.get('dd_hear_skill', {}) || {}; }
function bumpSkill(skill, ok){
  const s = skillStats(); const e = s[skill] = s[skill] || { correct: 0, total: 0 };
  e.total++; if (ok) e.correct++; store.set('dd_hear_skill', s);
}
function hearScores(){ return store.get('dd_hear_scores', {}) || {}; }
function saveHearScore(id, correct, total){
  const s = hearScores(); s[id] = { correct, total, date: Date.now(), finished: true }; store.set('dd_hear_scores', s);
}
function missedQueue(){ return store.get('dd_hear_missed', []) || []; }
function saveMissed(list){ store.set('dd_hear_missed', list); }
function pushMissed(q){
  const list = missedQueue();
  const key = (curPack ? curPack.id : '') + '::' + q.id;
  const i = list.findIndex(x => x.key === key);
  const entry = { key, q, step: 0, due: Date.now() + REVIEW_STEPS[0] * 86400000 };
  if (i >= 0) list[i] = entry; else list.push(entry);
  saveMissed(list);
}
function resolveMissed(key, ok){
  const list = missedQueue(); const i = list.findIndex(x => x.key === key); if (i < 0) return;
  if (ok) list.splice(i, 1);
  else { const e = list[i]; e.step = Math.min(e.step + 1, REVIEW_STEPS.length - 1); e.due = Date.now() + REVIEW_STEPS[e.step] * 86400000; }
  saveMissed(list);
}
function dueMissed(){ const now = Date.now(); return missedQueue().filter(x => x.due <= now); }

/* ---------- Comparaison texte (gap) ---------- */
const norm = s => String(s || '').trim().toLowerCase().replace(/[.,;:!?"„“]/g, '').replace(/\s+/g, ' ');
const fold = s => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
function matches(input, answers){ const a = norm(input); if (!a) return false; return answers.some(x => { const b = norm(x); return a === b || fold(a) === fold(b); }); }
function splitSentences(t){ return t.split(/(?<=[.!?…])\s+(?=[A-ZÄÖÜ0-9„"«])/).map(s => s.trim()).filter(Boolean); }

/* ---------- Lecture audio ---------- */
let playing = false, curSentence = -1, speed = 1, playToken = 0;
function stopAudio(){ playToken++; if (window.speechSynthesis) speechSynthesis.cancel(); playing = false; curSentence = -1; rerenderIfActive(); }
function speakOne(i, sentences, token){
  if (token !== playToken) return; // une lecture plus récente a pris le relais
  if (!playing || i >= sentences.length){ playing = false; curSentence = -1; rerenderIfActive(); return; }
  curSentence = i; rerenderIfActive();
  const u = new SpeechSynthesisUtterance(sentences[i]);
  u.lang = 'de-DE'; u.rate = speed; if (deVoice) u.voice = deVoice;
  u.onend = () => { if (token === playToken && playing) speakOne(i + 1, sentences, token); };
  u.onerror = () => { if (token === playToken){ playing = false; curSentence = -1; rerenderIfActive(); } };
  speechSynthesis.speak(u);
}
function startFrom(i){
  if (!window.speechSynthesis){ toast('La lecture audio n\u2019est pas disponible sur ce navigateur.'); return; }
  playToken++; const token = playToken; playing = true;
  speechSynthesis.cancel();
  // Sur Android (Chrome, Brave...), relancer la synthèse juste après cancel() est ignoré
  // ou garde l'ancienne vitesse si on ne laisse pas un court délai s'écouler.
  setTimeout(() => { speakOne(i, splitSentences(curPack.text), token); }, 80);
}
function playAll(){ startFrom(0); }
function playFrom(i){ startFrom(i); }

/* ---------- État ---------- */
let view = 'hub';
let curPack = null;
let showTranscript = false, openVocab = null, importMsg = '';
let queue = [], qi = 0, score = { correct: 0, total: 0 }, exState = null, reviewMode = false;

function openPack(p){
  curPack = p; showTranscript = false; openVocab = null; view = 'listen'; stopAudio();
  DD.render(); window.scrollTo(0, 0);
}
function startQuiz(){
  stopAudio();
  queue = curPack.questions.slice(); qi = 0; score = { correct: 0, total: 0 }; exState = null; reviewMode = false;
  view = 'quiz'; DD.render(); window.scrollTo(0, 0);
}
function startReview(){
  const due = dueMissed();
  if (!due.length){ toast('Rien à revoir pour le moment.'); return; }
  stopAudio();
  queue = due.map(x => Object.assign({}, x.q, { _key: x.key })); qi = 0; score = { correct: 0, total: 0 }; exState = null; reviewMode = true; curPack = null;
  view = 'quiz'; DD.render(); window.scrollTo(0, 0);
}
function currentQ(){ return queue[qi]; }
function submit(payload){
  const q = currentQ(); if (!q || exState) return;
  let ok = false;
  if (q.type === 'choice') ok = payload.i === q.answer; else ok = matches(payload.text, q.answers);
  score.total++; if (ok) score.correct++;
  exState = { ok, payload };
  if (!reviewMode) bumpSkill(q.skill, ok);
  if (reviewMode) resolveMissed(q._key, ok);
  else if (!ok && curPack) pushMissed(q);
  DD.render();
}
function next(){
  qi++; exState = null;
  if (qi >= queue.length){
    if (!reviewMode && curPack) saveHearScore(curPack.id, score.correct, score.total);
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
  return '<div class="hr-sec"><h2>Vos compétences à l\u2019écoute</h2>' + rows +
    (weakest ? '<p class="hint" style="margin-top:10px">À travailler en priorité : ' + esc(SKILLS[weakest]) + '.</p>' : '') + '</div>';
}
function renderHub(m){
  let h = '<h1>Hören</h1><p class="hint">Écoute par synthèse vocale du navigateur : gratuit, sans limite, mais une voix automatique — pas une vraie voix humaine.</p>';
  if (!voicesReady) h += '<p class="hint">Chargement des voix disponibles…</p>';
  else if (!deVoice) h += '<div class="warn">Aucune voix allemande trouvée sur cet appareil. L\u2019écoute utilisera la voix par défaut, avec un accent approximatif. Vérifiez les voix installées dans les réglages de votre appareil ou navigateur si besoin.</div>';
  if (loading) h += '<p class="hint">Chargement des contenus…</p>';
  if (loadErrors.length) h += '<div class="warn">Certains contenus n\u2019ont pas pu être chargés :<br>' + loadErrors.map(esc).join('<br>') + '</div>';
  const due = dueMissed();
  if (due.length) h += '<div class="row"><button class="btn primary big" data-sa="review">Reprendre vos erreurs (' + due.length + ')</button></div>';
  h += dashboardHtml();
  const ids = Object.keys(packs); const sc = hearScores();
  if (!ids.length && !loading){
    h += '<p class="hint" style="margin-top:14px">Aucun contenu pour l\u2019instant. Générez-en un avec GPT au format attendu, ou importez le pack de démonstration ci-dessous.</p>';
  } else {
    h += '<h2 style="margin-top:20px">Contenus disponibles</h2><div class="hr-grid">' + ids.map(id => {
      const p = packs[id], s = sc[id];
      return '<button class="hr-card" data-sa="open" data-id="' + esc(id) + '"><b>' + esc(p.title) + '</b>' +
        '<span>' + [p.level, p.topic].filter(Boolean).join(' · ') + (p.estMinutes ? ' · ' + p.estMinutes + ' min' : '') + '</span>' +
        (s ? '<div class="rb-tags"><span class="chip">Fait · ' + s.correct + '/' + s.total + '</span></div>' : '') + '</button>';
    }).join('') + '</div>';
  }
  h += '<details class="gr-imp" style="margin-top:20px"><summary>Importer un contenu manuellement</summary>' +
    '<p class="hint">Collez le JSON d\u2019un pack Hören. Il ne sera visible que sur cet appareil.</p>' +
    '<textarea id="hr-imp-text" rows="4" placeholder="Collez le JSON ici"></textarea>' +
    '<div class="row"><button class="btn" data-sa="import">Importer</button></div>' +
    (importMsg ? '<p class="hint" style="margin-top:8px">' + esc(importMsg) + '</p>' : '') + '</details>';
  m.innerHTML = h;
}

/* ---------- Rendu : écoute ---------- */
function highlightVocab(text, vocab){
  if (!vocab.length) return esc(text);
  let out = esc(text);
  vocab.forEach((v, i) => {
    const stem = v.word.replace(/^(der|die|das)\s+/, '');
    const re = new RegExp('(' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'gi');
    out = out.replace(re, mm => '<span class="rb-v" data-sa="vocab" data-i="' + i + '">' + mm + '</span>');
  });
  return out;
}
function transcriptHtml(){
  const sentences = splitSentences(curPack.text);
  return sentences.map((s, i) => '<span class="hr-sent' + (i === curSentence ? ' cur' : '') + '" data-sa="playfrom" data-i="' + i + '">' + highlightVocab(s, curPack.vocabulary) + '</span> ').join('');
}
function renderListen(m){
  const p = curPack, n = splitSentences(p.text).length;
  let h = '<button class="link" data-sa="back">← Hören</button><h1>' + esc(p.title) + '</h1>' +
    '<p class="hint">' + [p.level, p.topic].filter(Boolean).join(' · ') + '</p>' +
    '<div class="hr-sec"><div class="hr-play">' +
    '<button class="btn primary" data-sa="' + (playing ? 'stop' : 'play') + '">' + (playing ? '⏸ Arrêter' : '▶ Écouter') + '</button>' +
    '<div class="hr-speed">' + SPEEDS.map(s => '<button class="' + (speed === s.v ? 'on' : '') + '" data-sa="speed" data-v="' + s.v + '">' + s.l + '</button>').join('') + '</div>' +
    (playing ? '<span class="hint">Phrase ' + (curSentence + 1) + ' / ' + n + '</span>' : '') +
    '</div>' +
    '<p class="hint" style="margin-top:12px">Écoutez avant de lire. Touchez une phrase de la transcription pour la réécouter seule.</p>' +
    '<div class="row" style="margin-top:6px"><button class="btn" data-sa="toggle-tr">' + (showTranscript ? 'Cacher la transcription' : 'Afficher la transcription') + '</button></div>' +
    (showTranscript ? '<div class="hr-text" style="margin-top:14px">' + transcriptHtml() + '</div>' : '') +
    '</div>';
  if (openVocab != null && p.vocabulary[openVocab]){
    const v = p.vocabulary[openVocab];
    h += '<div class="hr-vcard"><b>' + esc(v.word) + '</b> — ' + esc(v.meaning) +
      (v.example ? '<div class="hint" style="margin-top:4px">' + esc(v.example) + '</div>' : '') +
      (v.synonyms.length ? '<div class="hint">Synonymes : ' + v.synonyms.map(esc).join(', ') + '</div>' : '') + '</div>';
  }
  if (p.connectors.length){
    h += '<div class="hr-sec"><h2>Connecteurs à repérer</h2>' + p.connectors.map(c => '<span class="chip" style="margin:0 6px 6px 0;display:inline-block">' + esc(c.word) + (c.function ? ' · ' + esc(c.function) : '') + '</span>').join('') + '</div>';
  }
  h += '<div class="row" style="margin-top:18px"><button class="btn primary big" data-sa="toquiz">Passer aux questions (' + p.questions.length + ')</button></div>';
  m.innerHTML = h;
}

/* ---------- Rendu : quiz (identique à Lesen B2) ---------- */
function feedback(q){
  if (!exState) return '';
  const k = exState.ok ? 'ok' : 'bad';
  let h = '<div class="gr-fb ' + k + '">' + (exState.ok ? 'Correct.' : 'Pas tout à fait.') + '</div>';
  if (q.type === 'gap') h += '<p class="hint">Réponse attendue : <b>' + esc(q.answers[0]) + '</b></p>';
  if (q.quote) h += '<div class="hr-quote">« ' + esc(q.quote) + ' »</div>';
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
    body += '<input type="text" id="hr-ans" autocomplete="off" style="margin-top:14px" aria-label="Votre réponse"' + (exState ? ' disabled' : '') + '>' +
      (exState ? '' : '<div class="row" style="margin-top:14px"><button class="btn primary" data-sa="check">Vérifier</button></div>');
  }
  m.innerHTML = '<button class="link" data-sa="quit">Arrêter</button>' +
    '<div class="topline" style="margin-top:8px"><span>' + (reviewMode ? 'Révision' : curPack.title) + ' · ' + (qi + 1) + ' / ' + queue.length + '</span><span>' + score.correct + ' / ' + score.total + '</span></div>' +
    '<div class="progress"><i style="width:' + pct + '%"></i></div><div class="gr-ex">' + body + feedback(q) + '</div>';
  const a = $('#hr-ans'); if (a) a.focus();
}
function renderDone(m){
  m.innerHTML = '<h1>Terminé</h1><div class="gr-ex"><p class="gr-score">' + score.correct + ' / ' + score.total + '</p>' +
    (curPack && curPack.vocabulary.length ? '<div class="row" style="margin-top:14px"><button class="btn" data-sa="addvoc">Ajouter le vocabulaire au carnet (' + curPack.vocabulary.length + ')</button></div>' : '') + '</div>' +
    '<div class="row" style="margin-top:16px"><button class="btn" data-sa="back">Retour à Hören</button></div>';
}

/* ---------- Rendu principal ---------- */
function render(box){
  if (view === 'listen' && curPack) renderListen(box);
  else if (view === 'quiz') renderQuiz(box);
  else if (view === 'done') renderDone(box);
  else { view = 'hub'; renderHub(box); }
}

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  if (DD.view !== 'hoeren') return;
  const el = e.target.closest('[data-sa]'); if (!el) return;
  const a = el.dataset.sa;
  if (a === 'open'){ const p = packs[el.dataset.id]; if (p) openPack(p); }
  else if (a === 'back'){ stopAudio(); view = 'hub'; curPack = null; DD.render(); window.scrollTo(0, 0); }
  else if (a === 'play') playAll();
  else if (a === 'stop') stopAudio();
  else if (a === 'playfrom') playFrom(Number(el.dataset.i));
  else if (a === 'speed'){ speed = Number(el.dataset.v); if (playing) playFrom(curSentence < 0 ? 0 : curSentence); else DD.render(); }
  else if (a === 'toggle-tr'){ showTranscript = !showTranscript; DD.render(); }
  else if (a === 'vocab'){ openVocab = openVocab === Number(el.dataset.i) ? null : Number(el.dataset.i); DD.render(); }
  else if (a === 'toquiz') startQuiz();
  else if (a === 'pick'){ submit({ i: Number(el.dataset.i) }); }
  else if (a === 'check'){ const v = $('#hr-ans'); if (v) submit({ text: v.value }); }
  else if (a === 'next') next();
  else if (a === 'quit'){ stopAudio(); view = 'hub'; curPack = null; DD.render(); }
  else if (a === 'review') startReview();
  else if (a === 'addvoc' && curPack){
    let n = 0; curPack.vocabulary.forEach(v => { if (DD.addWord({ de: v.word, fr: v.meaning, ctx: v.example }) === 'added') n++; });
    toast(n + ' mots ajoutés au carnet.');
  }
  else if (a === 'import'){
    const t = $('#hr-imp-text'); if (!t || !t.value.trim()){ importMsg = 'Collez d\u2019abord le JSON.'; DD.render(); return; }
    let data; try { data = JSON.parse(t.value); } catch (e) { importMsg = 'JSON illisible.'; DD.render(); return; }
    const v = validatePack(data);
    if (!v.ok){ importMsg = 'Pack refusé : ' + v.errors.join(' ; ') + '.'; DD.render(); return; }
    packs[v.pack.id] = v.pack;
    const list = store.get('dd_imported_hear_packs', []) || [];
    const i = list.findIndex(p => p.id === v.pack.id); if (i >= 0) list[i] = v.pack; else list.push(v.pack);
    store.set('dd_imported_hear_packs', list);
    importMsg = 'Contenu « ' + v.pack.id + ' » importé.'; toast('Contenu importé.'); DD.render();
  }
});

DD.register({ id: 'hoeren', label: 'Hören', render });
loadPacks();
})();
