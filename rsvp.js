/* RSVP form, shared by the wedding and christening invitations.
   Reads window.RSVP_URL (rsvp-config.js) and window.RSVP_EVENT ('wedding' | 'christening').
   Posts JSON to the Google Apps Script web app and remembers the guest's answer on this device. */
(() => {
  const url = (window.RSVP_URL || '').trim();
  const event = window.RSVP_EVENT || 'wedding';
  const box = document.querySelector('.rsvp');
  if (!url || !box) return;

  const MAX = 10;
  const storeKey = `rsvp:${event}`;
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v); }
    for (const k of kids) el.append(k);
    return el;
  };

  /* Markup */
  const form = h('form', { class: 'rsvp-form', novalidate: '' });
  const nameIn = h('input', { name: 'name', autocomplete: 'name', required: '', maxlength: '80', placeholder: 'Full name' });
  const yes = h('input', { type: 'radio', name: 'attending', value: 'yes', required: '' });
  const no = h('input', { type: 'radio', name: 'attending', value: 'no' });
  const countOut = h('output', { name: 'count', text: '0' });
  const minus = h('button', { type: 'button', 'data-d': '-1', 'aria-label': 'Fewer guests', text: '−' });
  const plus = h('button', { type: 'button', 'data-d': '1', 'aria-label': 'More guests', text: '+' });
  const names = h('div', { class: 'rf-names' });
  const seatsB = h('b', { text: '1' });
  const companions = h('div', { class: 'rf-companions', hidden: '' },
    h('div', { class: 'rf-field rf-step' }, h('span', { text: 'Guests coming with you' }), h('div', { class: 'rf-stepper' }, minus, countOut, plus)),
    names,
    h('p', { class: 'rf-seats' }, 'Seats to reserve for you: ', seatsB));
  const phoneIn = h('input', { name: 'phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '40', placeholder: '09xx xxx xxxx' });
  const msgIn = h('textarea', { name: 'message', rows: '2', maxlength: '500', placeholder: 'A note for the family' });
  const submit = h('button', { class: 'rf-submit', type: 'submit', text: 'Send RSVP' });
  const status = h('p', { class: 'rf-status', role: 'status', 'aria-live': 'polite' });
  form.append(
    h('label', { class: 'rf-field' }, h('span', { text: 'Your name' }), nameIn),
    h('fieldset', { class: 'rf-choice' }, h('legend', { text: 'Will you be there?' }),
      h('div', { class: 'opts' },
        h('label', {}, yes, h('span', { text: 'Joyfully accept' })),
        h('label', {}, no, h('span', { text: 'Regretfully decline' })))),
    companions,
    h('label', { class: 'rf-field' }, h('span', { text: 'Mobile number (optional)' }), phoneIn),
    h('label', { class: 'rf-field' }, h('span', { text: 'Message (optional)' }), msgIn),
    submit, status);
  const done = h('div', { class: 'rf-done', hidden: '' });

  const intro = box.querySelector('h3 + p') || box.querySelector('h3');
  intro.after(done, form);
  const firstContact = box.querySelector('.contact');
  if (firstContact) firstContact.before(h('p', { class: 'rf-or', text: 'Questions? Message us directly.' }));

  /* Companions stepper */
  let count = 0;
  function setCount(n, keep = []) {
    count = Math.max(0, Math.min(MAX, n));
    countOut.textContent = String(count);
    minus.disabled = count === 0; plus.disabled = count === MAX;
    const existing = [...names.querySelectorAll('input')].map(i => i.value);
    names.replaceChildren(...Array.from({ length: count }, (_, i) =>
      h('input', { name: 'companion', maxlength: '80', 'aria-label': `Name of guest ${i + 1}`, placeholder: `Name of guest ${i + 1}`, autocomplete: 'off', value: keep[i] ?? existing[i] ?? '' })));
    seatsB.textContent = String(1 + count);
  }
  minus.addEventListener('click', () => setCount(count - 1));
  plus.addEventListener('click', () => setCount(count + 1));
  function syncAttending() { companions.hidden = !yes.checked; }
  yes.addEventListener('change', syncAttending); no.addEventListener('change', syncAttending);
  setCount(0);

  /* Remembered answer */
  function read() { try { return JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(storeKey, JSON.stringify(v)); } catch (e) {} }
  function showDone(r) {
    const when = r.at ? new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '';
    const line = r.attending === 'yes'
      ? h('p', {}, 'Thank you, ', h('b', { text: r.name }), `! We have noted `, h('b', { text: `${r.seats} seat${r.seats === 1 ? '' : 's'}` }), ' for you.')
      : h('p', {}, 'Thank you, ', h('b', { text: r.name }), '. We will miss you and have noted your reply.');
    const edit = h('button', { type: 'button', text: 'Change my reply' });
    edit.addEventListener('click', () => { done.hidden = true; form.hidden = false; nameIn.focus(); });
    done.replaceChildren(line, h('p', { class: 'rf-status', text: when ? `Sent ${when}. You can change it any time.` : 'You can change it any time.' }), edit);
    done.hidden = false; form.hidden = true;
  }
  const saved = read();
  if (saved && saved.name) {
    nameIn.value = saved.name; (saved.attending === 'yes' ? yes : no).checked = true; syncAttending();
    setCount(saved.count || 0, saved.companions || []); phoneIn.value = saved.phone || ''; msgIn.value = saved.message || '';
    showDone(saved);
  }

  /* Clear an error as soon as the guest starts fixing it */
  form.addEventListener('input', () => {
    if (status.classList.contains('err')) { status.className = 'rf-status'; status.textContent = ''; }
    if (nameIn.value.trim()) nameIn.removeAttribute('aria-invalid');
  });

  /* Submit */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.className = 'rf-status'; status.textContent = '';
    const name = nameIn.value.trim();
    nameIn.setAttribute('aria-invalid', name ? 'false' : 'true');
    if (!name) { status.classList.add('err'); status.textContent = 'Please tell us your name.'; nameIn.focus(); return; }
    if (!yes.checked && !no.checked) { status.classList.add('err'); status.textContent = 'Please choose whether you can come.'; yes.focus(); return; }
    const attending = yes.checked ? 'yes' : 'no';
    const list = attending === 'yes' ? [...names.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean) : [];
    /* Duplicate names within this one reply */
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ');
    const seen = new Set([norm(name)]);
    for (const n of list) {
      if (seen.has(norm(n))) {
        status.classList.add('err');
        status.textContent = norm(n) === norm(name) ? 'You are already counted. Please list only the guests coming with you.' : `"${n}" is listed twice. Each guest only needs one seat.`;
        [...names.querySelectorAll('input')].find(i => norm(i.value.trim()) === norm(n))?.focus();
        return;
      }
      seen.add(norm(n));
    }
    const prev = read();
    const payload = { event, name, attending, count: attending === 'yes' ? count : 0, companions: list, phone: phoneIn.value.trim(), message: msgIn.value.trim(), token: prev && prev.token || '' };
    submit.disabled = true; status.textContent = 'Sending…';
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });  // no custom headers: no CORS preflight
      const data = await res.json();
      if (!data.ok) { const e = new Error(data.error || 'The reply could not be saved.'); e.code = data.code; throw e; }
      const rec = Object.assign({}, payload, { seats: data.seats, token: data.token || payload.token, at: Date.now() });
      write(rec); showDone(rec);
    } catch (err) {
      status.classList.add('err');
      status.textContent = err.code === 'duplicate'
        ? `A reply under the name "${name}" was already sent. If that was you and your plans changed, please message us at the numbers below.`
        : 'Sorry, your reply did not go through. Please try again, or message us at the numbers below.';
      if (err.code === 'duplicate') { nameIn.setAttribute('aria-invalid', 'true'); nameIn.focus(); }
    } finally { submit.disabled = false; }
  });
})();
