import styles from './Logo.module.css';

export default function Logo({ size = 36, withWordmark = true, light = false }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src="/logo.png" alt="ClarityAI" width={size} height={size} className={`shrink-0 ${styles.mark}`} />
      {withWordmark && (
        <div className="leading-tight">
          <div className={`font-bold text-base ${light ? styles.wordmarkLight : styles.wordmark}`}>ClarityAI</div>
          <div className={`text-[11px] tracking-wide uppercase ${light ? 'text-brand-100' : 'text-brand-500'} ${styles.tagline}`}>
            Representative Assist
          </div>
        </div>
      )}
    </div>
  );
}
