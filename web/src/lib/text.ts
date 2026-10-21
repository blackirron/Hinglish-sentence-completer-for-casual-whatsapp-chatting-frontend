/** Put a chosen word into the box: finish a half typed word, or add after a complete one. */
export function applyWord(text: string, word: string): string {
  if (!text.trim()) return word + " ";
  if (/\s$/.test(text)) return text + word + " ";
  if (/[,.;:!?]$/.test(text)) return text + " " + word + " ";
  const cut = text.lastIndexOf(" ");
  return text.slice(0, cut + 1) + word + " ";
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
