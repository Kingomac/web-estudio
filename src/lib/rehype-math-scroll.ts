import type { Element, Root } from 'hast';

// Firefox ignores overflow on <math>, so wide display formulas get a scroll wrapper instead of widening the page.
export default function rehypeMathScroll() {
  return (tree: Root) => wrap(tree);
}

function isDisplayMath(node: Element) {
  const className = node.properties.className;
  return node.tagName === 'math' && Array.isArray(className) && className.includes('tml-display');
}

function wrap(node: Root | Element) {
  node.children = node.children.map(child => {
    if (child.type !== 'element') return child;
    if (isDisplayMath(child)) return { type: 'element', tagName: 'div', properties: { className: ['math-display'] }, children: [child] };
    wrap(child);
    return child;
  });
}
