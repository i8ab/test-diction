// Fixed reference lists used to classify an English word deterministically
// (never randomly). These are closed word-classes in English, so a simple
// lookup is actually the *correct* linguistic approach for pronouns.

export const PRONOUNS_EN = new Set([
  "i", "you", "he", "she", "it", "we", "they",
  "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their",
  "mine", "yours", "hers", "ours", "theirs",
  "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves",
  "this", "that", "these", "those",
  "who", "whom", "whose", "which", "what",
  "someone", "somebody", "something", "anyone", "anybody", "anything",
  "everyone", "everybody", "everything", "no one", "nobody", "nothing",
  "each other", "one another",
]);

// Common English adjective-forming affixes, ordered longest-first so the
// most specific match wins. `strip`/`add` describe how to recover the root.
export const ADJ_SUFFIXES = [
  { suffix: "ability", label: "-ability", note: "اسم صفة من صفة تنتهي بـ -able" },
  { suffix: "ibility", label: "-ibility", note: "اسم صفة من صفة تنتهي بـ -ible" },
  { suffix: "ational", label: "-ational" },
  { suffix: "ious", label: "-ious" },
  { suffix: "eous", label: "-eous" },
  { suffix: "able", label: "-able", note: "بمعنى «قابل لـ»" },
  { suffix: "ible", label: "-ible", note: "بمعنى «قابل لـ»" },
  { suffix: "ful", label: "-ful", note: "بمعنى «مليء بـ»" },
  { suffix: "less", label: "-less", note: "بمعنى «بدون»" },
  { suffix: "ous", label: "-ous", note: "بمعنى «ذو صفة»" },
  { suffix: "ive", label: "-ive" },
  { suffix: "ary", label: "-ary" },
  { suffix: "ory", label: "-ory" },
  { suffix: "ant", label: "-ant" },
  { suffix: "ent", label: "-ent" },
  { suffix: "ical", label: "-ical" },
  { suffix: "ic", label: "-ic" },
  { suffix: "al", label: "-al" },
  { suffix: "ish", label: "-ish", note: "بمعنى «شبه/يميل إلى»" },
  { suffix: "like", label: "-like", note: "بمعنى «يشبه»" },
  { suffix: "some", label: "-some" },
  { suffix: "ed", label: "-ed" },
  { suffix: "ing", label: "-ing" },
  { suffix: "y", label: "-y" },
];

export const ADJ_PREFIXES = [
  { prefix: "un", label: "un-", note: "أداة نفي" },
  { prefix: "non", label: "non-", note: "أداة نفي" },
  { prefix: "dis", label: "dis-", note: "أداة نفي" },
  { prefix: "im", label: "im-", note: "أداة نفي" },
  { prefix: "il", label: "il-", note: "أداة نفي" },
  { prefix: "ir", label: "ir-", note: "أداة نفي" },
  { prefix: "in", label: "in-", note: "أداة نفي" },
  { prefix: "anti", label: "anti-" },
  { prefix: "pre", label: "pre-" },
  { prefix: "post", label: "post-" },
  { prefix: "over", label: "over-" },
  { prefix: "under", label: "under-" },
  { prefix: "inter", label: "inter-" },
  { prefix: "semi", label: "semi-" },
  { prefix: "pseudo", label: "pseudo-" },
];

// Fallback used only when the live dictionary lookup is unavailable
// (offline demo, API hiccup, etc.) — still rule-based, not a guess made up
// on the spot: these are the standard English derivational endings.
export const NOUN_SUFFIXES = ["tion", "sion", "ment", "ness", "ity", "ship", "hood", "dom", "er", "or", "ist", "ism", "ance", "ence"];
export const ADVERB_SUFFIX = "ly";
export const VERB_SUFFIXES = ["ize", "ise", "ify", "ate", "en"];

// A compact but real irregular-verb table (principal parts). Anything not
// listed is treated as a regular verb and conjugated with the standard
// spelling rules in verbConjugationEn.js.
export const IRREGULAR_VERBS_EN = {
  be: ["was/were", "been"], have: ["had", "had"], do: ["did", "done"],
  go: ["went", "gone"], get: ["got", "gotten"], make: ["made", "made"],
  know: ["knew", "known"], think: ["thought", "thought"], take: ["took", "taken"],
  see: ["saw", "seen"], come: ["came", "come"], want: ["wanted", "wanted"],
  give: ["gave", "given"], find: ["found", "found"], tell: ["told", "told"],
  ask: ["asked", "asked"], work: ["worked", "worked"], seem: ["seemed", "seemed"],
  feel: ["felt", "felt"], leave: ["left", "left"], call: ["called", "called"],
  put: ["put", "put"], mean: ["meant", "meant"], keep: ["kept", "kept"],
  let: ["let", "let"], begin: ["began", "begun"], run: ["ran", "run"],
  write: ["wrote", "written"], bring: ["brought", "brought"], hold: ["held", "held"],
  stand: ["stood", "stood"], read: ["read", "read"], build: ["built", "built"],
  break: ["broke", "broken"], speak: ["spoke", "spoken"], spend: ["spent", "spent"],
  grow: ["grew", "grown"], lose: ["lost", "lost"], pay: ["paid", "paid"],
  meet: ["met", "met"], send: ["sent", "sent"], buy: ["bought", "bought"],
  sit: ["sat", "sat"], win: ["won", "won"], understand: ["understood", "understood"],
  eat: ["ate", "eaten"], drink: ["drank", "drunk"], drive: ["drove", "driven"],
  fly: ["flew", "flown"], sing: ["sang", "sung"], swim: ["swam", "swum"],
  ride: ["rode", "ridden"], rise: ["rose", "risen"], fall: ["fell", "fallen"],
  choose: ["chose", "chosen"], forget: ["forgot", "forgotten"], sleep: ["slept", "slept"],
  teach: ["taught", "taught"], catch: ["caught", "caught"], fight: ["fought", "fought"],
  draw: ["drew", "drawn"], throw: ["threw", "thrown"], wear: ["wore", "worn"],
  cut: ["cut", "cut"], hit: ["hit", "hit"], hurt: ["hurt", "hurt"],
  cost: ["cost", "cost"], shut: ["shut", "shut"], set: ["set", "set"],
  lead: ["led", "led"], lend: ["lent", "lent"], shoot: ["shot", "shot"],
  steal: ["stole", "stolen"], sell: ["sold", "sold"], deal: ["dealt", "dealt"],
  feed: ["fed", "fed"], hide: ["hid", "hidden"], hang: ["hung", "hung"],
  strike: ["struck", "struck"], swear: ["swore", "sworn"], tear: ["tore", "torn"],
  wake: ["woke", "woken"], blow: ["blew", "blown"], freeze: ["froze", "frozen"],
  bear: ["bore", "born"], bite: ["bit", "bitten"], burst: ["burst", "burst"],
  cast: ["cast", "cast"], creep: ["crept", "crept"],
  dig: ["dug", "dug"], dive: ["dived/dove", "dived"], forgive: ["forgave", "forgiven"],
  shake: ["shook", "shaken"], shine: ["shone", "shone"], spread: ["spread", "spread"],
  spring: ["sprang", "sprung"], stick: ["stuck", "stuck"], sting: ["stung", "stung"],
  stink: ["stank", "stunk"], strive: ["strove", "striven"], sweep: ["swept", "swept"],
  swing: ["swung", "swung"], upset: ["upset", "upset"], weep: ["wept", "wept"],
};
