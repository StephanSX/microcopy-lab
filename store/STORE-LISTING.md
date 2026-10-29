# Microcopy Lab – Chrome Web Store listing

Copy these texts into the Developer Dashboard. Store listing → default language English, add German as additional language.

---

## English (default)

**Name** (from manifest): Microcopy Lab – Text variants for UX tests

**Summary** (from manifest, max. 132 characters):
Swap labels, titles and button texts on any website from a spreadsheet to test wording variants in usability tests.

**Category:** Developer Tools  *(alternative: Productivity → Workflow & Planning)*

**Description:**

Test wording in your real product – without touching code.

Microcopy Lab replaces titles, labels, buttons, placeholders and tooltips on a website according to a simple table. Prepare as many wording variants as you like and switch between them live – ideal for usability tests, UX writing reviews, stakeholder demos and localisation checks.

HOW IT WORKS
1. Open your website (also web apps behind a login) and enable Microcopy Lab for it.
2. Click through the pages – all texts are collected automatically.
3. Export them as Excel/CSV, add columns for your variants (A, B, "Short", "Friendly" …).
4. Import the file – or link a Google Sheet – and pick a variant in the popup.

FEATURES
• Works on any website you enable – including single-page apps (React, Angular, Vue …)
• Unlimited variants per table, switch live without reloading
• Page-specific rules (e.g. only on /settings) and placeholders like {n} items
• Replaces visible text, input placeholders, tooltips and accessibility labels
• Import from .xlsx, .csv or a shared Google Sheet, with a validation report
• Highlight mode shows replaced, empty and unknown texts
• Test links: add ?_variant=B to a URL to open a variant directly
• English and German interface

PRIVACY
No account, no server, no tracking. Tables, settings and collected texts are stored only in your browser. The extension only runs on websites you enable yourself and only downloads a table from an address you enter.

Note: Changes are visible only in your own browser – nothing is changed on the website itself.

---

## Deutsch

**Name:** Microcopy Lab – Textvarianten für UX-Tests

**Kurzbeschreibung:**
Ersetzt Beschriftungen, Titel und Buttontexte auf beliebigen Websites nach einer Tabelle – für Usability-Tests mit Textvarianten.

**Beschreibung:**

Formulierungen im echten Produkt testen – ohne Code anzufassen.

Microcopy Lab ersetzt Titel, Beschriftungen, Buttons, Platzhalter und Tooltips auf einer Website nach einer einfachen Tabelle. Bereite beliebig viele Textvarianten vor und wechsle live zwischen ihnen – ideal für Usability-Tests, UX-Writing-Reviews, Demos und Übersetzungsprüfungen.

SO FUNKTIONIERT ES
1. Website öffnen (auch Web-Apps mit Login) und Microcopy Lab dafür aktivieren.
2. Durch die Seiten klicken – alle Texte werden automatisch gesammelt.
3. Als Excel/CSV exportieren und Spalten für Varianten ergänzen (A, B, «Kurz», «Freundlich» …).
4. Datei importieren – oder ein Google Sheet verknüpfen – und im Popup eine Variante wählen.

FUNKTIONEN
• Läuft auf jeder Website, die du aktivierst – auch in Single-Page-Apps (React, Angular, Vue …)
• Beliebig viele Varianten pro Tabelle, Wechsel ohne Neuladen
• Regeln pro Seite (z.B. nur unter /settings) und Platzhalter wie {n} Geräte
• Ersetzt sichtbare Texte, Platzhalter in Eingabefeldern, Tooltips und Screenreader-Beschriftungen
• Import aus .xlsx, .csv oder freigegebenem Google Sheet, mit Prüfbericht
• Markier-Modus zeigt ersetzte, leere und unbekannte Texte
• Test-Links: ?_variant=B an die Adresse anhängen öffnet direkt eine Variante
• Oberfläche auf Deutsch und Englisch

DATENSCHUTZ
Kein Konto, kein Server, kein Tracking. Tabellen, Einstellungen und gesammelte Texte bleiben ausschliesslich in deinem Browser. Die Erweiterung läuft nur auf Websites, die du selbst aktivierst, und lädt nur eine Tabelle von einer Adresse herunter, die du eingibst.

Hinweis: Änderungen sind nur in deinem eigenen Browser sichtbar – an der Website selbst wird nichts verändert.

---

## Privacy practices tab (Datenschutz-Tab im Dashboard)

**Single purpose description:**
Replace user-selected interface texts on websites the user enables with wording variants from a user-provided table, so that wording can be tested in usability tests.

**Permission justifications:**
- `storage`: Stores the user's imported text tables, per-website settings and the list of collected page texts locally in the browser.
- `scripting`: Registers the content script only for websites the user has enabled, and injects it into already open tabs of such a website right after the user enables it.
- `activeTab`: Reads the URL of the current tab when the user opens the popup, so the extension can offer to enable itself for that website.
- Optional host permissions (`https://*/*`, `http://*/*`): Requested at runtime for one website at a time, only after the user clicks "Enable on <website>". Needed to read and replace texts on that website. Also requested for docs.google.com / *.googleusercontent.com only when the user links a Google Sheet, to download that table.

**Remote code:** No, I am not using remote code. (All JavaScript is included in the package.)

**Data usage:** Tick **"Website content"** (texts of pages the user enables are read and stored locally). Do not tick anything else.
Then certify:
- I do not sell or transfer user data to third parties, outside of the approved use cases ✔
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose ✔
- I do not use or transfer user data to determine creditworthiness or for lending purposes ✔

> Note: Chrome's definition of "collection" refers to data leaving the device. Microcopy Lab keeps everything local; declaring "Website content" is the conservative choice because the extension reads and stores page text. The privacy policy explains that nothing is transmitted.

**Privacy policy URL:** `https://stephansx.github.io/microcopy-lab/privacy.html`

**Homepage URL** (optional): `https://stephansx.github.io/microcopy-lab/`

**Support URL** (optional): `https://github.com/StephanSX/microcopy-lab/issues`

---

## Test instructions for reviewers

1. Install the extension and open https://example.com.
2. Click the extension icon → "Enable on example.com" → allow.
3. Click "Import, export & settings", drop the attached file `reviewer-sample-example-com.csv` onto the import area and click "Apply".
4. Open the popup again and choose variant "A": the heading "Example Domain" changes to "Sample Site" immediately. Choose "Original" to switch back.
5. Optional: tick "Highlight texts" to see replaced (green) and unknown (yellow) texts. "Export Excel" downloads the table incl. collected texts.
No login or account is required.
