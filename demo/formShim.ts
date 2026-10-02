/**
 * Sandboxed viewers that leave out the allow-forms permission block form submission
 * outright: the browser never fires the submit event, so login, payment and every
 * other form would do nothing. When that is the case, deliver the submit event
 * ourselves. The forms all handle it in JavaScript and call preventDefault, so no
 * navigation is involved. Where forms work normally this does nothing.
 */
function formsAreBlocked(): boolean {
  const form = document.createElement('form')
  form.style.display = 'none'
  let fired = false
  form.addEventListener('submit', (e) => {
    fired = true
    e.preventDefault()
  })
  document.body.appendChild(form)
  try {
    form.requestSubmit()
  } catch {
    // Older browsers without requestSubmit: assume forms work.
    fired = true
  }
  form.remove()
  return !fired
}

function submit(form: HTMLFormElement, submitter: HTMLElement | null) {
  if (!form.noValidate && !form.reportValidity()) return
  const event = typeof SubmitEvent === 'function'
    ? new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter })
    : new Event('submit', { bubbles: true, cancelable: true })
  form.dispatchEvent(event)
}

export function installFormShim() {
  if (!formsAreBlocked()) return

  // Runs after React's own handlers (they sit on #root), so a click handler that
  // cancels the default action still wins.
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return
    const target = e.target instanceof Element ? e.target : null
    const button = target?.closest('button, input[type="submit"]') as HTMLButtonElement | HTMLInputElement | null
    if (!button || button.type !== 'submit' || button.disabled || !button.form) return
    submit(button.form, button)
  })

  // Enter in a field of a form without a submit button (the browser clicks the
  // submit button itself when there is one, which the handler above covers).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return
    const field = e.target
    if (!(field instanceof HTMLInputElement) || !field.form) return
    if (field.form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]')) return
    submit(field.form, null)
  })
}
