export function limpaNome(s: string | undefined | null): string {
  return (s || "").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

export function escXml(s: unknown): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
