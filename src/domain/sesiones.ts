import type { Question, Test } from '../schemas/content.ts';
import type { Answer } from './evaluacion.ts';
export interface Session { groups: { id: string; questions: string[] }[]; orders: Record<string, string[]>; answers: Record<string, Answer>; checked: string[] }
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const value = random();
    if (!(value >= 0 && value < 1)) throw new RangeError('La fuente aleatoria debe producir valores en [0,1).');
    const j = Math.floor(value * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function initialOrder(question: Question, random = Math.random) {
  const order = shuffle((question.type === 'ordering' ? question.items : question.options).map(o => o.id), random);
  if (question.type === 'ordering' && order.every((id, i) => id === question.answer[i])) [order[0], order[1]] = [order[1], order[0]];
  return order;
}
export function createSession(test: Test, questions: Question[], random = Math.random): Session {
  return {
    groups: shuffle(test.groups, random).map(g => ({ id: g.id, questions: shuffle(g.questionIds, random) })),
    orders: Object.fromEntries(questions.map(q => [q.id, initialOrder(q, random)])),
    answers: {}, checked: [],
  };
}
const permutation = (actual: unknown, expected: string[]): actual is string[] => Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === actual.length && actual.every(id => expected.includes(id));
export function validSession(value: unknown, test: Test, questions: Question[]): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<Session>;
  if (!session || !Array.isArray(session.groups) || !session.orders || !session.answers || !Array.isArray(session.checked)) return false;
  if (typeof session.orders !== 'object' || typeof session.answers !== 'object' || Array.isArray(session.orders) || Array.isArray(session.answers)) return false;
  if (!session.groups.every(g => g && typeof g === 'object' && typeof g.id === 'string' && Array.isArray(g.questions))) return false;
  if (new Set(session.checked).size !== session.checked.length || Object.keys(session.answers).some(id => !questions.some(q => q.id === id))) return false;
  if (!permutation(session.groups.map(g => g.id), test.groups.map(g => g.id))) return false;
  for (const group of session.groups) if (!permutation(group.questions, test.groups.find(g => g.id === group.id)!.questionIds)) return false;
  for (const question of questions) {
    const choices = (question.type === 'ordering' ? question.items : question.options).map(o => o.id);
    if (!permutation(session.orders[question.id], choices)) return false;
    const answer = session.answers[question.id];
    if (answer !== undefined) {
      const values = Array.isArray(answer) ? answer : [answer];
      if (values.some(v => !choices.includes(v)) || new Set(values).size !== values.length) return false;
      if (question.type === 'single' && Array.isArray(answer)) return false;
      if (question.type === 'multiple' && !Array.isArray(answer)) return false;
      if (question.type === 'ordering' && !permutation(answer, choices)) return false;
    }
  }
  const answers = session.answers;
  return session.checked.every(id => questions.some(q => q.id === id) && answers[id] !== undefined);
}
