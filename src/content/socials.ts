/**
 * Social links (ADR 0007 §9): shown only when the address exists, never as a placeholder.
 * Discord and LinkedIn accounts are not created yet; Matrix is out.
 */

export type SocialNetwork = "github" | "discord" | "linkedin";

export const SOCIALS: Readonly<Record<SocialNetwork, string | null>> = {
  github: "https://github.com/libre-ai",
  discord: null,
  linkedin: null,
};

export const SOCIAL_LABELS: Readonly<Record<SocialNetwork, string>> = {
  github: "GitHub",
  discord: "Discord",
  linkedin: "LinkedIn",
};
