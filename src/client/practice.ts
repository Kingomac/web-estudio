import { gradeQuestion } from '../domain/evaluacion.ts';
import type { Answer } from '../domain/evaluacion.ts';
import { createSession, validSession } from '../domain/sesiones.ts';
import { storageFor } from './almacenamiento.ts';
import type { Question, Test } from '../schemas/content.ts';

class StudyTest extends HTMLElement {
  cleanup?: () => void;
  connectedCallback() {
    const payload = JSON.parse(this.querySelector('[data-payload]')!.textContent || '{}') as { test: Test; questions: Question[] };
    const { test, questions } = payload;
    const store = storageFor(test.id, this.dataset.revision!, this.dataset.base!);
    const saved = store.read();
    let session = validSession(saved, test, questions) ? saved : createSession(test, questions);
    const controller = new AbortController(); this.cleanup = () => controller.abort();
    const questionElements = new Map([...this.querySelectorAll<HTMLElement>('[data-question]')].map(el => [el.dataset.question!, el]));
    const navItems = [...this.querySelectorAll<HTMLButtonElement>('[data-goto]')];
    const prev = this.querySelector<HTMLButtonElement>('[data-prev]')!;
    const next = this.querySelector<HTMLButtonElement>('[data-next]')!;
    const byId = new Map(questions.map(q => [q.id, q]));
    const save = () => store.write(session);
    const updateSummary = () => {
      const correct = questions.filter(q => session.checked.includes(q.id) && gradeQuestion(q, session.answers[q.id]).correct).length;
      const incorrect = session.checked.length - correct;
      this.querySelector('[data-summary]')!.textContent = `${correct} correctas · ${incorrect} incorrectas · ${questions.length - session.checked.length} pendientes`;
      session.sequence.forEach((id, i) => {
        const item = navItems[i];
        const checked = session.checked.includes(id);
        const correct = checked && gradeQuestion(byId.get(id)!, session.answers[id]).correct;
        const state = checked ? correct ? 'correcta' : 'incorrecta' : session.answers[id] !== undefined ? 'respondida sin comprobar' : 'pendiente';
        item.classList.toggle('is-correct', checked && correct);
        item.classList.toggle('is-incorrect', checked && !correct);
        item.classList.toggle('is-answered', !checked && session.answers[id] !== undefined);
        item.setAttribute('aria-label', `Pregunta ${i + 1}: ${state}`);
      });
    };
    // Muestra una sola pregunta; el resto sigue en el DOM para imprimir y para el enlace directo.
    const show = (index: number, { focus = false } = {}) => {
      session.current = Math.min(Math.max(index, 0), session.sequence.length - 1);
      const element = questionElements.get(session.sequence[session.current])!;
      questionElements.forEach(el => el.classList.toggle('is-current', el === element));
      navItems.forEach((item, i) => { if (i === session.current) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current'); });
      prev.disabled = session.current === 0;
      next.disabled = session.current === session.sequence.length - 1;
      this.querySelector('[data-position]')!.textContent = `Pregunta ${session.current + 1} de ${session.sequence.length}`;
      if (location.hash !== `#${element.id}`) history.replaceState(history.state, '', `#${element.id}`);
      if (focus) {
        element.focus({ preventScroll: true });
        const top = element.getBoundingClientRect().top;
        if (top < 0 || top > innerHeight) element.scrollIntoView({ block: 'start' });
      }
      save();
    };
    const fromHash = () => {
      const index = session.sequence.findIndex(id => location.hash === `#${questionElements.get(id)!.id}`);
      return index === -1 ? null : index;
    };
    const readAnswer = (q: Question, element: HTMLElement): Answer => {
      if (q.type === 'ordering') return [...element.querySelectorAll<HTMLElement>('[data-options] [data-option]')].map(el => el.dataset.option!);
      const selected = [...element.querySelectorAll<HTMLInputElement>('input:checked')].map(input => input.value);
      return q.type === 'single' ? selected[0] || '' : selected;
    };
    const feedback = (q: Question, element: HTMLElement) => {
      const checked = session.checked.includes(q.id);
      const result = element.querySelector<HTMLElement>('[data-result]')!;
      element.querySelector<HTMLElement>('[data-feedback]')!.hidden = !checked;
      element.classList.remove('is-correct', 'is-incorrect');
      if (!checked) { result.textContent = session.answers[q.id] !== undefined ? 'Respuesta editada. Comprueba de nuevo.' : ''; return; }
      const answer = session.answers[q.id];
      const correct = gradeQuestion(q, answer).correct;
      result.textContent = correct ? '✓ Respuesta correcta' : 'Revisa la explicación y vuelve a intentarlo';
      element.classList.add(correct ? 'is-correct' : 'is-incorrect');
      element.querySelectorAll<HTMLElement>('[data-outcome]').forEach(label => {
        const option = label.dataset.outcome!;
        const right = Array.isArray(q.answer) ? q.answer.includes(option) : q.answer === option;
        const chosen = Array.isArray(answer) ? answer.includes(option) : answer === option;
        label.textContent = q.type === 'multiple' ? right ? chosen ? 'Correcta seleccionada' : 'Correcta omitida' : chosen ? 'Incorrecta seleccionada' : 'Incorrecta descartada' : `${right ? 'Correcta' : 'Incorrecta'}${chosen ? ' · Tu respuesta' : ''}`;
        label.classList.toggle('is-right', right);
      });
    };
    const orderingButtons = (element: HTMLElement) => {
      const rows = [...element.querySelectorAll<HTMLElement>('[data-options] [data-option]')];
      rows.forEach((row, i) => { const up = row.querySelector<HTMLButtonElement>('[data-up]'); const down = row.querySelector<HTMLButtonElement>('[data-down]'); if (up) up.disabled = i === 0; if (down) down.disabled = i === rows.length - 1; });
    };
    const apply = () => {
      const list = this.querySelector('[data-questions]')!;
      session.sequence.forEach(id => list.append(questionElements.get(id)!));
      for (const q of questions) {
        const element = questionElements.get(q.id)!;
        const list = element.querySelector('[data-options]')!;
        const options = new Map([...list.querySelectorAll<HTMLElement>('[data-option]')].map(el => [el.dataset.option!, el]));
        session.orders[q.id].forEach(id => list.append(options.get(id)!));
        element.querySelectorAll<HTMLInputElement>('input').forEach(input => { const answer = session.answers[q.id]; input.checked = Array.isArray(answer) ? answer.includes(input.value) : answer === input.value; });
        orderingButtons(element); feedback(q, element);
      }
      updateSummary(); show(session.current);
    };
    this.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach(el => { el.disabled = false; });
    for (const q of questions) {
      const element = questionElements.get(q.id)!;
      const edit = () => {
        session.answers[q.id] = readAnswer(q, element);
        session.checked = session.checked.filter(id => id !== q.id);
        feedback(q, element); updateSummary(); save();
      };
      element.addEventListener('change', edit, { signal: controller.signal });
      element.querySelector('[data-check]')!.addEventListener('click', () => {
        const answer = readAnswer(q, element);
        if (answer === '' || Array.isArray(answer) && answer.length === 0) { element.querySelector('[data-result]')!.textContent = 'Selecciona una respuesta antes de comprobar.'; return; }
        session.answers[q.id] = answer;
        if (!session.checked.includes(q.id)) session.checked.push(q.id);
        feedback(q, element); updateSummary(); save();
      }, { signal: controller.signal });
      element.querySelectorAll<HTMLButtonElement>('[data-up], [data-down]').forEach(button => button.addEventListener('click', () => {
        const row = button.closest<HTMLElement>('[data-option]')!;
        const up = button.hasAttribute('data-up');
        const neighbor = up ? row.previousElementSibling : row.nextElementSibling;
        if (!neighbor) return;
        if (up) row.parentElement!.insertBefore(row, neighbor); else row.parentElement!.insertBefore(neighbor, row);
        session.orders[q.id] = readAnswer(q, element) as string[];
        orderingButtons(element); edit();
        const direction = button.disabled ? up ? '[data-down]' : '[data-up]' : up ? '[data-up]' : '[data-down]';
        row.querySelector<HTMLButtonElement>(direction)!.focus();
      }, { signal: controller.signal }));
    }
    this.querySelector('[data-reset]')!.addEventListener('click', () => { store.reset(); session = createSession(test, questions); apply(); show(0, { focus: true }); }, { signal: controller.signal });
    prev.addEventListener('click', () => show(session.current - 1, { focus: true }), { signal: controller.signal });
    next.addEventListener('click', () => show(session.current + 1, { focus: true }), { signal: controller.signal });
    navItems.forEach((item, i) => item.addEventListener('click', () => show(i, { focus: true }), { signal: controller.signal }));
    addEventListener('hashchange', () => { const index = fromHash(); if (index !== null) show(index, { focus: true }); }, { signal: controller.signal });
    // Flechas para pasar de pregunta salvo en los campos, donde mueven la selección.
    this.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.target as HTMLElement).closest('input, select, textarea')) return;
      if (event.key === 'ArrowLeft' && !prev.disabled) { event.preventDefault(); show(session.current - 1, { focus: true }); }
      if (event.key === 'ArrowRight' && !next.disabled) { event.preventDefault(); show(session.current + 1, { focus: true }); }
    }, { signal: controller.signal });
    const linked = fromHash();
    if (linked !== null) session.current = linked;
    apply();
    this.dataset.paged = '';
    this.querySelectorAll<HTMLElement>('[data-navigator], [data-pager]').forEach(el => { el.hidden = false; });
    if (linked !== null) requestAnimationFrame(() => questionElements.get(session.sequence[linked])!.scrollIntoView());
  }
  disconnectedCallback() { this.cleanup?.(); }
}
customElements.define('study-test', StudyTest);
