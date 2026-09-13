export default function StatCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-accent-soft text-accent-dark',
    warning: 'bg-warning/10 text-warning',
  };

  return (
    <div className="card flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
        {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
      </div>
      {Icon && (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${toneClasses[tone]}`}>
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}
