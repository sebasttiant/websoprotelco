interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  color?: "dark" | "light";
}

export function Logo({ className = "", variant = "full", color = "dark" }: LogoProps) {
  const primaryColor = color === "dark" ? "#0B3D6B" : "#FFFFFF";
  const accentColor = "#00D4FF";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="SOPROTELCO"
      >
        <rect width="48" height="48" rx="12" fill={primaryColor} />
        <text
          x="8"
          y="32"
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="18"
          letterSpacing="1"
        >
          SPT
        </text>
        <path
          d="M32 12l-6 10h4l5-10h-3z"
          fill={accentColor}
          stroke="white"
          strokeWidth="0.5"
        />
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-11 w-11 flex-shrink-0"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill={primaryColor} />
        <text
          x="8"
          y="32"
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="18"
          letterSpacing="1"
        >
          SPT
        </text>
        <path
          d="M32 12l-6 10h4l5-10h-3z"
          fill={accentColor}
          stroke="white"
          strokeWidth="0.5"
        />
      </svg>
      <span className="text-sm font-black uppercase tracking-widest text-brand-navy">
        SOPROTELCO
      </span>
    </div>
  );
}
