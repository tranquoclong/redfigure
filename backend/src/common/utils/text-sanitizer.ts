
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';

  let text = input;

  let prev: string;
  do {
    prev = text;
    text = text.replace(
      /<(script|style|iframe|noscript|embed|object|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
      '',
    );
  } while (text !== prev);

  do {
    prev = text;
    text = text.replace(/<[^<>]*>/g, '');
  } while (text !== prev);

  text = text.replace(/[<>]/g, '');

  text = text.replace(
    /\b(?:https?:\/\/|www\.|mailto:)\S+/gi,
    '[link removido]',
  );

  text = text.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ');

  return text.trim();
}
