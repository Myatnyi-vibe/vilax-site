// Разметка schema.org для версий сайта. Без цен: цены живут в справочнике и меняются отдельно.
import type { Lang } from '../i18n';
import { BASE, SITE_URL, SUPPORT_EMAIL, homePath, url } from './site';

export function organizationLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VILAX',
    url: SITE_URL + BASE,
    logo: SITE_URL + url('/apple-touch-icon.png'),
    email: SUPPORT_EMAIL,
  };
}

export function softwareLd(lang: Lang, description: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VILAX',
    url: `${SITE_URL}${homePath(lang)}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    inLanguage: lang,
    description,
  };
}
