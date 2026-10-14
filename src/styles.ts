const SITE_CSS = `
body {
  overflow-x: hidden;
}

.site-header,
.site-footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lai-space-4) var(--lai-space-8);
  align-items: center;
  justify-content: space-between;
  padding-block: var(--lai-space-6);
}

.site-header nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lai-space-4);
}

.wordmark {
  color: var(--lai-color-ink);
  font-size: 1.15rem;
  font-weight: 800;
  text-decoration: none;
}

.hero {
  display: grid;
  gap: var(--lai-space-6);
  min-height: min(48rem, 82vh);
  align-content: center;
  padding-block: var(--lai-space-12);
}

.hero h1 {
  max-width: 11ch;
  margin: 0;
  font-size: clamp(3rem, 10vw, 8rem);
  letter-spacing: -0.055em;
  line-height: 0.88;
}

.tension,
.section-index {
  margin: 0;
  color: var(--lai-color-muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.lede {
  margin: 0;
  font-size: clamp(1.1rem, 2.3vw, 1.55rem);
}

.qualification {
  max-width: 58ch;
  color: var(--lai-color-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lai-space-4);
  align-items: center;
}

.primary-action {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  padding: var(--lai-space-3) var(--lai-space-4);
  border: 0.12rem solid var(--lai-color-accent);
  color: var(--lai-color-on-accent);
  background: var(--lai-color-accent);
  font-weight: 750;
  text-decoration: none;
}

.provenance {
  padding-block: var(--lai-space-4);
  border-block: 0.1rem solid var(--lai-color-border);
  color: var(--lai-color-muted);
}

.section {
  display: grid;
  gap: var(--lai-space-6);
  padding-block: clamp(4rem, 9vw, 8rem);
}

.section > h1,
.section > h2 {
  max-width: 18ch;
  margin: 0;
  font-size: clamp(2rem, 5vw, 4.5rem);
  letter-spacing: -0.04em;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--lai-space-4);
}

.evidence,
.product-card {
  display: grid;
  gap: var(--lai-space-3);
}

.evidence dl {
  display: grid;
  gap: var(--lai-space-2);
  margin: 0;
}

.evidence dl > div {
  display: grid;
  grid-template-columns: minmax(7rem, 0.35fr) 1fr;
  gap: var(--lai-space-3);
}

.evidence dt {
  color: var(--lai-color-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.evidence dd {
  margin: 0;
}

.product-group {
  display: grid;
  gap: var(--lai-space-4);
}

.factory {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 0;
  margin: 0;
  list-style: none;
  counter-reset: factory;
}

.factory li {
  display: grid;
  gap: var(--lai-space-4);
  min-height: 14rem;
  align-content: space-between;
  padding: var(--lai-space-4);
  border-block-start: 0.1rem solid var(--lai-color-border);
  border-inline-end: 0.1rem solid var(--lai-color-border);
  counter-increment: factory;
}

.factory li::before {
  color: var(--lai-color-accent);
  content: "0" counter(factory);
  font-weight: 800;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--lai-space-3);
  border-block-end: 0.1rem solid var(--lai-color-border);
  text-align: start;
  vertical-align: top;
}

thead th {
  color: var(--lai-color-muted);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.contribution {
  background: var(--lai-color-surface);
}

.brand-mark {
  width: clamp(4rem, 12vw, 9rem);
  color: var(--lai-color-ink);
}

.brand-mark--guide {
  display: block;
  margin-block: var(--lai-space-8);
}

.pending {
  padding: var(--lai-space-4);
  border-inline-start: 0.3rem solid var(--lai-color-accent);
  background: var(--lai-color-surface);
  font-weight: 700;
}

@media (max-width: 42rem) {
  .site-header {
    align-items: flex-start;
  }

  .site-header nav {
    width: 100%;
  }

  .factory {
    grid-template-columns: 1fr;
  }

  .factory li {
    min-height: 8rem;
    border-inline-end: 0;
  }

  .evidence dl > div {
    grid-template-columns: 1fr;
    gap: var(--lai-space-1);
  }
}

/* Type scale: body 1rem, section 1.375rem, page title 2rem. A flat scale reads as one level of text. */
body {
  font-size: 1rem;
  line-height: 1.55;
  max-width: 40rem;
  margin-inline: auto;
  padding: var(--lai-space-4, 1rem);
}

h1 {
  font-size: 2rem;
  line-height: 1.2;
  margin-block: 1rem 0.75rem;
}

h2 {
  font-size: 1.375rem;
  line-height: 1.3;
  margin-block: 1.5rem 0.5rem;
}

/* The proofs table and long commands must wrap, never widen the page (FR-06 at 360 px). */
table {
  width: 100%;
  border-collapse: collapse;
}

code {
  overflow-wrap: anywhere;
}

/* Identifiers and dates stay on one line; the browser may not split them at a hyphen. */
.nowrap {
  white-space: nowrap;
}

/* Brand grammar (ADR 0002): an open frame around each item, square corners (orthogonal joint),
   a status label that carries its meaning in words, and a rule that marks each assembly line. */
.site-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding-block-end: 0.75rem;
  border-block-end: 1px solid var(--lai-color-border-subtle);
}

.wordmark {
  font-weight: 700;
  color: var(--lai-color-text-primary);
  text-decoration: none;
}

.frame {
  border: 1px solid var(--lai-color-border-default);
  border-radius: 0;
  padding: 0.5rem 0.75rem;
  margin-block-end: 0.5rem;
  list-style: none;
}

/* A list made of frames starts on the text column, not indented like a bullet list. */
ul:has(> .frame) {
  padding-inline-start: 0;
}

.label {
  display: inline-block;
  border: 1px solid var(--lai-color-border-default);
  border-radius: 0;
  padding: 0 0.4rem;
  font-size: 0.875rem;
}

h2 {
  border-block-start: 1px solid var(--lai-color-border-subtle);
  padding-block-start: 1rem;
}

/* Motion: colour transitions only, switched off for users who ask for reduced motion. */
a {
  transition: color 0.15s ease;
}

@media (prefers-reduced-motion: reduce) {
  a {
    transition: none;
  }
}

/* Narrow screens: each proof row becomes a block that names its own columns, so no header breaks mid-word. */
@media (max-width: 40rem) {
  thead {
    display: none;
  }
  table,
  tbody,
  tr,
  td {
    display: block;
    width: 100%;
  }
  tr {
    border-block-end: 1px solid var(--lai-color-border-subtle);
    padding-block: 0.5rem;
  }
  td::before {
    content: attr(data-label) " : ";
    font-weight: 600;
  }
}
`;

export function renderSiteCss(): string {
  return SITE_CSS.trimStart();
}
