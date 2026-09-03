import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegionalLanguage } from '../RegionalLanguageContext';
import { managedVisitorText } from '../managedVisitorCopy';
const attributes = ['aria-label', 'title', 'placeholder'];
// Keep source text so dynamic templates are reversible when switching back to ko.
const originals = new WeakMap<Node, { source: string; rendered: string }>();
const originalAttributes = new WeakMap<Element, Map<string, {source:string; rendered:string}>>();
export default function ManagedVisitorLocalization() {
  const { language } = useRegionalLanguage();
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.querySelector('.app-main');
    if (!root || /\/(?:admin|partner|partners|regional-report|regions)(?:\/|$)/.test(pathname)) return;
    const apply = (node: Node) => {
      if (node.parentElement?.closest('textarea,[translate="no"],[data-user-content],.chat-bubble.user')) return;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const previous = originals.get(node);
        const source = previous?.rendered === node.textContent ? previous.source : node.textContent;
        const rendered = managedVisitorText(source, language);
        originals.set(node, { source, rendered });
        if (node.textContent !== rendered) node.textContent = rendered;
      }
      if (node instanceof Element) {
        if (node.matches('script,style,[translate="no"],[data-user-content],.chat-bubble.user')) return;
        for (const name of attributes) {
          const value = node.getAttribute(name);
          if (value) {
            const saved = originalAttributes.get(node) || new Map();
            const previous = saved.get(name);
            const source = previous?.rendered === value ? previous.source : value;
            const rendered = managedVisitorText(source, language);
            saved.set(name, {source, rendered});
            originalAttributes.set(node, saved);
            if (rendered !== value) node.setAttribute(name, rendered);
          }
        }
        if (!node.matches('textarea')) for (const child of node.childNodes) apply(child);
      }
    };
    apply(root);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') apply(record.target);
        for (const node of record.addedNodes) apply(node);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    return () => observer.disconnect();
  }, [language, pathname]);
  return null;
}
