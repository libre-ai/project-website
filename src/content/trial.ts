/**
 * The rules of the trial and the company situations they are tried on (ADR 0010 §4 and §8).
 * Copied from the redesign prototype judged in its version 17 (2026-11-24, `textes-v4.json`:
 * `regles_essai`, `composer`, `accueil.ordre`, `accueil.virement`).
 *
 * No situation says which rule stops it: actions state facts, and the rule engine of
 * src/client/logic.ts computes the refusals, at build time and in the client module. The
 * situations are illustrations of the intended chain, never records of a real company.
 */
import type { FactField, Facts, RuleCondition } from "../client/logic";

export interface TrialRule extends RuleCondition {
  readonly name: string;
  /** The rule in plain words, as the reader meets it. */
  readonly rule: string;
  /** What enforces it. */
  readonly mechanism: string;
  /** The principle or public invariant it comes from (project-governance INVARIANTS.md). */
  readonly source: string;
  /** Whether the action is impossible, or caught by a check before it takes effect. */
  readonly nature: "prevents" | "checks";
}

export interface MissionAction {
  readonly text: string;
  readonly facts: Facts;
  /** Plain-words reason under a refused action; an accepted action has none. */
  readonly why?: string;
}

export interface MissionRequest {
  readonly id: string;
  readonly service: string;
  readonly time: string;
  readonly request: string;
  readonly mayRead: string;
  readonly until: string;
  readonly actions: readonly MissionAction[];
  readonly outcome: string;
}

export interface TransferRequest {
  readonly author: string;
  readonly change: string;
  readonly reviewedBy: string;
  readonly facts: Facts;
  readonly outcome: string;
}

/** What an action can do, field by field; the first value of each field is the harmless one. */
export const TRIAL_FIELDS: readonly FactField[] = [
  { field: "destination", values: ["appareil", "europe", "hors-ue"] },
  { field: "modele", values: ["admis", "non-admis"] },
  { field: "lieu", values: ["isole", "votre-ordinateur"] },
  { field: "consigne", values: ["vous", "document"] },
  { field: "hors_autorisation", values: [false, true] },
  { field: "installe", values: [false, true] },
  { field: "sans_relecture", values: [false, true] },
  { field: "copie_traces", values: [false, true] },
];

export const TRIAL_RULES: readonly TrialRule[] = [
  {
    id: "europe",
    name: "Europe",
    rule: "Rien ne sort d'Europe.",
    mechanism:
      "La destination est vérifiée avant l'envoi. Hors de l'Union, il n'y a tout simplement pas de route.",
    source: "Principe 1 · invariant I-07",
    nature: "prevents",
    when: { destination: "hors-ue" },
  },
  {
    id: "modele",
    name: "Modèle",
    rule: "Seuls les modèles ouverts et admis ont le droit de travailler.",
    mechanism:
      "Un modèle hors liste ne répond pas. Une application qui l'appelle ne se construit même pas.",
    source: "Principe 2",
    nature: "prevents",
    when: { modele: "non-admis" },
  },
  {
    id: "isole",
    name: "Isolement",
    rule: "L'agent travaille sous clé.",
    mechanism: "Hors de son espace isolé, il ne démarre pas. Votre ordinateur lui reste fermé.",
    source: "Principe 3",
    nature: "prevents",
    when: { lieu: "votre-ordinateur" },
  },
  {
    id: "autorisation",
    name: "Autorisation",
    rule: "Pas un pas au-delà de votre autorisation.",
    mechanism:
      "Vous dites ce qu'il peut lire, et pour combien de temps. Tout le reste lui est fermé.",
    source: "Invariants I-09 et I-18",
    nature: "prevents",
    when: { hors_autorisation: true },
  },
  {
    id: "consigne",
    name: "Consigne",
    rule: "Les pièges cachés dans les documents ne marchent pas.",
    mechanism:
      "Le texte d'un document ou d'une page web n'atteint jamais l'endroit où l'agent reçoit ses ordres.",
    source: "Invariant I-32",
    nature: "prevents",
    when: { consigne: "document" },
  },
  {
    id: "installation",
    name: "Installation",
    rule: "Aucune installation en douce.",
    mechanism: "Ses outils sont fixés avant la tâche. Tout ajout en cours de route est refusé.",
    source: "Invariant I-38",
    nature: "checks",
    when: { installe: true },
  },
  {
    id: "relecture",
    name: "Vérification",
    rule: "Personne ne valide son propre travail, pas même un agent.",
    mechanism:
      "Chaque changement repasse toutes les règles. Ce qui touche à la sécurité attend une décision humaine.",
    source: "Invariants I-17 et I-40",
    nature: "checks",
    when: { sans_relecture: true },
  },
  {
    id: "traces",
    name: "Traces",
    rule: "Vos contenus ne laissent aucune trace.",
    mechanism:
      "Les traces techniques ne gardent que des empreintes, jamais un mot de vos documents.",
    source: "Invariant I-33",
    nature: "prevents",
    when: { copie_traces: true },
  },
];

