import {
  adjacentStop,
  DRAG_START_PX,
  isSettled,
  type PointerSample,
  releaseVelocity,
  restingStop,
  rubberBand,
  SAMPLE_WINDOW_MS,
  snapStops,
  springAt,
} from '../lib/carousel';

/**
 * Spec 0.8a §05. The browser scrolls; this script adds mouse drag with momentum, the buttons, the
 * keys and the progress. Touch and trackpads keep the browser's own scrolling, and no vertical
 * movement is ever handled, so the page always scrolls.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Parts {
  root: HTMLElement;
  scroller: HTMLElement;
  track: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  count: HTMLElement;
  bar: HTMLElement;
  name: HTMLElement;
}

function find(root: HTMLElement): Parts | null {
  const section = root.closest('section');
  const scroller = root.querySelector<HTMLElement>('[data-carousel-scroller]');
  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  const prev = section?.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = section?.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const count = section?.querySelector<HTMLElement>('[data-carousel-count]');
  const bar = section?.querySelector<HTMLElement>('[data-carousel-bar]');
  const name = section?.querySelector<HTMLElement>('[data-carousel-name]');
  if (!scroller || !track || !prev || !next || !count || !bar || !name) return null;
  return { root, scroller, track, prev, next, count, bar, name };
}

function init({ root, scroller, track, prev, next, count, bar, name }: Parts): void {
  const items = Array.from(track.children).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
  const total = String(items.length).padStart(2, '0');
  // The counter is a live region: the page already has `<b>01</b> / NN`, so change the text of the
  // number only, and only when the card changes. Nothing is rebuilt on a scroll frame.
  const position = count.querySelector('b') ?? document.createElement('b');
  if (!count.contains(position)) {
    count.replaceChildren(position, document.createTextNode(` / ${total}`));
  }
  let shown = -1;

  const max = () => scroller.scrollWidth - scroller.clientWidth;
  const padStart = () =>
    Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
  const stops = () =>
    snapStops(
      items.map((item) => item.offsetLeft),
      padStart(),
      max(),
    );

  let frame = 0;
  function update(): void {
    frame = 0;
    const x = scroller.scrollLeft;
    const end = max();
    prev.disabled = x <= 1;
    next.disabled = x >= end - 1;
    root.classList.toggle('fl', x > 1);
    root.classList.toggle('fr', x < end - 1);
    let index = 0;
    items.forEach((item, at) => {
      const here = Math.abs(item.offsetLeft - padStart() - x);
      const best = Math.abs((items[index]?.offsetLeft ?? 0) - padStart() - x);
      if (here < best) index = at;
    });
    if (x >= end - 1) index = items.length - 1;
    if (index !== shown) {
      shown = index;
      position.textContent = String(index + 1).padStart(2, '0');
      name.textContent = items[index]?.dataset.name ?? '';
    }
    bar.style.transform = `scaleX(${Math.min(1, (x + scroller.clientWidth) / scroller.scrollWidth).toFixed(4)})`;
  }
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(update);
  };

  let spring = 0;
  function stop(): void {
    cancelAnimationFrame(spring);
    spring = 0;
    scroller.classList.remove('anim');
  }
  /** From the live position, carrying the release velocity (px/s). */
  function settleTo(target: number, velocity = 0): void {
    stop();
    const from = scroller.scrollLeft;
    if (reduced() || Math.abs(target - from) < 1) {
      scroller.scrollLeft = target;
      schedule();
      return;
    }
    scroller.classList.add('anim');
    const start = performance.now();
    const step = (now: number) => {
      const state = springAt(from, target, velocity, (now - start) / 1000);
      scroller.scrollLeft = state.x;
      if (isSettled(state.x, target, state.v)) {
        scroller.scrollLeft = target;
        stop();
        schedule();
        return;
      }
      spring = requestAnimationFrame(step);
    };
    spring = requestAnimationFrame(step);
  }
  const go = (direction: 1 | -1) => {
    const target = adjacentStop(stops(), scroller.scrollLeft, direction);
    if (target !== null) settleTo(target);
  };

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  scroller.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') go(1);
    else if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'Home') settleTo(0);
    else if (event.key === 'End') settleTo(max());
    else return;
    event.preventDefault();
  });
  scroller.addEventListener('scroll', schedule, { passive: true });
  scroller.addEventListener('wheel', stop, { passive: true });
  scroller.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  track.addEventListener('dragstart', (event) => event.preventDefault());

  interface Drag {
    id: number;
    x0: number;
    s0: number;
    active: boolean;
    over: number;
    samples: PointerSample[];
  }
  let drag: Drag | null = null;
  let suppressClick = false;
  track.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    },
    true,
  );
  scroller.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    stop();
    drag = {
      id: event.pointerId,
      x0: event.clientX,
      s0: scroller.scrollLeft,
      active: false,
      over: 0,
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
  });
  scroller.addEventListener('pointermove', (event) => {
    if (drag === null || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x0;
    if (!drag.active) {
      if (Math.abs(dx) < DRAG_START_PX) return;
      drag.active = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add('drag');
    }
    const wanted = drag.s0 - dx;
    const x = Math.max(0, Math.min(max(), wanted));
    scroller.scrollLeft = x;
    drag.over = wanted - x;
    track.style.transform =
      drag.over === 0 || reduced()
        ? ''
        : `translateX(${(-rubberBand(drag.over, scroller.clientWidth)).toFixed(1)}px)`;
    drag.samples.push({ x: event.clientX, t: event.timeStamp });
    while (
      drag.samples.length > 2 &&
      event.timeStamp - (drag.samples[0]?.t ?? 0) > SAMPLE_WINDOW_MS
    )
      drag.samples.shift();
  });
  const end = (event: PointerEvent) => {
    if (drag === null || event.pointerId !== drag.id) return;
    const finished = drag;
    drag = null;
    if (!finished.active) return;
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 80);
    scroller.classList.remove('drag');
    if (finished.over !== 0) {
      const from = track.style.transform;
      track.style.transform = '';
      if (!reduced() && from !== '') {
        track.animate([{ transform: from }, { transform: 'translateX(0)' }], {
          duration: 420,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        });
      }
      settleTo(finished.over < 0 ? 0 : max());
      return;
    }
    const velocity = releaseVelocity(finished.samples);
    settleTo(restingStop(stops(), scroller.scrollLeft, velocity), velocity);
  };
  scroller.addEventListener('pointerup', end);
  scroller.addEventListener('pointercancel', end);
  scroller.addEventListener('lostpointercapture', end);
  update();
}

for (const root of document.querySelectorAll<HTMLElement>('[data-carousel]')) {
  const parts = find(root);
  if (parts !== null) init(parts);
}
