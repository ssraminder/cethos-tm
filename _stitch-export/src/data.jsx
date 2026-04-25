// Sample data for the prototype

const SAMPLE_USERS = [
  { name: "Maria Chen", email: "maria.chen@acme.com", role: "translator" },
  { name: "Sarah Park", email: "sarah.park@cethos.com", role: "pm" },
  { name: "James Okonkwo", email: "james@cethos.com", role: "admin" },
];

const TM_LIST = [
  { name: "Acme EN→FR Master", from: "EN", to: "FR", scope: "Client", units: 1284302, updated: "2 min ago", jobs: 18 },
  { name: "Marketing EN→ES", from: "EN", to: "ES", scope: "Client", units: 412009, updated: "1 hr ago", jobs: 9 },
  { name: "Legal Master EN→DE", from: "EN", to: "DE", scope: "Global", units: 982143, updated: "Yesterday", jobs: 4 },
  { name: "Globex Q2 Pilot", from: "EN", to: "JA", scope: "Project", units: 18204, updated: "3 days ago", jobs: 1 },
  { name: "Initech Tech Docs EN→IT", from: "EN", to: "IT", scope: "Client", units: 240115, updated: "1 wk ago", jobs: 6 },
  { name: "Pied Piper Engineering EN→ZH", from: "EN", to: "ZH", scope: "Client", units: 89012, updated: "2 wks ago", jobs: 3 },
  { name: "Hooli Marketing EN→PT", from: "EN", to: "PT", scope: "Client", units: 158022, updated: "3 wks ago", jobs: 5 },
];

const TM_UNITS = [
  { src: "Where translators do their best work.", tgt: "Là où les traducteurs font leur meilleur travail.", quality: 5, by: "Maria Chen", updated: "2 min ago", note: true, status: "Active" },
  { src: "Translation memory, terminology, MT, and QA in one editor.", tgt: "Mémoire de traduction, terminologie, TA et AQ dans un seul éditeur.", quality: 5, by: "Maria Chen", updated: "5 min ago", status: "Active" },
  { src: "Sign in to continue.", tgt: "Connectez-vous pour continuer.", quality: 4, by: "Lena Vogt", updated: "1 hr ago", status: "Active" },
  { src: "Reset password", tgt: "Réinitialiser le mot de passe", quality: 5, by: "Lena Vogt", updated: "1 hr ago", status: "Active" },
  { src: "Your session has expired.", tgt: "Votre session a expiré.", quality: 4, by: "Auto-import", updated: "Yesterday", status: "Active" },
  { src: "Click here to download the report.", tgt: "Cliquez ici pour télécharger le rapport.", quality: 3, by: "Tomás Diaz", updated: "Yesterday", note: true, status: "Forbidden" },
  { src: "Welcome aboard!", tgt: "Bienvenue à bord !", quality: 4, by: "Lena Vogt", updated: "2 days ago", status: "Active" },
  { src: "Settings have been saved.", tgt: "Les paramètres ont été enregistrés.", quality: 5, by: "Maria Chen", updated: "2 days ago", status: "Active" },
  { src: "An error occurred while processing your request.", tgt: "Une erreur s'est produite lors du traitement de votre demande.", quality: 4, by: "Auto-import", updated: "3 days ago", status: "Active" },
  { src: "Forgot password?", tgt: "Mot de passe oublié ?", quality: 5, by: "Lena Vogt", updated: "1 wk ago", status: "Active" },
];

const SEGMENTS = [
  { id: 1, source: "Welcome to Acme — let's get you set up.", target: "Bienvenue chez Acme — nous allons vous installer.", status: "confirmed", match: 100, matchType: "TM", tags: [] },
  { id: 2, source: "Tell us a bit about your team.", target: "Parlez-nous un peu de votre équipe.", status: "confirmed", match: 98, matchType: "TM", tags: [] },
  { id: 3, source: "How many people are in your organization?", target: "Combien de personnes y a-t-il dans votre organisation ?", status: "confirmed", match: 95, matchType: "TM" },
  { id: 4, source: "What industry do you work in?", target: "Dans quel secteur travaillez-vous ?", status: "confirmed", match: 100, matchType: "TM" },
  { id: 5, source: "Choose a workspace name.", target: "Choisissez un nom d'espace de travail.", status: "confirmed", match: 87, matchType: "TM" },
  { id: 6, source: "This will be visible to {1}your teammates{/1} once you invite them.", target: "Cela sera visible par {1}vos coéquipiers{/1} une fois que vous les aurez invités.", status: "confirmed", match: 78, matchType: "TM", tags: [{i:1,c:"#0891B2"}] },
  { id: 7, source: "We'll send invitations to <ph/> people.", target: "Nous enverrons des invitations à <ph/> personnes.", status: "draft", match: 65, matchType: "TM", tags: [{i:"ph",c:"#A855F7"}], qa: "major" },
  { id: 8, source: "Invite your team to start collaborating in real time.", target: "Invitez votre équipe à commencer à collaborer en temps réel.", status: "active", match: 82, matchType: "TM" },
  { id: 9, source: "Add up to 5 teammates by email.", target: "", status: "untranslated", match: 0, matchType: null, tags: [] },
  { id: 10, source: "You can {1}invite more later{/1} from settings.", target: "", status: "untranslated", match: 72, matchType: "TM", tags: [{i:1,c:"#0891B2"}] },
  { id: 11, source: "Connect your tools.", target: "", status: "untranslated", match: 100, matchType: "TM", tags: [] },
  { id: 12, source: "Slack, Notion, GitHub, and 40+ more integrations.", target: "", status: "untranslated", match: 0, matchType: "MT", tags: [] },
  { id: 13, source: "We'll only send notifications you ask for.", target: "", status: "untranslated", match: 88, matchType: "TM" },
  { id: 14, source: "Pick the plan that fits your team.", target: "", status: "untranslated", match: 0, matchType: "MT" },
  { id: 15, source: "Cancel or change plans anytime.", target: "", status: "locked", match: 100, matchType: "TM", tags: [] },
];

