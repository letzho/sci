/**
 * Small shared presentational primitives used across the app. Kept in one
 * file deliberately - they're tiny and mostly Tailwind class wrappers, with
 * a paired CSS module (ui.module.css) layering on custom hover/transition
 * treatment that Tailwind's utility classes alone don't express well.
 */
import styles from './ui.module.css';

export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-card',
    secondary: 'bg-brand-50 hover:bg-brand-100 text-brand-700',
    outline: 'border border-brand-200 hover:bg-brand-50 text-brand-700',
    ghost: 'hover:bg-slate-100 text-slate-600',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-card',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-card',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${styles.button} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = '', hoverable = false, ...props }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-card border border-slate-100 ${styles.card} ${hoverable ? styles.cardHoverable : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'brand', className = '' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    neutral: 'bg-slate-100 text-slate-600',
    accent: 'bg-accent-400/10 text-accent-600',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone]} ${styles.badge} ${
        tone === 'accent' ? styles.badgeAccent : ''
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function ProductSelect({ value, onChange, includeAll = false, className = '' }) {
  const options = [
    ...(includeAll ? [{ value: '', label: 'All products' }] : []),
    { value: 'life_insurance', label: 'Life insurance' },
    { value: 'ilp', label: 'Investment-linked policy' },
    { value: 'critical_illness', label: 'Critical illness' },
    { value: 'integrated_shield_plan', label: 'Integrated Shield Plan' },
    { value: 'retirement_cpf', label: 'Retirement / CPF LIFE' },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300 ${styles.select} ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function productLabel(productType) {
  const map = {
    life_insurance: 'Life insurance',
    ilp: 'Investment-linked policy',
    critical_illness: 'Critical illness',
    integrated_shield_plan: 'Integrated Shield Plan',
    retirement_cpf: 'Retirement / CPF LIFE',
  };
  return map[productType] || productType || 'General';
}

export function LoadingSpinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin ${styles.spinner}`} />
    </div>
  );
}
