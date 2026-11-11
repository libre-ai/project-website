/**
 * Waitlist messages (ADR 0006 §4). The confirmation message carries the one-click unsubscribe
 * headers of RFC 8058 so a mail client can offer leaving the list without opening a page. The
 * sender address is a setting of the deployment, never written in this code.
 */

export interface MailMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly headers: Readonly<Record<string, string>>;
}

export function confirmationMessage(input: {
  readonly from: string;
  readonly to: string;
  readonly confirmUrl: string;
  readonly unsubscribeUrl: string;
}): MailMessage {
  return {
    from: input.from,
    to: input.to,
    subject: "Confirmez votre inscription à Libre IA",
    text: [
      "Bonjour,",
      "",
      "Vous avez demandé à rejoindre la liste d'attente de Libre IA.",
      "Pour confirmer, ouvrez ce lien dans les 48 heures :",
      input.confirmUrl,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :",
      "sans confirmation, votre adresse sera effacée.",
      "",
      "Pour quitter la liste à tout moment :",
      input.unsubscribeUrl,
      "",
      "Libre IA, ce que chacun réinvente seul, faisons-le ensemble.",
      "",
    ].join("\n"),
    headers: {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function headerValue(value: string): string {
  // A CR or LF would end the header and let the value add its own headers or recipients.
  if (/[\r\n]/.test(value)) throw new Error("mail.header_injection");
  return value;
}

const encodeWord = (value: string): string =>
  `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;

const rfc5322Date = (date: Date): string => date.toUTCString().replace(/ GMT$/, " +0000");

export function toRfc5322(message: MailMessage, date: Date, messageId: string): string {
  const headers: [string, string][] = [
    ["From", message.from],
    ["To", message.to],
    ["Subject", encodeWord(message.subject)],
    ["Date", rfc5322Date(date)],
    ["Message-ID", messageId],
    ["MIME-Version", "1.0"],
    ["Content-Type", "text/plain; charset=utf-8"],
    ["Content-Transfer-Encoding", "8bit"],
    ...Object.entries(message.headers),
  ];
  const head = headers.map(([name, value]) => `${name}: ${headerValue(value)}`).join("\r\n");
  const body = message.text.replace(/\r?\n/g, "\r\n");
  return `${head}\r\n\r\n${body}`;
}
