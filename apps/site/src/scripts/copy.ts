/**
 * Spec 0.8a §07: the copy buttons of the terminal blocks. Without JavaScript they do nothing.
 * The button changes to its done state only when the copy worked. When it fails, the script selects
 * the text of the block, so the visitor can copy it by hand, and shows a short failure label. The
 * status span is a live region: a change of `aria-label` is not announced, a change of its text is.
 */
const DONE_MS = 1600;
const FAILED_MS = 4000;

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  const status = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]') ?? null;
  const block = button.closest('.term')?.querySelector('pre') ?? null;
  let timer = 0;

  const say = (text: string, visible: boolean) => {
    if (status === null) return;
    status.textContent = text;
    status.classList.toggle('vh', !visible);
  };

  button.addEventListener('click', async () => {
    window.clearTimeout(timer);
    let copied = true;
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
    } catch {
      // No clipboard API (an insecure page) or no permission.
      copied = false;
    }
    if (copied) {
      button.classList.add('done');
      say(button.dataset.copied ?? '', false);
    } else {
      button.classList.remove('done');
      if (block !== null) window.getSelection()?.selectAllChildren(block);
      say(button.dataset.failed ?? '', true);
    }
    timer = window.setTimeout(
      () => {
        button.classList.remove('done');
        say('', false);
      },
      copied ? DONE_MS : FAILED_MS,
    );
  });
}
