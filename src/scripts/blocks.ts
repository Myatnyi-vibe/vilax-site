// Блоки платформы (прототип: tabs, feat, featHover). Снимок — строго своего сочетания валюта × язык × тема:
// функция → снимок блока → первая функция со снимком, всё в том же сочетании; функции без снимка — не кнопки (Р-22).
import { axes, onAxes, shotCode, shotUrl, type Axes, type PageData } from './state';

export function initBlocks(D: PageData) {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));
  if (!tabs.length) return null;
  const blockShots: Record<string, Record<string, string>> = JSON.parse(document.querySelector('[data-block-shots]')?.textContent || '{}');
  const keys = tabs.map((t) => t.dataset.tab!);
  let tab = keys[0];
  let feat = -1;
  let featHover: number | null = null;

  /** Список функций активного сочетания в панели (обёртка .v своего валюта × язык). */
  const featList = (panel: HTMLElement, a: Axes) => panel.querySelector<HTMLElement>(`.v[data-cur="${a.cur}"][data-lang="${a.lang}"]`);
  const items = (panel: HTMLElement, a: Axes) => Array.from(featList(panel, a)?.querySelectorAll<HTMLElement>('.bl__li') ?? []);
  const has = (a: Axes, id: string | undefined) => !!id && shotCode(D, a, id) !== '0';

  function render() {
    const a = axes();
    tabs.forEach((t, i) => {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    const panel = panels[keys.indexOf(tab)];
    const lis = items(panel, a);
    lis.forEach((li, i) => {
      const shot = has(a, li.dataset.screen);
      li.classList.toggle('is-shot', shot);
      li.classList.toggle('is-open', featHover === i);
      const b = li.querySelector('button');
      b?.setAttribute('aria-pressed', String(feat === i));
      b?.setAttribute('aria-expanded', String(featHover === i));
    });
    const af = feat >= 0 ? lis[feat] : null;
    const bshot = blockShots[a.cur]?.[tab];
    const id =
      (af && has(a, af.dataset.screen) ? af.dataset.screen : '') ||
      (has(a, bshot) ? bshot : '') ||
      lis.map((li) => li.dataset.screen).find((s) => has(a, s)) ||
      '';
    panel.classList.toggle('has-shot', !!id);
    const fig = panel.querySelector<HTMLElement>('.bl__fig')!;
    const img = fig.querySelector<HTMLImageElement>('[data-shot-img]')!;
    const ph = fig.querySelector<HTMLElement>('[data-shot-ph]')!;
    fig.hidden = !id;
    if (!id) return;
    const title = (af?.querySelector<HTMLElement>('.bl__ft')?.innerText || panel.querySelector('h3')?.innerText || '').trim();
    if (shotCode(D, a, id) === 'p') {
      img.removeAttribute('src');
      ph.hidden = false;
      ph.textContent = `${a.cur}/${a.lang}/${a.theme}/${id}`;
    } else {
      ph.hidden = true;
      const src = shotUrl(D, a, id);
      if (img.getAttribute('src') !== src) img.src = src;
    }
    img.alt = D.ui[a.lang].shotAlt.replace('{title}', title);
  }

  function select(k: string, focus = false) {
    tab = k;
    feat = -1;
    featHover = null;
    render();
    if (focus) document.getElementById(`tab-${k}`)?.focus();
  }

  tabs.forEach((t) => {
    t.addEventListener('click', () => select(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      const n = keys.length;
      let k = keys.indexOf(tab);
      if (e.key === 'ArrowRight') k = (k + 1) % n;
      else if (e.key === 'ArrowLeft') k = (k - 1 + n) % n;
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = n - 1;
      else return;
      e.preventDefault();
      select(keys[k], true);
    });
  });

  // функции: наведение/фокус раскрывает и меняет снимок, уход сворачивает (снимок остаётся), клик — закрепляет
  panels.forEach((panel) =>
    panel.querySelectorAll<HTMLElement>('.bl__li').forEach((li) => {
      const i = Number(li.dataset.fi);
      const enter = () => {
        const shot = has(axes(), li.dataset.screen);
        if (featHover !== i || (shot && feat !== i)) {
          featHover = i;
          if (shot) feat = i;
          render();
        }
      };
      const leave = () => {
        if (featHover === i) {
          featHover = null;
          render();
        }
      };
      li.addEventListener('mouseenter', enter);
      li.addEventListener('mouseleave', leave);
      const b = li.querySelector('button')!;
      b.addEventListener('focus', enter);
      b.addEventListener('blur', leave);
      b.addEventListener('click', () => {
        if (feat !== i || featHover !== i) {
          feat = i;
          featHover = i;
          render();
        }
      });
    }),
  );

  onAxes(() => render());
  render();
  return { openTab: (k: string) => select(k) };
}