const TM_HITS_FOR_S8 = [
  { match: 82, type: "TM", tm: "Acme EN→FR Master", source: "Invite your team to start working together.", target: "Invitez votre équipe à commencer à travailler ensemble.", by: "Maria Chen", date: "3 days ago", diff: { add: ["collaborer en temps réel"], rem: ["travailler ensemble"] } },
  { match: 76, type: "TM", tm: "Marketing EN→FR", source: "Invite your team to collaborate.", target: "Invitez votre équipe à collaborer.", by: "Lena Vogt", date: "1 wk ago" },
  { match: 100, type: "TM", tm: "Acme EN→FR Master", source: "in real time", target: "en temps réel", by: "Maria Chen", date: "2 mo ago" },
];

const TERMS_FOR_S8 = [
  { src: "team", tgt: "équipe", pos: "noun", def: "Group of people working together on a project.", status: "Approved" },
  { src: "collaborate", tgt: "collaborer", pos: "verb", def: "To work jointly on an activity.", status: "Approved" },
  { src: "real time", tgt: "temps réel", pos: "noun", def: "Without perceptible delay.", status: "Approved" },
  { src: "team", tgt: "groupe", pos: "noun", def: "Avoid: not specific enough in our brand voice.", status: "Forbidden" },
];

const QA_ISSUES_FOR_S7 = [
  { sev: "major", rule: "Number mismatch", desc: "Source has placeholder <ph/> — confirm it maps to the right number in target.", autofix: false },
  { sev: "minor", rule: "Length ratio", desc: "Target is 28% longer than source (threshold 25%).", autofix: false },
];

const COMMENTS_FOR_S6 = [
  { who: "Sarah Park", role: "PM", time: "2 hr ago", body: "Use 'coéquipiers' here for warmth — matches the brand voice deck." },
  { who: "Maria Chen", role: "Translator", time: "1 hr ago", body: "Good call. Updated. Should we apply this rule across the file?" },
];

const JOBS = [
  { ref: "J-2026-04-381", source: "TMS", project: "Acme Q2", pair: ["EN", "FR"], words: 4820, progress: 64, leverage: 64, qa: 4, status: "In progress", deadline: "in 2d 4h", translator: "Maria Chen" },
  { ref: "J-2026-04-379", source: "TMS", project: "Globex Onboarding", pair: ["EN", "ES"], words: 2210, progress: 100, leverage: 71, qa: 0, status: "Submitted", deadline: "Yesterday", translator: "Tomás Diaz" },
  { ref: "J-2026-04-376", source: "Manual", project: "Initech Test", pair: ["EN", "DE"], words: 815, progress: 22, leverage: 12, qa: 1, status: "In progress", deadline: "in 5d", translator: "Lena Vogt" },
  { ref: "J-2026-04-375", source: "TMS", project: "Hooli Marketing", pair: ["EN", "JA"], words: 6140, progress: 87, leverage: 58, qa: 12, status: "QA", deadline: "in 1d", translator: "Akira Tanaka" },
  { ref: "J-2026-04-372", source: "TMS", project: "Pied Piper Eng", pair: ["EN", "ZH"], words: 1820, progress: 100, leverage: 80, qa: 0, status: "Submitted", deadline: "2 days ago", translator: "Wei Lin" },
  { ref: "J-2026-04-369", source: "TMS", project: "Acme Help Center", pair: ["EN", "FR"], words: 12400, progress: 0, leverage: 0, qa: 0, status: "Draft", deadline: "in 9d", translator: "Maria Chen" },
  { ref: "J-2026-04-365", source: "Manual", project: "Massive Dynamic", pair: ["EN", "PT"], words: 920, progress: 100, leverage: 44, qa: 0, status: "Closed", deadline: "1 wk ago", translator: "Tomás Diaz" },
  { ref: "J-2026-04-360", source: "TMS", project: "Soylent Brand Refresh", pair: ["EN", "IT"], words: 3210, progress: 45, leverage: 32, qa: 2, status: "In progress", deadline: "in 6d", translator: "Giulia Rossi" },
  { ref: "J-2026-04-355", source: "TMS", project: "Stark Industries", pair: ["EN", "DE"], words: 9820, progress: 12, leverage: 88, qa: 0, status: "In progress", deadline: "in 11d", translator: "Lena Vogt" },
];

