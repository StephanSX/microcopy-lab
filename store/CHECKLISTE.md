# Veröffentlichung im Chrome Web Store – Checkliste

## Einmalig
- [ ] Entwicklerkonto registrieren: https://chrome.google.com/webstore/devconsole (einmalige Gebühr, Google-Konto mit **2-Faktor-Authentifizierung** nötig)
- [ ] **Händlerstatus (Trader)** angeben: Als Firma (z.B. Weibel Consulting / Sense Xtend GmbH) «Trader» wählen – dann werden Adresse, E-Mail und Telefon im Store angezeigt (EU-Vorgabe, DSA)
- [ ] Kontakt-E-Mail im Dashboard bestätigen
- [ ] Name prüfen: «Microcopy Lab» im Store und als Marke suchen (Name ist in `_locales/*/messages.json` → `extName` und im Manifest `short_name` änderbar)

## Datenschutzerklärung
- [ ] Platzhalter in `PRIVACY.md` und `docs/privacy.html` ausfüllen: Strasse, PLZ, Kontakt-E-Mail
- [ ] GitHub Pages einschalten: Repository → Settings → Pages → Source «Deploy from a branch», Branch `main`, Ordner `/docs`
- [ ] Prüfen, dass https://stephansx.github.io/microcopy-lab/privacy.html erreichbar ist

## Upload
- [ ] Paket bauen (`npm run build`) und `microcopy-lab.zip` im Dashboard hochladen (nicht entpacken)
- [ ] **Store-Eintrag**: Texte aus `STORE-LISTING.md` (Englisch als Standard, Deutsch als zusätzliche Sprache)
- [ ] Symbol 128×128 ist im Paket; Screenshots 1280×800 aus `screenshots-en` bzw. `screenshots-de` hochladen (1–5 Stück)
- [ ] Kleine Werbekachel 440×280: `store/screenshots-en/promo-tile-440x280.png`
- [ ] Kategorie: Developer Tools
- [ ] **Datenschutz-Tab**: Einzelzweck, Berechtigungsbegründungen, «kein Remote-Code», Datennutzung laut `STORE-LISTING.md`, URL der Datenschutzerklärung
- [ ] **Test-Anleitung** für Prüfer (Abschnitt «Test instructions for reviewers») einfügen und `reviewer-sample-example-com.csv` bereithalten
- [ ] Sichtbarkeit wählen: Öffentlich · Nicht gelistet (nur mit Link) · Privat (Testgruppe)
- [ ] Einreichen – Prüfung dauert meist wenige Tage

## Vor jedem Update
- [ ] Version in `extension/manifest.json` und `package.json` erhöhen, `CHANGELOG.md` ergänzen, Git-Tag setzen
- [ ] Bei geänderter Datennutzung: Datenschutzerklärung und Datenschutz-Tab anpassen und Nutzer informieren

## Tipp
Für interne Tests zuerst **«Nicht gelistet»** veröffentlichen – der Link funktioniert sofort nach der Freigabe, die Erweiterung erscheint aber nicht in der Suche.
