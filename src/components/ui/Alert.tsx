const TONES = {
  error: 'border-red-300 bg-red-50 text-red-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  success: 'border-brand-300 bg-brand-50 text-brand-800',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${TONES[tone]}`} role="status">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}
