# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [semantic versioning](https://semver.org/).

## [1.0.0] — unreleased

First public release.

### Added
- Replace visible text, input placeholders, tooltips (`title`) and `aria-label`s on
  websites the user enables, one website at a time via optional host permissions.
- Unlimited wording variants per table, switched live without reloading the page.
- Rules per page, with numeric and UUID segments in addresses matched as `:id`.
- Placeholders such as `{n} items`.
- Import from `.xlsx`, `.csv` or a shared Google Sheet, each with a validation report
  listing duplicates, mismatched placeholders and entries not seen on any page.
- Automatic collecting of page texts while browsing, plus export to Excel and CSV.
- Highlight mode for replaced, empty and unknown texts.
- Test links via `?_variant=…`.
- Interface in English and German.
