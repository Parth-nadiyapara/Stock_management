import { Search } from 'lucide-react';

// Shared across Stock/Clients/Packing/History so search bars look
// and behave identically everywhere. The icon sits in its own
// flex-centered column (not top-1/2 + translate, which drifts if
// line-height differs) and the input gets a fixed left inset that
// always clears the icon with room to spare.
export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-ink-faint">
        <Search size={16} strokeWidth={2} />
      </span>
      <input
        type="text"
        className="input pl-10"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
