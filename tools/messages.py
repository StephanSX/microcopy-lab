# Source of truth for _locales – run: python3 tools/messages.py
import json, os, sys

M = {
 'extName': ('Microcopy Lab – Text variants for UX tests', 'Microcopy Lab – Textvarianten für UX-Tests'),
 'extDescription': ('Swap labels, titles and button texts on any website from a spreadsheet to test wording variants in usability tests.',
                    'Ersetzt Beschriftungen, Titel und Buttontexte auf beliebigen Websites nach einer Tabelle – für Usability-Tests mit Textvarianten.'),

 'popupToggleTitle': ('Turn replacements on/off', 'Ersetzen ein/aus'),
 'popupUnsupported': ('Microcopy Lab cannot run on this page (e.g. browser pages or the Web Store).', 'Auf dieser Seite kann Microcopy Lab nicht laufen (z.B. Browser-Seiten oder der Web Store).'),
 'popupInactive': ('Microcopy Lab is not active on this website yet.', 'Microcopy Lab ist auf dieser Website noch nicht aktiv.'),
 'popupEnableOn': ('Enable on {0}', 'Auf {0} aktivieren'),
 'popupPermissionHint': ('Chrome will ask for permission to read and change pages on this website. Nothing is sent anywhere – everything stays in your browser.',
                         'Chrome fragt nach der Berechtigung, Seiten dieser Website zu lesen und zu ändern. Es wird nichts gesendet – alles bleibt in deinem Browser.'),
 'popupVariant': ('Variant', 'Variante'),
 'popupNoTable': ('No table imported yet – open the manager to import one.', 'Noch keine Tabelle – in der Verwaltung importieren.'),
 'popupThisPage': ('This page', 'Diese Seite'),
 'statReplaced': ('replaced', 'ersetzt'),
 'statEmpty': ('no text in variant', 'ohne Text in Variante'),
 'statUnknown': ('not in table', 'nicht in Tabelle'),
 'popupHighlight': ('Highlight texts', 'Texte markieren'),
 'legendOk': ('replaced', 'ersetzt'),
 'legendEmpty': ('no variant', 'ohne Variante'),
 'legendUnknown': ('unknown', 'unbekannt'),
 'popupCollect': ('Collect texts on this page', 'Texte dieser Seite sammeln'),
 'popupCollected': ('Collected {0} texts on {1}, {2} new.', '{0} Texte auf {1} gesammelt, davon {2} neu.'),
 'popupRefreshSheet': ('Reload table from Google Sheet', 'Tabelle aus Google Sheet neu laden'),
 'popupManage': ('Import, export & settings', 'Import, Export & Verwaltung'),
 'popupReloadPage': ('Please reload the page once and try again.', 'Bitte die Seite einmal neu laden und erneut versuchen.'),
 'popupTableInfo': ('{0} entries · {1} variants · {2}', '{0} Einträge · {1} Varianten · {2}'),
 'variantOriginal': ('Original', 'Original'),
 'permDenied': ('Permission was not granted.', 'Die Berechtigung wurde nicht erteilt.'),

 'sheetLoading': ('Loading …', 'Lade …'),
 'sheetUpdated': ('Table updated: {0} entries.', 'Tabelle aktualisiert: {0} Einträge.'),
 'sheetUpdatedWarn': ('Table updated: {0} entries, {1} warnings (details in the manager).', 'Tabelle aktualisiert: {0} Einträge, {1} Warnungen (Details in der Verwaltung).'),
 'sheetErrorPrefix': ('Google Sheet: {0}', 'Google Sheet: {0}'),
 'errNoSheetUrl': ('No sheet address saved.', 'Keine Sheet-Adresse hinterlegt.'),
 'errSheetPermission': ('Permission to download the table is missing. Please click “Load” in the manager again.', 'Die Berechtigung zum Herunterladen fehlt. Bitte in der Verwaltung erneut auf «Laden» klicken.'),
 'errSheetStatus': ('Server responded with status {0}. Is the sheet shared with “Anyone with the link”?', 'Der Server antwortet mit Status {0}. Ist das Sheet für «Alle mit dem Link» freigegeben?'),
 'errSheetHtml': ('A web page came back instead of a table (usually a sign-in page). Share the sheet with “Anyone with the link” or publish it to the web as CSV.',
                  'Statt einer Tabelle kam eine Webseite zurück (meist eine Anmeldeseite). Sheet für «Alle mit dem Link» freigeben oder als CSV im Web veröffentlichen.'),
 'errXls': ('The old .xls format is not supported – please save as .xlsx or CSV.', 'Das alte .xls-Format wird nicht unterstützt – bitte als .xlsx oder CSV speichern.'),
 'errXlsxInvalid': ('Not a valid XLSX file.', 'Keine gültige XLSX-Datei.'),
 'errXlsxCorrupt': ('The XLSX file is damaged.', 'Die XLSX-Datei ist beschädigt.'),
 'errXlsxCompression': ('Unsupported compression in XLSX file.', 'Nicht unterstützte Komprimierung in der XLSX-Datei.'),
 'errXlsxXml': ('The XLSX file could not be read.', 'Die XLSX-Datei konnte nicht gelesen werden.'),
 'errXlsxSheet': ('No worksheet found in XLSX file.', 'Kein Tabellenblatt in der XLSX-Datei gefunden.'),

 'repNoOriginal': ('No “original” column found. The header row needs at least “original” and one variant column.', 'Keine Spalte «original» gefunden. Die Kopfzeile braucht mindestens «original» und eine Variantenspalte.'),
 'repDupColumn': ('Column “{0}” appears twice – only the first one is used.', 'Spalte «{0}» kommt doppelt vor – nur die erste wird verwendet.'),
 'repNoVariants': ('No variant column found (e.g. “A”, “B”). The table will be imported but won’t replace anything.', 'Keine Variantenspalte gefunden (z.B. «A», «B»). Die Tabelle wird übernommen, ersetzt aber nichts.'),
 'repUnknownType': ('Row {0}: unknown type “{1}” – treated as “text”.', 'Zeile {0}: unbekannter Typ «{1}» – als «text» behandelt.'),
 'repDuplicate': ('Row {0}: “{1}” ({2}, {3}) is a duplicate – row {4} applies.', 'Zeile {0}: «{1}» ({2}, {3}) doppelt – Zeile {4} gilt.'),
 'repPlaceholder': ('Row {0}: placeholders in variant {1} don’t match the original (“{2}” → “{3}”).', 'Zeile {0}: Platzhalter in Variante {1} passen nicht zum Original («{2}» → «{3}»).'),
 'repSkipped': ('{0} rows without original text skipped.', '{0} Zeilen ohne Originaltext übersprungen.'),
 'repUnseen': ('{0} entries have not been seen on any page yet (page not visited yet, or a typo?).', '{0} Einträge bisher auf keiner Seite gefunden (Seite noch nicht besucht oder Tippfehler?).'),
 'repUnseenExamples': ('Examples not seen: {0}', 'Beispiele nicht gefunden: {0}'),
 'repErrorsTitle': ('Errors – the table cannot be applied', 'Fehler – Tabelle kann nicht übernommen werden'),
 'repWarningsTitle': ('Warnings', 'Warnungen'),
 'repInfosTitle': ('Notes', 'Hinweise'),
 'repAllGood': ('No problems found.', 'Keine Probleme gefunden.'),
 'repMore': ('… and {0} more', '… und {0} weitere'),
 'repMoreRows': ('… {0} more rows', '… {0} weitere Zeilen'),
 'kpiRows': ('entries', 'Einträge'),
 'kpiVariants': ('variants', 'Varianten'),
 'kpiWarnings': ('warnings', 'Warnungen'),
 'kpiUnseen': ('not seen', 'nicht gefunden'),
 'eqOriginal': ('= original', '= Original'),
 'foundYes': ('yes', 'ja'),
 'foundNo': ('no', 'nein'),
 'foundNew': ('new', 'neu'),

 'optTagline': ('Test wording variants on any website – driven by a simple table.', 'Textvarianten auf beliebigen Websites testen – gesteuert über eine einfache Tabelle.'),
 'optWelcome': ('<b>Installed.</b> Open the website you want to test, click the Microcopy Lab icon and choose <i>Enable</i>. Browse through the pages – texts are collected automatically. Then export them here, add your variants and import the file again.',
                '<b>Installiert.</b> Öffne die Website, die du testen willst, klicke auf das Microcopy-Lab-Symbol und wähle <i>Aktivieren</i>. Klicke dich durch die Seiten – Texte werden automatisch gesammelt. Danach hier exportieren, Varianten eintragen und die Datei wieder importieren.'),
 'optWebsite': ('Website', 'Website'),
 'optAddSitePlaceholder': ('https://app.example.com', 'https://app.beispiel.ch'),
 'optAddSite': ('Add website', 'Website hinzufügen'),
 'optInvalidUrl': ('Please enter a valid web address (https://…).', 'Bitte eine gültige Webadresse eingeben (https://…).'),
 'optEmptyTitle': ('No website enabled yet', 'Noch keine Website aktiviert'),
 'optEmptyText': ('Open the website you want to test and click the Microcopy Lab icon in the toolbar, or add the address above. Microcopy Lab only runs on websites you enable.',
                  'Öffne die Website, die du testen willst, und klicke in der Symbolleiste auf das Microcopy-Lab-Symbol – oder trage die Adresse oben ein. Microcopy Lab läuft nur auf Websites, die du aktivierst.'),
 'optPermMissing': ('Chrome no longer has permission for this website, so nothing is replaced.', 'Chrome hat keine Berechtigung mehr für diese Website – es wird nichts ersetzt.'),
 'optRegrant': ('Grant again', 'Erneut erlauben'),
 'optImportTitle': ('1 · Import table', '1 · Tabelle importieren'),
 'optDrop': ('Drop an Excel or CSV file here', 'Excel- oder CSV-Datei hierher ziehen'),
 'optDropFormats': ('.xlsx · .csv (semicolon, comma or tab)', '.xlsx · .csv (Semikolon, Komma oder Tab)'),
 'optPickFile': ('Choose file …', 'Datei wählen …'),
 'optSheetLabel': ('or a Google Sheet (shared with “Anyone with the link”) or CSV address', 'oder Google Sheet (freigegeben für «Alle mit dem Link») bzw. CSV-Adresse'),
 'optLoad': ('Load', 'Laden'),
 'optAutoRefresh': ('reload automatically when the website is opened', 'beim Öffnen der Website automatisch neu laden'),
 'optCurrentTable': ('Current table', 'Aktuelle Tabelle'),
 'optCurrentSummary': ('{0} entries · {1} · imported {2}', '{0} Einträge · {1} · importiert {2}'),
 'optFromFile': ('file “{0}”', 'Datei «{0}»'),
 'optVariantsCount': ('Filled per variant –', 'Ausgefüllt pro Variante –'),
 'optNoTable': ('No table imported yet.', 'Noch keine Tabelle importiert.'),
 'optClearTable': ('Remove table', 'Tabelle entfernen'),
 'optClearTableConfirm': ('Remove the current table? The website will show its original texts again.', 'Aktuelle Tabelle entfernen? Die Website zeigt danach wieder die Originaltexte.'),
 'optSettings': ('Settings', 'Einstellungen'),
 'optAutoCollect': ('Collect texts automatically while browsing', 'Texte beim Durchklicken automatisch sammeln'),
 'optTestLinks': ('Test links: add <code>?_variant=B</code> to an address to switch to variant B, <code>?_variant=original</code> for the original, <code>?_variant=off</code> to turn replacements off.',
                  'Test-Links: <code>?_variant=B</code> an eine Adresse anhängen schaltet Variante B ein, <code>?_variant=original</code> zeigt das Original, <code>?_variant=off</code> schaltet das Ersetzen aus.'),
 'optRemoveSite': ('Remove website', 'Website entfernen'),
 'optRemoveSiteConfirm': ('Remove {0} including table and collected texts? The permission for this website is revoked as well.', '{0} inklusive Tabelle und gesammelter Texte entfernen? Die Berechtigung für diese Website wird ebenfalls entzogen.'),
 'optReport': ('Validation report', 'Prüfbericht'),
 'optApply': ('Apply', 'Übernehmen'),
 'optDiscard': ('Discard', 'Verwerfen'),
 'optApplyNote': ('Open tabs of this website update immediately.', 'Offene Tabs dieser Website werden sofort aktualisiert.'),
 'optExportTitle': ('2 · Export', '2 · Exportieren'),
 'optExportText': ('Contains the current table plus all collected texts that are still missing (column <code>found</code> = “new”).', 'Enthält die aktuelle Tabelle und alle gesammelten Texte, die noch fehlen (Spalte <code>found</code> = «neu»).'),
 'optExportXlsx': ('Export Excel', 'Excel exportieren'),
 'optExportCsv': ('Export CSV', 'CSV exportieren'),
 'optCollected': ('Collected texts', 'Gesammelte Texte'),
 'optSearch': ('Search …', 'Suchen …'),
 'optClearSeen': ('Clear list', 'Liste leeren'),
 'optClearSeenConfirm': ('Clear the list of collected texts for this website?', 'Liste der gesammelten Texte dieser Website leeren?'),
 'optCollectedHint': ('May contain personal data shown on the page (e.g. names) – review before sharing.', 'Kann personenbezogene Daten der Seite enthalten (z.B. Namen) – vor dem Teilen prüfen.'),
 'optNPages': ('{0} pages', '{0} Seiten'),
 'colText': ('Text', 'Text'),
 'colType': ('Type', 'Typ'),
 'colPages': ('Pages', 'Seiten'),
 'colTable': ('Table', 'Tabelle'),
 'optHelpTitle': ('Table format & tips', 'Tabellenformat & Tipps'),
 'optHelpBody': ('<p>Header row: <code>page</code> · <code>type</code> · <code>original</code> · any number of variant columns (<code>A</code>, <code>B</code>, <code>Short</code> …) · <code>note</code>. Columns <code>found</code>, <code>id</code> and <code>key</code> are ignored. German headers (<code>seite</code>, <code>typ</code>, <code>notiz</code>) work too.</p>'
                 '<p><b>page</b>: <code>*</code> = everywhere, <code>/app</code> = exactly this page, <code>/app/groups/*</code> = including sub-pages. IDs in addresses become <code>:id</code> automatically (e.g. <code>/app/groups/:id/settings</code>). More specific entries win.</p>'
                 '<p><b>type</b>: <code>text</code> (visible), <code>placeholder</code> (input fields), <code>tooltip</code>, <code>aria</code> (screen readers). Empty = text.</p>'
                 '<p><b>Placeholders</b>: <code>{n} devices</code> → <code>{n} sensors</code>. Works for texts that appear as one piece on the page.</p>'
                 '<p><b>Empty cell</b> in a variant = the original text stays.</p>',
                 '<p>Kopfzeile: <code>page</code> · <code>type</code> · <code>original</code> · beliebige Variantenspalten (<code>A</code>, <code>B</code>, <code>Kurz</code> …) · <code>note</code>. Spalten <code>found</code>, <code>id</code> und <code>key</code> werden ignoriert. Deutsche Namen (<code>seite</code>, <code>typ</code>, <code>notiz</code>) funktionieren ebenfalls.</p>'
                 '<p><b>page</b>: <code>*</code> = überall, <code>/app</code> = genau diese Seite, <code>/app/groups/*</code> = inklusive Unterseiten. IDs in Adressen werden automatisch zu <code>:id</code> (z.B. <code>/app/groups/:id/settings</code>). Genauere Einträge haben Vorrang.</p>'
                 '<p><b>type</b>: <code>text</code> (sichtbar), <code>placeholder</code> (Eingabefeld), <code>tooltip</code>, <code>aria</code> (Screenreader). Leer = text.</p>'
                 '<p><b>Platzhalter</b>: <code>{n} Geräte</code> → <code>{n} Sensoren</code>. Gilt für Texte, die als ein Stück auf der Seite stehen.</p>'
                 '<p><b>Leeres Feld</b> in einer Variante = Originaltext bleibt.</p>'),
 'optPrivacyTitle': ('Privacy', 'Datenschutz'),
 'optPrivacyBody': ('<p>Microcopy Lab has no server and no analytics. Tables, settings and collected texts are stored only in this browser (chrome.storage.local) and never leave your device.</p>'
                    '<p>The extension only runs on websites you enable yourself. The only network request it makes is downloading a table from an address you enter (e.g. a Google Sheet) – no data is sent along.</p>'
                    '<p>Removing a website or uninstalling the extension deletes its data.</p>',
                    '<p>Microcopy Lab hat keinen Server und keine Analyse. Tabellen, Einstellungen und gesammelte Texte werden nur in diesem Browser gespeichert (chrome.storage.local) und verlassen dein Gerät nie.</p>'
                    '<p>Die Erweiterung läuft nur auf Websites, die du selbst aktivierst. Die einzige Netzwerkanfrage ist das Herunterladen einer Tabelle von einer Adresse, die du eingibst (z.B. Google Sheet) – dabei werden keine Daten mitgesendet.</p>'
                    '<p>Beim Entfernen einer Website oder beim Deinstallieren werden die zugehörigen Daten gelöscht.</p>'),
}

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'extension', '_locales')
used = set(open(sys.argv[1]).read().split()) if len(sys.argv) > 1 else None
for i, lang in enumerate(['en', 'de']):
    out = {k: {'message': v[i]} for k, v in M.items()}
    for k, v in out.items():
        assert '$' not in v['message'], k
    os.makedirs(os.path.join(root, lang), exist_ok=True)
    with open(os.path.join(root, lang, 'messages.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
if used is not None:
    missing = sorted(used - set(M) - {'key'})
    unused = sorted(set(M) - used - {'extName', 'extDescription'})
    print('missing:', missing)
    print('unused:', unused)
print('ok', len(M))
