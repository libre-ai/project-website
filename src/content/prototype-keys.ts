/**
 * The internal keys of the v4 prototype accepted on 2026-11-09, by application reference. The
 * showcases and journeys ported from it are keyed by these words; they are not public slugs and
 * do not change when the owner renames an application (the slugs will follow the new names).
 */

export const PROTOTYPE_KEY_OF: Readonly<Record<string, string>> = {
  P01: "sources",
  P02: "veille",
  P03: "corpus",
  P04: "notes",
  P05: "wiki",
  P06: "recherche",
  P07: "revision",
  P08: "docs",
  P09: "tableur",
  P10: "diapos",
  P11: "fichiers",
  P12: "pdf",
  P13: "formulaires",
  P14: "canevas",
  P15: "tickets",
  P16: "taches",
  P17: "mail",
  P18: "visio",
  P19: "agenda",
  P20: "relations",
  P21: "reunion",
  P22: "video",
  P23: "prototype",
  P24: "audio",
  P25: "site",
  P26: "diffusion",
  P27: "ressources",
  P28: "tempo",
  P29: "antenne",
  P30: "lecture",
  P31: "mediatheque",
  P32: "jdr",
  P33: "routeur",
  P34: "assistant",
  P35: "automates",
  P36: "vpn",
  P37: "coffre",
  P38: "sauvegarde",
  P39: "cours",
  P40: "fenetres",
};

const REF_OF_KEY: ReadonlyMap<string, string> = new Map(
  Object.entries(PROTOTYPE_KEY_OF).map(([ref, key]) => [key, ref]),
);

export function refOfPrototypeKey(key: string): string {
  const ref = REF_OF_KEY.get(key);
  if (ref === undefined) throw new Error(`content.prototype_key_unknown:${key}`);
  return ref;
}
