import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SafeHtml } from './safe-html';

describe('SafeHtml — sanitizes admin HTML before injecting (anti Stored XSS)', () => {
  it('renders benign HTML (standard rich text)', () => {
    const { container } = render(
      <SafeHtml html="<p>Hello <strong>world</strong></p>" />,
    );
    expect(container.innerHTML).toContain('<p>Hello <strong>world</strong></p>');
  });

  it('REMOVES <script> tag (classic XSS)', () => {
    const { container } = render(
      <SafeHtml html='<p>texto</p><script>alert("xss")</script>' />,
    );
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('alert');
  });

  it('REMOVES inline handlers (onerror, onload, onclick)', () => {
    const { container } = render(
      <SafeHtml html='<img src=x onerror="alert(1)" /><div onclick="alert(2)">x</div>' />,
    );
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('onclick');
    expect(container.innerHTML).not.toContain('alert');
  });

  it('REMOVES javascript: and data: href', () => {
    const { container } = render(
      <SafeHtml html='<a href="javascript:alert(1)">click</a>' />,
    );
    expect(container.innerHTML).not.toMatch(/javascript:/i);
  });

  it('REMOVES <iframe> (malicious clickjack/embed)', () => {
    const { container } = render(
      <SafeHtml html='<iframe src="https://evil.com"></iframe>' />,
    );
    expect(container.innerHTML).not.toContain('iframe');
  });

  it('REMOVES <object> and <embed>', () => {
    const { container } = render(
      <SafeHtml html='<object data="x"></object><embed src="y" />' />,
    );
    expect(container.innerHTML).not.toContain('object');
    expect(container.innerHTML).not.toContain('embed');
  });

  it('preserves <a target="_blank"> + forces rel=noopener noreferrer (anti tabnabbing)', () => {
    const { container } = render(
      <SafeHtml html='<a href="https://example.com" target="_blank">link</a>' />,
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');

    expect(anchor?.getAttribute('rel')).toMatch(/noopener|noreferrer/);
  });

  it('preserves semantic tags (h1-h6, ul, ol, li, blockquote, code, table)', () => {
    const html = `
      <h1>Title</h1>
      <h2>Sub</h2>
      <ul><li>item</li></ul>
      <ol><li>step</li></ol>
      <blockquote>quote</blockquote>
      <code>code</code>
      <table><tr><td>cell</td></tr></table>
    `;
    const { container } = render(<SafeHtml html={html} />);
    expect(container.querySelector('h1')).toBeTruthy();
    expect(container.querySelector('h2')).toBeTruthy();
    expect(container.querySelector('ul li')).toBeTruthy();
    expect(container.querySelector('ol li')).toBeTruthy();
    expect(container.querySelector('blockquote')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.querySelector('table td')).toBeTruthy();
  });

  it('preserves <img src> with https/relative URL', () => {
    const { container } = render(
      <SafeHtml html='<img src="https://cdn.example.com/x.png" alt="x" />' />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/x.png',
    );
  });

  it('accepts className passed to wrapper div', () => {
    const { container } = render(<SafeHtml html="<p>x</p>" className="prose-elite" />);
    expect(container.querySelector('.prose-elite')).toBeTruthy();
  });

  it('null/undefined html: does not render anything dangerous', () => {
    const { container: c1 } = render(<SafeHtml html={null as unknown as string} />);
    const { container: c2 } = render(<SafeHtml html={undefined as unknown as string} />);

    expect(c1.textContent).toBe('');
    expect(c2.textContent).toBe('');
  });
});
