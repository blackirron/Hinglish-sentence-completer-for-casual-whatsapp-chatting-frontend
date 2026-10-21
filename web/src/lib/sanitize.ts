// Control characters, zero width and bidi override characters have no place in a chat prompt.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

export function cleanPrompt(raw: string): string {
  const text = raw.normalize("NFKC").replace(CONTROL, "");
  const trailing = /\s$/.test(text);
  const squeezed = text.replace(/\s+/g, " ").trim();
  return squeezed && trailing ? squeezed + " " : squeezed;
}
