/** Joins conditional class names. Falsy values are dropped. */
export function cn(...values) {
  return values.filter(Boolean).join(' ')
}
