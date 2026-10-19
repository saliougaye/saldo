/** Spec 0.8a §07: the copy buttons of the terminal blocks. Without JavaScript they do nothing. */
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
  const label = button.getAttribute('aria-label') ?? '';
  let timer = 0;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
    } catch {
      // No clipboard permission: the state still changes, so the press is not lost.
    }
    button.classList.add('done');
    button.setAttribute('aria-label', button.dataset.copied ?? label);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.classList.remove('done');
      button.setAttribute('aria-label', label);
    }, 1600);
  });
}
