/**
 * Report page (S3.5, FR-15): the site collects nothing, so a report goes through the public
 * forge. Links only; no form, no field, no script.
 */
import { FORGE_URL } from "./layout";

export function signalerBody(): string {
  return [
    "<h1>Signaler</h1>",
    "<p>Ce site ne collecte rien : aucun formulaire, aucun compte. Un signalement passe par la forge publique.</p>",
    "<h2>Une erreur sur une page de ce site</h2>",
    `<p>Ouvrir une <a href="${FORGE_URL}/project-website/issues" rel="noopener noreferrer">issue du dépôt du site</a>, en indiquant la page et ce qui est inexact.</p>`,
    "<h2>Un défaut dans un produit</h2>",
    "<p>Utiliser les issues du dépôt du produit, accessible par le lien « Code source » de sa page.</p>",
    '<h2>Ce qui est fait ensuite</h2><p>Une correction acceptée est consignée, datée, dans le <a href="/corrections">journal des corrections</a>.</p>',
  ].join("");
}
