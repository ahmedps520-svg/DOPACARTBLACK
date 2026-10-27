export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lm-metal" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f4f4f5" />
          <stop offset="0.5" stopColor="#9aa1ab" />
          <stop offset="1" stopColor="#e8ebef" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#111114" stroke="#26262d" />
      <path d="M18 15h15c10 0 17 7.5 17 17s-7 17-17 17H18z" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="33" cy="32" r="5.5" fill="url(#lm-metal)" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="logo">
      <LogoMark />
      <div>
        <div className="logo-word">
          DOPA<b>CART</b>
        </div>
        <span className="logo-sub">BLACK MARKET</span>
      </div>
    </div>
  );
}
