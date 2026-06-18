/**
 * Formata uma data como horário curto (HH:mm) no padrão pt-BR.
 * Aceita Date, número (epoch) ou null; retorna "--:--" quando indisponível.
 *
 * @param {Date|number|null|undefined} value
 * @returns {string}
 */
export function formatTime(value) {
  if (!value) return "--:--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
