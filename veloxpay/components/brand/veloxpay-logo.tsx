type VeloxPayLogoProps = {
  className?: string;
  showWordmark?: boolean;
  textClassName?: string;
};

export function VeloxPayLogo({
  className = "h-10 w-10",
  showWordmark = false,
  textClassName = "text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50",
}: VeloxPayLogoProps) {
  return (
    <span className="inline-flex items-center gap-3">
      <svg
        aria-hidden="true"
        viewBox="0 0 128 128"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="veloxpay-core" x1="32" y1="94" x2="88" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#163EA5" />
            <stop offset="0.45" stopColor="#2469E1" />
            <stop offset="1" stopColor="#56C0FF" />
          </linearGradient>
          <linearGradient id="veloxpay-orbit" x1="71" y1="17" x2="114" y2="51" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2D72F3" />
            <stop offset="1" stopColor="#79D2FF" />
          </linearGradient>
        </defs>

        <path
          d="M29 34C39 36 52 47 60 65C65 77 66 91 57 104C48 98 41 88 37 76C30 57 26 42 19 34C16 31 18 29 22 29C24 29 26 30 29 34Z"
          fill="#1845B5"
        />
        <path
          d="M54 107L46 107C54 88 60 69 71 49C77 38 87 28 101 21C86 43 83 67 74 88C70 98 64 105 54 107Z"
          fill="url(#veloxpay-core)"
        />
        <path
          d="M67 102C63 99 61 93 61 86C61 69 70 54 85 38C81 49 80 61 77 73C75 83 73 93 67 102Z"
          fill="#8FE3FF"
          fillOpacity="0.95"
        />
        <path
          d="M72 24C84 12 104 11 116 22C121 26 124 33 124 39C121 35 117 32 111 31C102 28 94 30 86 33C79 36 72 40 66 43C59 47 53 49 45 49C55 43 63 35 72 24Z"
          fill="url(#veloxpay-orbit)"
        />
        <path
          d="M103 18L109 24L118 21L111 31L120 37L110 36L106 45L103 35L93 33L101 29L103 18Z"
          fill="#5AC8FF"
        />
      </svg>

      {showWordmark ? (
        <span className={textClassName}>VeloxPay</span>
      ) : null}
    </span>
  );
}
