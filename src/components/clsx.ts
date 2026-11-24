export function clsx(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(' ');
}
