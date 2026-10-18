/**
 * Regras puras dos componentes W10M (porte de `ui/metro/MetroRules.kt`), testadas em JVM lá
 * e em Jest aqui: textos de estado, pivô circular, rótulos destrutivos, ordem dos botões.
 */

export function toggleState(on: boolean): string {
  return on ? "Ativado" : "Desativado";
}

/** Índice do pivô após deslize/seta: +1 próximo, -1 anterior; dá a volta. */
export function pivotStep(index: number, count: number, direction: number): number {
  if (count <= 0) return 0;
  const d = Math.max(-1, Math.min(1, direction));
  return (((index + d) % count) + count) % count;
}

/** De que lado entra a seção nova: +1 direita (próxima), -1 esquerda, 0 parado. */
export function slideDirection(from: number, to: number, count: number): number {
  if (from === to || count <= 1) return 0;
  if (to === pivotStep(from, count, 1)) return 1;
  if (to === pivotStep(from, count, -1)) return -1;
  return to > from ? 1 : -1;
}

export function pivotDescription(title: string, index: number, count: number, selected: boolean): string {
  return `${title}, aba ${index + 1} de ${count}${selected ? ", selecionada" : ""}`;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const DESTRUCTIVE = ["excluir", "apagar", "desinstalar", "remover", "limpar", "descartar", "redefinir", "restaurar padrao", "esquecer", "sair da conta", "desistir", "recusar"];

/** Ações que perdem dados: botão em vermelho e nunca o padrão. */
export function isDestructive(label: string | null | undefined): boolean {
  const f = fold(label ?? "");
  return DESTRUCTIVE.some((w) => f.startsWith(w));
}

export type DialogButton = "positive" | "neutral" | "negative";

/** Botões do diálogo na ordem W10M (esquerda → direita): primário, secundário, fechar. */
export function dialogButtons(positive?: string | null, neutral?: string | null, negative?: string | null): DialogButton[] {
  const out: DialogButton[] = [];
  if (positive?.trim()) out.push("positive");
  if (neutral?.trim()) out.push("neutral");
  if (negative?.trim()) out.push("negative");
  return out;
}

export function sliderStep(max: number): number {
  return Math.max(1, Math.floor(max / 100));
}

/** Encurta sem cortar palavra; "…" só quando cortou. */
export function ellipsize(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function checkDescription(label: string, checked: boolean): string {
  return `${label}, ${checked ? "marcada" : "não marcada"}`;
}

export function validate(value: string, label: string, required: boolean, maxLength?: number): string | null {
  if (required && value.trim() === "") return `Preencha ${label.toLowerCase()}.`;
  if (maxLength !== undefined && value.length > maxLength) return `Use até ${maxLength} caracteres.`;
  return null;
}
