// Адреса и якоря сайта — одно место для шапки, подвала, карты сайта и экрана выбора.
import type { Lang } from '../i18n';
import type { LegalDoc } from './legal';

/** Подпуть сборки (base в astro.config): '' на vilax.ai, '/vilax-site' на превью в GitHub Pages. */
export const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
/** Адрес от корня сайта с учётом подпути: url('/ru/') → '/vilax-site/ru/' на превью и '/ru/' на vilax.ai. */
export function url(path: string): string {
  return path.startsWith('/') ? BASE + path : path;
}
/** Хост сборки без пути: https://vilax.ai или хост превью. Полный адрес — SITE_URL + url(путь). */
export const SITE_URL = (import.meta.env?.SITE ?? 'https://vilax.ai').replace(/\/+$/, '');
export const APP_URL = 'https://app.vilax.ai';
export const SUPPORT_EMAIL = 'support@vilax.ai';

/** Ключ выбора версии (региона) в localStorage (экран выбора и страницы версий). */
export const VERSION_KEY = 'vilax.version';
/** Тип бизнеса. independent — своё заведение (1–9), chain — сеть. */
export type Segment = 'independent' | 'chain';
/**
 * Тип бизнеса задаётся регионом (решение Данила 12.10.2026, coord.md 16:45): РФ продаём только сетям,
 * ОАЭ — владельцам 1–9 своих заведений. Отдельного выбора типа нет, /ru/ = сеть, /en/ = 1–9.
 */
export const REGION_SEGMENT: Record<Lang, Segment> = { ru: 'chain', en: 'independent' };
/** Ключ типа бизнеса в localStorage — копия значения из региона для чтения формой (своего выбора нет). */
export const SEGMENT_KEY = 'vilax.segment';
/** «Сменить»: экран выбора региона без автоперехода в запомненную версию. */
export const CHOOSE_HREF = url('/#choose');

/** Якоря секций в меню: Платформа · Цены · Подключение · Вопросы. */
export const NAV_SECTIONS = ['platform', 'pricing', 'onboarding', 'faq'] as const;
export type NavSection = (typeof NAV_SECTIONS)[number];

export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'support', 'consent'];

export function homePath(lang: Lang): string {
  return url(`/${lang}/`);
}

/** Правовые страницы живут по прежним адресам: английские — в корне, русские — под /ru/.
 *  Согласие на обработку данных — новая страница у каждой версии: /ru/consent и /en/consent. */
export function legalPath(lang: Lang, doc: LegalDoc): string {
  if (doc === 'consent') return url(`/${lang}/consent`);
  return url(lang === 'ru' ? `/ru/${doc}` : `/${doc}`);
}

/**
 * Ролик «МоушенПро» на обложке (SITE-10). false — на месте ролика только кадр-обложка (до «да» владельца по роликам),
 * true — ролик играет по кругу без звука. Файлы — public/video/hero-<lang>-<16x9|9x16>.{mp4,webm,avif,webp}.
 */
export const HERO_VIDEO = true;
