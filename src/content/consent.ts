/**
 * The consent text shown under every waitlist form (ADR 0006 §3). Its version is stored with each
 * subscription as the proof of what the visitor agreed to: any change of wording takes a new
 * version, and the previous text stays readable in the history of this file.
 */

export const CONSENT_TEXT_VERSION = "2026-11-09";

export const CONSENT_TEXT =
  "Votre adresse sert uniquement à vous prévenir des envols de Libre IA. " +
  "Un e-mail de confirmation vous est envoyé ; sans confirmation sous 48 heures, l'adresse est effacée. " +
  "Désinscription en un clic, à tout moment.";