const TRANSLATORS = [
  { name: "Maria Chen", pairs: [["EN","FR"],["EN","ES"]], capacity: 78, jobs: 3, leverage: 68, ontime: 96, qa: 4.7, status: "Busy" },
  { name: "Tomás Diaz", pairs: [["EN","ES"],["EN","PT"]], capacity: 42, jobs: 2, leverage: 71, ontime: 100, qa: 4.9, status: "Available" },
  { name: "Lena Vogt", pairs: [["EN","DE"]], capacity: 95, jobs: 4, leverage: 60, ontime: 88, qa: 4.5, status: "Busy" },
  { name: "Akira Tanaka", pairs: [["EN","JA"]], capacity: 88, jobs: 2, leverage: 58, ontime: 92, qa: 4.6, status: "Busy" },
  { name: "Wei Lin", pairs: [["EN","ZH"]], capacity: 31, jobs: 1, leverage: 80, ontime: 100, qa: 4.8, status: "Available" },
  { name: "Giulia Rossi", pairs: [["EN","IT"]], capacity: 60, jobs: 2, leverage: 55, ontime: 94, qa: 4.7, status: "Available" },
  { name: "Sven Eriksson", pairs: [["EN","NL"],["EN","DE"]], capacity: 18, jobs: 1, leverage: 72, ontime: 98, qa: 4.8, status: "Available" },
  { name: "Camille Laurent", pairs: [["EN","FR"]], capacity: 52, jobs: 2, leverage: 64, ontime: 95, qa: 4.6, status: "Available" },
];

const AUDIT_LOG = [
  { ts: "2026-04-24T14:32:18Z", actor: "James Okonkwo", action: "settings_change", target: "QA Profile / Marketing strict", ip: "10.4.18.22" },
  { ts: "2026-04-24T14:18:02Z", actor: "Sarah Park", action: "job_assign", target: "J-2026-04-381 → Maria Chen", ip: "73.121.4.18" },
  { ts: "2026-04-24T14:02:55Z", actor: "Maria Chen", action: "sign_in", target: "—", ip: "92.18.4.121" },
  { ts: "2026-04-24T13:48:11Z", actor: "TMS Webhook", action: "job_create", target: "J-2026-04-381", ip: "—" },
  { ts: "2026-04-24T13:42:00Z", actor: "Lena Vogt", action: "tm_unit_create", target: "Acme EN→FR Master / 1,284,302", ip: "44.18.221.4" },
  { ts: "2026-04-24T12:55:14Z", actor: "Sarah Park", action: "termbase_entry_forbid", target: "Acme Brand / 'team' (FR: groupe)", ip: "73.121.4.18" },
  { ts: "2026-04-24T12:30:08Z", actor: "James Okonkwo", action: "tm_import", target: "Legal Master EN→DE (+8,210 units)", ip: "10.4.18.22" },
  { ts: "2026-04-24T11:18:22Z", actor: "Tomás Diaz", action: "job_complete", target: "J-2026-04-379", ip: "201.4.88.10" },
];

const NOTIFS = [
  { type: "assign", msg: "Sarah Park assigned you to job J-2026-04-381", time: "2 min ago", unread: true },
  { type: "deadline", msg: "Job J-2026-04-381 is due in 2 hours", time: "1 hr ago", unread: true },
  { type: "mention", msg: "Sarah Park mentioned you in segment 6 of Acme Q2", time: "3 hr ago", unread: true },
  { type: "system", msg: "Your weekly throughput report is ready", time: "Yesterday", unread: false },
  { type: "system", msg: "TM 'Acme EN→FR Master' was updated by Lena Vogt", time: "Yesterday", unread: false },
];

Object.assign(window, {
  SAMPLE_USERS, TM_LIST, TM_UNITS, SEGMENTS, TM_HITS_FOR_S8, TERMS_FOR_S8,
  QA_ISSUES_FOR_S7, COMMENTS_FOR_S6, JOBS, TRANSLATORS, AUDIT_LOG, NOTIFS,
});