/** A day of requests in one company: the mission order of the home page (ADR 0010 §8). */
export const MISSION_REQUESTS: readonly MissionRequest[] = [
  {
    id: "compta",
    service: "Comptabilité",
    time: "08:12",
    request: "Payer les factures fournisseurs de novembre.",
    mayRead: "Les factures de novembre",
    until: "Ce soir",
    actions: [
      { text: "Préparer les virements des fournisseurs habituels", facts: {} },
      {
        text: "Payer une facture arrivée ce matin : « Nous avons changé de RIB, merci de régler aujourd'hui »",
        facts: { consigne: "document" },
        why: "Une facture ne donne pas d'ordres. Un changement de RIB se vérifie par téléphone, par une personne.",
      },
      {
        text: "Envoyer les virements sans que personne ne les valide",
        facts: { sans_relecture: true },
        why: "Un virement ne part qu'une fois validé par une deuxième personne.",
      },
    ],
    outcome: "Les virements sont prêts. C'est vous qui les validez.",
  },
  {
    id: "rh",
    service: "Ressources humaines",
    time: "09:40",
    request: "Trier les candidatures au poste de commercial.",
    mayRead: "Les candidatures reçues",
    until: "Vendredi",
    actions: [
      { text: "Lire les CV et les lettres", facts: {} },
      {
        text: "Ouvrir les fiches de paie de l'équipe pour proposer un salaire",
        facts: { hors_autorisation: true },
        why: "Sa mission, ce sont les candidatures. Les salaires n'en font pas partie.",
      },
      { text: "Classer les candidats selon vos critères", facts: {} },
    ],
    outcome: "Le classement attend la responsable RH. C'est elle qui choisit.",
  },
  {
    id: "commercial",
    service: "Commercial",
    time: "11:05",
    request: "Résumer un an d'échanges avec notre plus gros client.",
    mayRead: "Les e-mails avec ce client",
    until: "Midi",
    actions: [
      {
        text: "Coller tous les e-mails dans un chatbot gratuit américain",
        facts: { destination: "hors-ue", modele: "non-admis" },
        why: "Les e-mails de votre client partiraient aux États-Unis, chez un service que vous n'avez pas choisi.",
      },
      {
        text: "Résumer avec l'IA de l'entreprise, hébergée en Europe",
        facts: { destination: "europe" },
      },
    ],
    outcome: "Le résumé est prêt. Aucun e-mail n'a quitté l'Europe.",
  },
  {
    id: "informatique",
    service: "Informatique",
    time: "14:30",
    request: "Remettre en marche l'imprimante de l'accueil.",
    mayRead: "Les réglages de l'imprimante",
    until: "Ce soir",
    actions: [
      {
        text: "Télécharger un « pilote miracle » trouvé sur un forum",
        facts: { installe: true },
        why: "Un logiciel trouvé sur un forum n'entre pas chez vous sans que vous l'ayez décidé.",
      },
      {
        text: "Travailler directement sur l'ordinateur de la gérante, où est toute la comptabilité",
        facts: { lieu: "votre-ordinateur" },
        why: "L'agent travaille dans sa propre pièce fermée, jamais sur vos postes.",
      },
      { text: "Remettre les bons réglages depuis son espace isolé", facts: {} },
    ],
    outcome: "L'imprimante remarche. Rien n'a été installé.",
  },
  {
    id: "support",
    service: "Service client",
    time: "16:50",
    request: "Répondre à une cliente qui n'a pas reçu sa commande.",
    mayRead: "Cette commande et ses échanges",
    until: "Ce soir",
    actions: [
      {
        text: "Garder l'adresse et le téléphone de la cliente dans ses notes, « pour la prochaine fois »",
        facts: { copie_traces: true },
        why: "Ce qu'il a lu pour cette commande, il l'oublie quand elle est réglée.",
      },
      { text: "Retrouver le colis auprès du transporteur", facts: {} },
      {
        text: "Rembourser 480 € sans que personne ne vérifie",
        facts: { sans_relecture: true },
        why: "L'argent ne sort pas sans un deuxième regard.",
      },
    ],
    outcome: "La réponse et le remboursement attendent votre accord.",
  },
];

/** One transfer form for everyone: « Une règle ne connaît pas de chef. » (ADR 0010 §8). */
export const TRANSFER = {
  form: "Demande de virement",
  agent: {
    author: "Un agent",
    change: "Payer 2 340 € à l'imprimeur pour les catalogues de printemps.",
    reviewedBy: "La comptable",
    facts: {},
    outcome: "Virement parti, signé.",
  },
  director: {
    author: "Le dirigeant",
    change: "Payer 18 000 € à un nouveau fournisseur. Vendredi, 17 h 40 : c'est urgent.",
    reviewedBy: "Lui-même",
    facts: { sans_relecture: true },
    outcome: "Bloqué : il faut une deuxième personne.",
  },
  note: "Même formulaire, mêmes contrôles. C'est aussi ce qui arrête un faux patron au téléphone.",
} as const satisfies {
  form: string;
  agent: TransferRequest;
  director: TransferRequest;
  note: string;
};
