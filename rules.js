// Liste unique des règles de grammaire, partagée par Grammatik et Schreiben
window.DD_RULES = {
  verb_nebensatz: 'Verbe en fin de subordonnée',
  verb_hauptsatz: 'Verbe en 2e position',
  inversion: 'Inversion sujet-verbe',

  konjunktiv2: 'Subjonctif II',
  'konjunktiv-ii': 'Subjonctif II',

  konjunktiv1: 'Subjonctif I (discours rapporté)',
  'konjunktiv-i': 'Subjonctif I (discours rapporté)',

  passiv: 'Passif',

  partizip: 'Participes (attribut, présent)',
  partizipialkonstruktionen: 'Constructions participiales',

  partizipial_adjektivattribute: 'Attributs participiaux et adjectivaux',
  'Partizipial- und Adjektivattribute': 'Attributs participiaux et adjectivaux',

  relativsatz: 'Propositions relatives',

  adjektiv: 'Déclinaison des adjectifs',
  adjektivdeklination: 'Déclinaison des adjectifs',

  artikel_genus: 'Article et genre',
  kasus: 'Cas (Akkusativ, Dativ, Genitiv)',

  wechselpraep: 'Prépositions à double cas',
  praep_verb: 'Verbes à préposition',
  praep_kasus: 'Prépositions et cas',
  praepositionen: 'Prépositions',
  praepositionaladverbien: 'Adverbes prépositionnels',
  'Präpositionaladverbien': 'Adverbes prépositionnels',

  konnektoren: 'Connecteurs et liaisons',

  infinitiv_zu: 'Infinitif avec zu',
  infinitivkonstruktionen: 'Infinitif avec zu',

  nominalisierung: 'Nominalisation',
  verbalisierung: 'Verbalisierung',
  'Verbalisierung': 'Verbalisierung',

  nomen_verb_verbindungen: 'Nomen-Verb-Verbindungen',
  'Nomen-Verb-Verbindungen': 'Nomen-Verb-Verbindungen',

  tempus: 'Temps (Perfekt, Präteritum, Plusquamperfekt)',
  futur: 'Futur I et II',
  'futur-i-und-futur-ii': 'Futur I et II',
  tempusgebrauch: 'Emploi des temps',
  'Tempusgebrauch': 'Emploi des temps',

  trennbar: 'Verbes séparables',
  reflexiv: 'Verbes pronominaux',
  negation: 'Négation',
  pronomen: 'Pronoms',

  mittelfeld: 'Ordre des mots (Mittelfeld)',
  satzbau_wortstellung: 'Construction de la phrase et ordre des mots',
  'Satzbau und Wortstellung': 'Construction de la phrase et ordre des mots',

  nebensaetze: 'Subordonnées',
  'Nebensätze': 'Subordonnées',

  komparation: 'Comparatif et superlatif',
  plural: 'Pluriel des noms',
  modalverb: 'Verbes de modalité',

  modalverben_nuancen: 'Nuances des verbes de modalité',
  'Modalverben – Nuancen': 'Nuances des verbes de modalité',

  rechtschreibung: 'Orthographe',
  zeichensetzung: 'Ponctuation (virgules)',
  wortwahl: 'Choix du mot',
  register: 'Registre de langue',

  textgrammatik_kohaerenz: 'Grammaire du texte et cohérence',
  'Textgrammatik & Kohärenz': 'Grammaire du texte et cohérence',

  autre: 'Autre'
};
// Quand Schreiben signale une règle, Grammatik cherche aussi les fiches
// classées sous ces règles voisines.
window.DD_RULE_LINKS = {
  modalverb: ['modalverben_nuancen'],
  verb_nebensatz: ['nebensaetze'],
  verb_hauptsatz: ['satzbau_wortstellung'],
  inversion: ['satzbau_wortstellung'],
  mittelfeld: ['satzbau_wortstellung'],
  tempus: ['tempusgebrauch'],
  nominalisierung: ['verbalisierung', 'nomen_verb_verbindungen']
};
