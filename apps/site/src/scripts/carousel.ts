/**
 * Spec 0.8a §05. The browser scrolls and snaps (touch, trackpad, mouse wheel). This script adds the
 * buttons, the keys, the counter, the screen name and the progress bar.
 */
export {};

const root = document.querySelector<HTMLElement>('[data-carousel]');
const section = root?.closest('section');
const scroller = root?.querySelector<HTMLElement>('[data-carousel-scroller]');
const prev = section?.querySelector<HTMLButtonElement>('[data-carousel-prev]');
const next = section?.querySelector<HTMLButtonElement>('[data-carousel-next]');
const position = section?.querySelector<HTMLElement>('[data-carousel-count] b');
const bar = section?.querySelector<HTMLElement>('[data-carousel-bar]');
const title = section?.querySelector<HTMLElement>('[data-carousel-name]');

if (root && scroller && prev && next && position && bar && title) {
  const cards = Array.from(scroller.querySelectorAll<HTMLElement>('[data-name]'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = (card: HTMLElement) =>
    card.offsetLeft - Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart);
  let shown = -1;

  const update = () => {
    const x = scroller.scrollLeft;
    const end = scroller.scrollWidth - scroller.clientWidth;
    // `aria-disabled`, not `disabled`: a disabled button drops the focus that it has.
    prev.setAttribute('aria-disabled', String(x <= 1));
    next.setAttribute('aria-disabled', String(x >= end - 1));
    root.classList.toggle('fl', x > 1);
    root.classList.toggle('fr', x < end - 1);
    bar.style.transform = `scaleX(${(x + scroller.clientWidth) / scroller.scrollWidth})`;
    // The counter is a live region: change it only when the card changes.
    const gaps = cards.map((card) => Math.abs(start(card) - x));
    const index = x >= end - 1 ? cards.length - 1 : gaps.indexOf(Math.min(...gaps));
    if (index === shown) return;
    shown = index;
    position.textContent = String(index + 1).padStart(2, '0');
    title.textContent = cards[index]?.dataset.name ?? '';
  };

  const show = (index: number) => {
    const card = cards[Math.max(0, Math.min(cards.length - 1, index))];
    if (card) {
      scroller.scrollTo({ left: start(card), behavior: reduced.matches ? 'auto' : 'smooth' });
    }
  };

  prev.addEventListener('click', () => show(shown - 1));
  next.addEventListener('click', () => show(shown + 1));
  scroller.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(shown - 1);
    else if (event.key === 'ArrowRight') show(shown + 1);
    else if (event.key === 'Home') show(0);
    else if (event.key === 'End') show(cards.length - 1);
    else return;
    event.preventDefault();
  });
  scroller.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}
