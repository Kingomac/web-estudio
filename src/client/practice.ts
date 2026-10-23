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
    const groupElements = new Map([...this.querySelectorAll<HTMLElement>('[data-group]')].map(el => [el.dataset.group!, el]));
    const save = () => store.write(session);
    const updateSummary = () => {
      const correct = questions.filter(q => session.checked.includes(q.id) && gradeQuestion(q, session.answers[q.id]).correct).length;
      const incorrect = session.checked.length - correct;
      this.querySelector('[data-summary]')!.textContent = `${correct} correctas · ${incorrect} incorrectas · ${questions.length - session.checked.length} pendientes`;
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
        label.classList.toggle('right', right);
      });
    };
    const orderingButtons = (element: HTMLElement) => {
      const rows = [...element.querySelectorAll<HTMLElement>('[data-options] [data-option]')];
      rows.forEach((row, i) => { const up = row.querySelector<HTMLButtonElement>('[data-up]'); const down = row.querySelector<HTMLButtonElement>('[data-down]'); if (up) up.disabled = i === 0; if (down) down.disabled = i === rows.length - 1; });
    };
    const apply = () => {
      for (const group of session.groups) {
        const el = groupElements.get(group.id)!;
        this.querySelector('[data-groups]')!.append(el);
        group.questions.forEach(id => el.querySelector('[data-questions]')!.append(questionElements.get(id)!));
      }
      for (const q of questions) {
        const element = questionElements.get(q.id)!;
        const list = element.querySelector('[data-options]')!;
        const options = new Map([...list.querySelectorAll<HTMLElement>('[data-option]')].map(el => [el.dataset.option!, el]));
        session.orders[q.id].forEach(id => list.append(options.get(id)!));
        element.querySelectorAll<HTMLInputElement>('input').forEach(input => { const answer = session.answers[q.id]; input.checked = Array.isArray(answer) ? answer.includes(input.value) : answer === input.value; });
        orderingButtons(element); feedback(q, element);
      }
      updateSummary(); save();
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
    this.querySelector('[data-reset]')!.addEventListener('click', () => { store.reset(); session = createSession(test, questions); apply(); }, { signal: controller.signal });
    apply();
    if (location.hash.startsWith('#pregunta-')) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
  }
  disconnectedCallback() { this.cleanup?.(); }
}
customElements.define('study-test', StudyTest);
