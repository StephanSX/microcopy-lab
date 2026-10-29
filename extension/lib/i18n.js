/* Microcopy Lab – translation helper (uses _locales via chrome.i18n) */
(function (root) {
  'use strict';

  function raw(key) {
    try {
      if (root.chrome && root.chrome.i18n && root.chrome.i18n.getMessage) return root.chrome.i18n.getMessage(key) || '';
    } catch (e) { /* context invalidated */ }
    return '';
  }

  /** t('key', a, b) – replaces {0}, {1} … */
  function t(key, ...args) {
    const s = raw(key) || key;
    return s.replace(/\{(\d)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m));
  }

  /** Applies data-i18n, data-i18n-html, data-i18n-placeholder, data-i18n-title, data-i18n-aria */
  function apply(scope) {
    const r = scope || document;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    r.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    r.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    const lang = raw('@@ui_locale');
    if (lang && r.documentElement) r.documentElement.lang = lang.split('_')[0];
  }

  function locale() {
    return (raw('@@ui_locale') || 'en').replace('_', '-');
  }

  root.I18N = { t, apply, locale };
})(typeof globalThis !== 'undefined' ? globalThis : self);
