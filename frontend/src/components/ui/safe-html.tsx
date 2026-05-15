import DOMPurify from 'isomorphic-dompurify';

if (
  typeof DOMPurify.addHook === 'function' &&
  typeof DOMPurify.removeAllHooks === 'function'
) {
  DOMPurify.removeAllHooks();
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const PURIFY_CONFIG = {

  ALLOWED_TAGS: [
    'a', 'p', 'br', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'strong', 'em', 's', 'u',
    'blockquote', 'code', 'pre',
    'img', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'sup', 'sub',
    'dl', 'dt', 'dd',
    'figure', 'figcaption',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'class', 'id', 'lang', 'dir',
    'width', 'height', 'colspan', 'rowspan',
  ],

  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export interface SafeHtmlProps {
  html: string | null | undefined;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  if (!html) return <div className={className} />;
  const clean = DOMPurify.sanitize(html, PURIFY_CONFIG);
  return (
    <div
      className={className}

      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
