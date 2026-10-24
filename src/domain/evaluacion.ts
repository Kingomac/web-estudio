import type { Question, Field } from '../schemas/content.ts';
import { matchesFormat } from './formatos.ts';
export type Answer = string | string[];
export function gradeQuestion(question: Question, answer: Answer | undefined) {
  const options = question.type === 'ordering' ? question.items : question.options;
  const valid = new Set(options.map(o => o.id));
  const values = Array.isArray(answer) ? answer : answer == null ? [] : [answer];
  if (new Set(values).size !== values.length || values.some(v => !valid.has(v))) return { correct: false, valid: false };
  if (question.type === 'single') return { correct: values.length === 1 && values[0] === question.answer, valid: true };
  if (question.type === 'multiple') return { correct: values.length === question.answer.length && question.answer.every(v => values.includes(v)), valid: true };
  return { correct: values.length === question.answer.length && values.every((v, i) => v === question.answer[i]), valid: true };
}
export function normalizeText(value: string, policy: Extract<Field, { type: 'text' }>['normalization']) {
  let result = String(value);
  if (policy.trim) result = result.trim();
  if (policy.collapseSpaces) result = result.replace(/\s+/g, ' ');
  if (!policy.caseSensitive) result = result.toLocaleLowerCase('es');
  if (!policy.accentSensitive) result = result.normalize('NFD').replace(/\p{M}/gu, '');
  return result;
}
export function gradeField(field: Field, raw: string) {
  if (field.type === 'number') {
    const input = String(raw).trim();
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(input)) return { correct: false, message: 'Escribe un número completo, con coma o punto decimal y sin separadores de miles.' };
    const value = Number(input.replace(',', '.'));
    return { correct: Number.isFinite(value) && Math.abs(value - field.answer) <= Math.max(field.absTol, field.relTol * Math.abs(field.answer)), message: field.explanation };
  }
  if (field.type === 'text') return { correct: field.answers.some(a => normalizeText(raw, field.normalization) === normalizeText(a, field.normalization)), message: field.explanation };
  if (field.type === 'format') return { correct: matchesFormat(field.format, raw, field.answer), message: field.explanation };
  return { correct: raw === field.answer, message: field.explanation };
}
