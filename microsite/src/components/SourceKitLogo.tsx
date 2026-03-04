interface SourceKitLogoProps {
  size?: number;
  color?: string;
  glow?: boolean;
}

export function SourceKitLogo({
  size = 32,
  color = "var(--sk-accent)",
  glow = false,
}: SourceKitLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={glow ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}
    >
      {/* Left angle bracket < */}
      <path
        d="M16 10L4 24L16 38"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Right angle bracket > */}
      <path
        d="M32 10L44 24L32 38"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Top bar of colon */}
      <line
        x1="24"
        y1="10"
        x2="24"
        y2="17"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="24" cy="24" r="3" fill={color} />
      {/* Bottom bar of colon */}
      <line
        x1="24"
        y1="31"
        x2="24"
        y2="38"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
