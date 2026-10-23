import { parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
export type HtmlNode = DefaultTreeAdapterMap['node'];
export function visit(node: HtmlNode, callback: (node: HtmlNode) => void) {
  callback(node);
  if ('childNodes' in node) node.childNodes.forEach(child => visit(child, callback));
}
export function nodeText(node: HtmlNode): string {
  if ('value' in node) return node.value;
  return 'childNodes' in node ? node.childNodes.map(nodeText).join('') : '';
}
export function readingHtml(source: string) {
  const doc = parseFragment(source);
  const used = new Set<string>();
  const headings: { id: string; title: string; level: number }[] = [];
  visit(doc, node => {
    if (!('tagName' in node)) return;
    if (['html', 'head', 'h1'].includes(node.tagName)) throw new Error('El cuerpo no puede contener html, head ni h1.');
    const attr = node.attrs.find(a => a.name === 'id');
    if (attr) { if (used.has(attr.value)) throw new Error(`Ancla duplicada: ${attr.value}`); used.add(attr.value); }
  });
  visit(doc, node => {
    if (!('tagName' in node) || !['h2', 'h3'].includes(node.tagName)) return;
    const title = nodeText(node).trim();
    let id = node.attrs.find(a => a.name === 'id')?.value;
    if (!id) {
      const prefix = title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'apartado';
      id = prefix;
      let suffix = 2;
      while (used.has(id)) id = `${prefix}-${suffix++}`;
      node.attrs.push({ name: 'id', value: id }); used.add(id);
    }
    headings.push({ id, title, level: Number(node.tagName.slice(1)) });
  });
  return { html: serialize(doc), headings };
}
export function inlineMarkdown(source: string): string {
  // Deliberately small, safe subset for declarative data: text, code, emphasis, line breaks.
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}
