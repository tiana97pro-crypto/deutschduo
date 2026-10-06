/* DeutschDuo · module Redemittel
 * Répertoire d'expressions de discours, chargé depuis packs/index.json
 * (packs dont "format" vaut "deutschduo-redemittel").
 * Dépend de window.DD (index.html) ; window.DD_RULES (rules.js) est facultatif.
 */
(function(){
'use strict';
const DD = window.DD;
if (!DD || !DD.register) return;
const esc = DD.esc, store = DD.store, toast = DD.toast, $ = DD.$;

/* ---------- Libellés ---------- */
const THEMES = {
  opinion: 'Donner son opinion',
  accord_desaccord: 'Accord et désaccord',
  nuancer: 'Nuancer',
  concession: 'Concession',
  cause: 'Cause',
  consequence: 'Conséquence',
  but_condition: 'But et condition',
  comparaison: 'Comparer',
  exemple: 'Donner un exemple',
  structurer: 'Structurer son discours',
  conclusion: 'Conclure',
  hypothese: 'Hypothèse et probabilité',
  lettre_ouverture_cloture: 'Ouverture et clôture de lettre'
};
const TEXTES = {
  kommentar: 'Commentaire',
  diskussion: 'Discussion',
  praesentation: 'Présentation orale',
  lettre_formelle: 'Lettre formelle',
  lettre_informelle: 'Lettre informelle',
  zusammenfassung: 'Résumé',
  grafikbeschreibung: 'Description de graphique'
};
const REGS = { formel: 'Soutenu', neutre: 'Neutre', familier: 'Familier' };
const thLabel = k => THEMES[k] || k;
const txLabel = k => TEXTES[k] || k;

/* ---------- État ---------- */
let packs = {};
let loading = false, noIndex = false, loadErrors = [];
let mode = 'list';                       // list | drill | done
let f = { q: '', theme: '', reg: '', texte: '' };
let importMsg = '';
let queue = [], qi = 0, score = 0, st = null;

/* ---------- Utilitaires ---------- */
function shuffle(a){
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function rerender(){ if (DD.view === 'redemittel') DD.render(); }

/* ---------- Validation ---------- */
function validate(d){
  const errs = [];
  if (!d || typeof d !== 'object') return { ok: false, errors: ['JSON invalide'] };
  if (d.format !== 'deutschduo-redemittel') errs.push('format différent de « deutschduo-redemittel »');
  if (!d.id || typeof d.id !== 'string') errs.push('id manquant');
  if (!d.theme || typeof d.theme !== 'string') errs.push('theme manquant');
  if (!Array.isArray(d.items) || !d.items.length) errs.push('items manquants');
  const items = [];
  (Array.isArray(d.items) ? d.items : []).forEach((it, i) => {
    if (!it || typeof it.de !== 'string' || !it.de.trim() ||
        typeof it.fr !== 'string' || !it.fr.trim() ||
        typeof it.exemple !== 'string' || !it.exemple.trim()){
      errs.push('expression ' + (i + 1) + ' incomplète'); return;
    }
    items.push({
      de: it.de.trim(), fr: it.fr.trim(), exemple: it.exemple.trim(),
      registre: REGS[it.registre] ? it.registre : 'neutre',
      textes: Array.isArray(it.textes) ? it.textes.filter(t => typeof t === 'string') : [],
      note: typeof it.note === 'string' ? it.note : '',
      regle: typeof it.regle === 'string' ? it.regle : '',
      theme: d.theme, pack: d.id, key: d.id + '#' + i
    });
  });
  // Exercices à choix multiple : ceux qui sont invalides sont ignorés sans bruit
  const exercices = [];
  (Array.isArray(d.exercices) ? d.exercices : []).forEach(e => {
    if (e && typeof e.phrase === 'string' && Array.isArray(e.options) && e.options.length >= 2 &&
        e.options.every(o => typeof o === 'string') &&
        new Set(e.options).size === e.options.length &&
        Number.isInteger(e.reponse) && e.reponse >= 0 && e.reponse < e.options.length){
      exercices.push({ phrase: e.phrase, options: e.options.slice(), reponse: e.reponse });
    }
  });
  if (errs.length) return { ok: false, errors: errs };
  return { ok: true, pack: {
    id: d.id, theme: d.theme, title: typeof d.title === 'string' ? d.title : thLabel(d.theme),
    level: typeof d.level === 'string' ? d.level : '', items, exercices
  } };
}

/* ---------- Chargement ---------- */
function loadImported(){
  const list = store.get('dd_imported_redemittel', []) || [];
  list.forEach(p => { if (p && p.id && Array.isArray(p.items)) packs[p.id] = p; });
}
async function loadPacks(){
  loading = true; loadErrors = []; noIndex = false; loadImported(); rerender();
  try {
    const r0 = await fetch('packs/index.json', { cache: 'no-store' });
    if (!r0.ok) throw new Error('no-index');
    const idx = await r0.json();
    const ids = Array.isArray(idx.packs) ? idx.packs : [];
    for (const id of ids){
      try {
        const r = await fetch('packs/' + id + '.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        const data = await r.json();
        if (!data || data.format !== 'deutschduo-redemittel') continue; // pack d'un autre module
        const v = validate(data);
        if (v.ok) packs[v.pack.id] = v.pack;
        else loadErrors.push(id + ' : ' + v.errors.join(', '));
      } catch (e) { loadErrors.push(id + ' : fichier introuvable ou illisible dans packs/'); }
    }
  } catch (e) { noIndex = true; }
  loading = false; rerender();
}

/* ---------- Données dérivées ---------- */
function allItems(){
  let out = [];
  Object.keys(packs).forEach(id => { out = out.concat(packs[id].items); });
  return out;
}
function filtered(){
  const q = f.q.trim().toLowerCase();
  return allItems().filter(it =>
    (!f.theme || it.theme === f.theme) &&
    (!f.reg || it.registre === f.reg) &&
    (!f.texte || it.textes.indexOf(f.texte) !== -1) &&
    (!q || (it.de + ' ' + it.fr + ' ' + it.exemple).toLowerCase().indexOf(q) !== -1));
}

/* ---------- Style ---------- */
function injectStyle(){
  if (document.getElementById('rd-style')) return;
  const s = document.createElement('style'); s.id = 'rd-style';
  s.textContent = [
    '.rd-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}',
    '.rd-filters input,.rd-filters select{width:100%;min-width:0;box-sizing:border-box;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit}',
    '.rd-filters .rd-q{grid-column:1 / -1}',
    '.rd-bar{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:8px 0}',
    '.rd-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}',
    '.rd-de{font-weight:600;font-size:1.05rem}',
    '.rd-fr{color:var(--muted);margin-top:2px}',
    '.rd-ex{margin-top:8px;font-style:italic}',
    '.rd-note{margin-top:6px;font-size:.9rem;color:var(--muted)}',
    '.rd-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
    '.rd-tag{font-size:.78rem;padding:2px 8px;border-radius:999px;background:var(--soft);color:var(--muted)}',
    '.rd-tag.reg{color:var(--ink)}',
    '.rd-btn{font:inherit;padding:9px 14px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
    '.rd-btn.primary{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}',
    '.rd-btn.small{padding:6px 10px;font-size:.88rem}',
    '.rd-btn:disabled{opacity:.5;cursor:default}',
    '.rd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.rd-zone{min-height:52px;border:1px dashed var(--line);border-radius:10px;padding:8px;display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;background:var(--soft)}',
    '.rd-opt{display:block;width:100%;text-align:left;margin:8px 0}',
    '.rd-opt.good{border-color:var(--good);color:var(--good)}',
    '.rd-opt.bad{border-color:var(--bad);color:var(--bad)}',
    '.rd-msg.good{color:var(--good)}',
    '.rd-msg.bad{color:var(--bad)}',
    '.rd-imp textarea{width:100%;min-height:120px;box-sizing:border-box;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ---------- Écran : répertoire ---------- */
function optionsHtml(map, values, current, allLabel){
  return '<option value="">' + esc(allLabel) + '</option>' +
    values.map(v => '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(map[v] || v) + '</option>').join('');
}
function itemHtml(it, known){
  const inBook = known.indexOf(it.de.toLowerCase()) !== -1;
  const rules = window.DD_RULES || {};
  let h = '<div class="rd-card">' +
    '<div class="rd-de">' + esc(it.de) + '</div>' +
    '<div class="rd-fr">' + esc(it.fr) + '</div>' +
    '<div class="rd-ex">' + esc(it.exemple) + '</div>';
  if (it.note) h += '<div class="rd-note">' + esc(it.note) + '</div>';
  h += '<div class="rd-tags"><span class="rd-tag reg">' + esc(REGS[it.registre]) + '</span>' +
    '<span class="rd-tag">' + esc(thLabel(it.theme)) + '</span>' +
    it.textes.map(t => '<span class="rd-tag">' + esc(txLabel(t)) + '</span>').join('') + '</div>';
  h += '<div class="rd-row">' +
    (inBook
      ? '<button class="rd-btn small" disabled>Dans le carnet ✓</button>'
      : '<button class="rd-btn small" data-sa="rd-add-word" data-k="' + esc(it.key) + '">Ajouter au carnet</button>');
  if (it.regle && rules[it.regle]){
    h += '<button class="rd-btn small" data-sa="rd-gram" data-r="' + esc(it.regle) + '">Grammaire : ' + esc(rules[it.regle]) + '</button>';
  }
  return h + '</div></div>';
}
function listHtml(){
  const items = filtered();
  const known = DD.knownDe || [];
  if (!items.length){
    return '<p class="hint">' + (allItems().length
      ? 'Aucune expression ne correspond à ces filtres.'
      : 'Aucune expression pour l\u2019instant. Ajoutez des packs dans le dossier packs/ ou importez-en un ci-dessous.') + '</p>';
  }
  return items.map(it => itemHtml(it, known)).join('');
}
function countText(){
  const n = filtered().length, total = allItems().length;
  return n + ' expression' + (n > 1 ? 's' : '') + (n !== total ? ' sur ' + total : '');
}
function refreshList(){
  const l = document.getElementById('rd-list'), c = document.getElementById('rd-count');
  if (l) l.innerHTML = listHtml();
  if (c) c.textContent = countText();
}
function renderList(box){
  const items = allItems();
  const themes = Object.keys(THEMES).filter(t => items.some(i => i.theme === t))
    .concat(Array.from(new Set(items.map(i => i.theme))).filter(t => !THEMES[t]));
  const textes = Array.from(new Set([].concat.apply([], items.map(i => i.textes))));
  let h = '<h1>Redemittel</h1>';
  if (loading) h += '<p class="hint">Chargement des packs…</p>';
  if (noIndex && !loading && !items.length) h += '<p class="hint">Aucun fichier packs/index.json trouvé sur cette adresse. Vous pouvez importer un pack manuellement ci-dessous.</p>';
  if (loadErrors.length) h += '<div class="warn">Certains packs n\u2019ont pas pu être chargés :<br>' + loadErrors.map(esc).join('<br>') + '</div>';
  h += '<div class="rd-filters">' +
    '<input class="rd-q" id="rd-q" type="search" placeholder="Rechercher (allemand ou français)" value="' + esc(f.q) + '">' +
    '<select id="rd-th">' + optionsHtml(THEMES, themes, f.theme, 'Tous les thèmes') + '</select>' +
    '<select id="rd-rg">' + optionsHtml(REGS, Object.keys(REGS), f.reg, 'Tous les registres') + '</select>' +
    '<select id="rd-tx" style="grid-column:1 / -1">' + optionsHtml(TEXTES, textes, f.texte, 'Tous les types de texte') + '</select>' +
    '</div>';
  h += '<div class="rd-bar"><span class="hint" id="rd-count">' + esc(countText()) + '</span>' +
    '<button class="rd-btn primary" data-sa="rd-start">S\u2019entraîner</button></div>';
  h += '<div id="rd-list">' + listHtml() + '</div>';
  h += '<details class="rd-imp" style="margin-top:18px"><summary>Importer un pack Redemittel</summary>' +
    '<p class="hint">Collez le JSON d\u2019un pack (format « deutschduo-redemittel »).</p>' +
    '<textarea id="rd-imp-text" placeholder="{ &quot;format&quot;: &quot;deutschduo-redemittel&quot;, … }"></textarea>' +
    '<div class="rd-row"><button class="rd-btn" data-sa="rd-import">Importer</button></div>' +
    (importMsg ? '<p class="hint">' + esc(importMsg) + '</p>' : '') + '</details>';
  box.innerHTML = h;
}

/* ---------- Entraînement ---------- */
function prep(){
  const x = queue[qi];
  if (x.kind === 'order'){
    let bank = x.toks.map((t, i) => ({ t: t, i: i }));
    for (let n = 0; n < 5; n++){
      shuffle(bank);
      if (bank.some((b, p) => b.i !== p)) break;
    }
    st = { bank: bank, built: [], done: false, exact: false };
  } else {
    st = { opts: shuffle(x.e.options.map((t, i) => ({ t: t, ok: i === x.e.reponse }))), picked: -1 };
  }
}
function startDrill(){
  const items = filtered();
  if (!items.length){ toast('Aucune expression à travailler avec ces filtres.'); return; }
  const order = shuffle(items.slice())
    .map(it => ({ kind: 'order', it: it, toks: it.exemple.split(/\s+/) }))
    .filter(x => x.toks.length >= 4).slice(0, 8);
  const ids = new Set(items.map(i => i.pack));
  let mcq = [];
  ids.forEach(id => (packs[id].exercices || []).forEach(e => mcq.push({ kind: 'mcq', e: e })));
  mcq = shuffle(mcq).slice(0, 4);
  queue = shuffle(order.concat(mcq));
  if (!queue.length){ toast('Pas assez de matière pour un entraînement.'); return; }
  qi = 0; score = 0; mode = 'drill'; prep(); DD.render(); window.scrollTo(0, 0);
}
function nextExercise(){
  qi++;
  if (qi >= queue.length){ mode = 'done'; } else { prep(); }
  DD.render(); window.scrollTo(0, 0);
}
function renderDrill(box){
  const x = queue[qi];
  let h = '<div class="rd-bar"><span class="hint">Exercice ' + (qi + 1) + ' / ' + queue.length + '</span>' +
    '<button class="rd-btn small" data-sa="rd-quit">Quitter</button></div>';
  if (x.kind === 'order'){
    h += '<h2>Remettez la phrase dans l\u2019ordre</h2>' +
      '<p class="hint">Expression à utiliser : <b>' + esc(x.it.de) + '</b> (' + esc(x.it.fr) + ')</p>';
    h += '<div class="rd-zone">' + st.built.map((bi, pos) =>
      '<button class="rd-btn small" data-sa="rd-rm" data-i="' + pos + '"' + (st.done ? ' disabled' : '') + '>' + esc(st.bank[bi].t) + '</button>').join('') + '</div>';
    h += '<div class="rd-row">' + st.bank.map((b, i) =>
      '<button class="rd-btn small" data-sa="rd-put" data-i="' + i + '"' + (st.done || st.built.indexOf(i) !== -1 ? ' disabled' : '') + '>' + esc(b.t) + '</button>').join('') + '</div>';
    if (!st.done){
      h += '<div class="rd-row"><button class="rd-btn" data-sa="rd-reset">Réinitialiser</button>' +
        '<button class="rd-btn primary" data-sa="rd-check"' + (st.built.length === st.bank.length ? '' : ' disabled') + '>Vérifier</button></div>';
    } else {
      h += st.exact
        ? '<p class="rd-msg good"><b>Correct.</b></p>'
        : '<p class="rd-msg bad"><b>Ce n\u2019est pas la phrase modèle.</b> Un autre ordre peut être correct : comparez.</p>';
      h += '<p>Phrase modèle : <i>' + esc(x.it.exemple) + '</i></p><div class="rd-row">';
      if (!st.exact) h += '<button class="rd-btn" data-sa="rd-ok">Mon ordre est aussi correct</button>';
      h += '<button class="rd-btn primary" data-sa="rd-next">Suivant</button></div>';
    }
  } else {
    h += '<h2>Choisissez la bonne expression</h2><p style="font-size:1.05rem">' + esc(x.e.phrase) + '</p>';
    h += st.opts.map((o, i) => {
      let c = 'rd-btn rd-opt';
      if (st.picked >= 0){ if (o.ok) c += ' good'; else if (i === st.picked) c += ' bad'; }
      return '<button class="' + c + '" data-sa="rd-pick" data-i="' + i + '"' + (st.picked >= 0 ? ' disabled' : '') + '>' + esc(o.t) + '</button>';
    }).join('');
    if (st.picked >= 0){
      h += (st.opts[st.picked].ok ? '<p class="rd-msg good"><b>Correct.</b></p>' : '<p class="rd-msg bad"><b>Pas tout à fait.</b></p>') +
        '<div class="rd-row"><button class="rd-btn primary" data-sa="rd-next">Suivant</button></div>';
    }
  }
  box.innerHTML = h;
}
function renderDone(box){
  box.innerHTML = '<h1>Terminé</h1><p style="font-size:1.2rem"><b>' + score + ' / ' + queue.length + '</b></p>' +
    '<div class="rd-row"><button class="rd-btn primary" data-sa="rd-again">Rejouer</button>' +
    '<button class="rd-btn" data-sa="rd-quit">Retour au répertoire</button></div>';
}

/* ---------- Rendu principal ---------- */
function render(box){
  injectStyle();
  if (mode === 'drill' && queue[qi]) renderDrill(box);
  else if (mode === 'done') renderDone(box);
  else { mode = 'list'; renderList(box); }
}

/* ---------- Événements ---------- */
document.addEventListener('input', e => {
  if (DD.view !== 'redemittel') return;
  if (e.target && e.target.id === 'rd-q'){ f.q = e.target.value; refreshList(); }
});
document.addEventListener('change', e => {
  if (DD.view !== 'redemittel' || !e.target) return;
  const id = e.target.id;
  if (id === 'rd-th') f.theme = e.target.value;
  else if (id === 'rd-rg') f.reg = e.target.value;
  else if (id === 'rd-tx') f.texte = e.target.value;
  else return;
  refreshList();
});
document.addEventListener('click', e => {
  if (DD.view !== 'redemittel') return;
  const el = e.target.closest('[data-sa]'); if (!el) return;
  const a = el.dataset.sa; if (a.indexOf('rd-') !== 0) return;

  if (a === 'rd-add-word'){
    const it = allItems().find(x => x.key === el.dataset.k); if (!it) return;
    const r = DD.addWord({ de: it.de, fr: it.fr, ctx: it.exemple });
    toast(r === 'added' ? 'Ajouté au carnet.' : r === 'dup' ? 'Déjà dans le carnet.' : 'Ajout impossible.');
    refreshList();
  }
  else if (a === 'rd-gram'){ DD.pending = { rule: el.dataset.r }; DD.setView('grammatik'); }
  else if (a === 'rd-start') startDrill();
  else if (a === 'rd-again') startDrill();
  else if (a === 'rd-quit'){ mode = 'list'; DD.render(); window.scrollTo(0, 0); }
  else if (a === 'rd-put'){
    if (!st || st.done) return;
    const i = Number(el.dataset.i);
    if (st.built.indexOf(i) === -1){ st.built.push(i); DD.render(); }
  }
  else if (a === 'rd-rm'){
    if (!st || st.done) return;
    st.built.splice(Number(el.dataset.i), 1); DD.render();
  }
  else if (a === 'rd-reset'){ if (st && !st.done){ st.built = []; DD.render(); } }
  else if (a === 'rd-check'){
    const x = queue[qi]; if (!st || st.done || x.kind !== 'order') return;
    const mine = st.built.map(i => st.bank[i].t).join(' ');
    st.exact = mine === x.toks.join(' ');
    if (st.exact) score++;
    st.done = true; DD.render();
  }
  else if (a === 'rd-ok'){ score++; nextExercise(); }
  else if (a === 'rd-pick'){
    if (!st || st.picked >= 0) return;
    const i = Number(el.dataset.i);
    st.picked = i; if (st.opts[i].ok) score++;
    DD.render();
  }
  else if (a === 'rd-next') nextExercise();
  else if (a === 'rd-import'){
    const t = $('#rd-imp-text');
    if (!t || !t.value.trim()){ importMsg = 'Collez d\u2019abord le texte du pack.'; DD.render(); return; }
    let data; try { data = JSON.parse(t.value); } catch (err) { importMsg = 'Le texte collé n\u2019est pas un JSON valide.'; DD.render(); return; }
    const v = validate(data);
    if (!v.ok){ importMsg = 'Pack refusé : ' + v.errors.join(' ; ') + '.'; DD.render(); return; }
    packs[v.pack.id] = v.pack;
    const list = store.get('dd_imported_redemittel', []) || [];
    const i = list.findIndex(p => p.id === v.pack.id);
    if (i >= 0) list[i] = v.pack; else list.push(v.pack);
    store.set('dd_imported_redemittel', list);
    importMsg = 'Pack « ' + v.pack.id + ' » importé.'; toast('Pack importé.'); DD.render();
  }
});

/* API pour les autres modules (panneau de Schreiben) */
DD.redemittel = {
  count: function(){ return allItems().length; },
  textes: function(){
    const seen = new Set();
    allItems().forEach(it => it.textes.forEach(t => seen.add(t)));
    return Object.keys(TEXTES).filter(t => seen.has(t))
      .concat(Array.from(seen).filter(t => !TEXTES[t]))
      .map(t => ({ id: t, label: txLabel(t) }));
  },
  groups: function(o){
    o = o || {};
    const max = o.max || 8, by = {};
    allItems().forEach(it => {
      if (o.texte && it.textes.indexOf(o.texte) === -1) return;
      (by[it.theme] = by[it.theme] || []).push(it.de);
    });
    const order = Object.keys(THEMES).filter(t => by[t])
      .concat(Object.keys(by).filter(t => !THEMES[t]));
    return order.map(t => ({ theme: t, label: thLabel(t), items: by[t].slice(0, max) }));
  }
};
  
DD.register({ id: 'redemittel', label: 'Redemittel', render });
loadPacks();
})();
