import * as React from "react";

export type LogoVariant =
  | "principal"
  | "compacta"
  | "icone"
  | "mono-branco"
  | "mono-preto";

export interface LogoProps {
  variant?: LogoVariant;
  className?: string;

  ariaLabel?: string;
}

const COMMON_FONT = "Orbitron, sans-serif";

function Principal({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 460 130"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <title>Red Figure — Logo</title>
      <defs>
        <filter id="lgSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation=".4" />
        </filter>
      </defs>
      <text
        x="226"
        y="64"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="56"
        fill="#ff007a"
        opacity=".88"
        letterSpacing="6"
        filter="url(#lgSoft)"
      >
        ELITE
      </text>
      <text
        x="234"
        y="68"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="56"
        fill="#00f0ff"
        opacity=".88"
        letterSpacing="6"
        filter="url(#lgSoft)"
      >
        ELITE
      </text>
      <text
        x="230"
        y="66"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="56"
        fill="#ffffff"
        letterSpacing="6"
      >
        ELITE
      </text>
      <rect
        x="120"
        y="34"
        width="220"
        height="2.4"
        fill="#00f0ff"
        opacity=".75"
      />
      <rect
        x="100"
        y="52"
        width="260"
        height="1.6"
        fill="#ff007a"
        opacity=".7"
      />
      <rect
        x="150"
        y="74"
        width="160"
        height="1.2"
        fill="#00f0ff"
        opacity=".5"
      />
      <text
        x="230"
        y="104"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="500"
        fontSize="16"
        fill="#9ff3ff"
        letterSpacing="20"
      >
        PINUP
      </text>
      <line
        x1="120"
        y1="113"
        x2="340"
        y2="113"
        stroke="#00f0ff"
        strokeWidth="0.8"
        opacity=".4"
      />
    </svg>
  );
}

function Compacta({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 60"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <title>Red Figure — Logo</title>
      <text
        x="118"
        y="30"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="26"
        fill="#ff007a"
        opacity=".88"
        letterSpacing="3"
      >
        RED
      </text>
      <text
        x="122"
        y="32"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="26"
        fill="#00f0ff"
        opacity=".88"
        letterSpacing="3"
      >
        RED
      </text>
      <text
        x="120"
        y="31"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="26"
        fill="#ffffff"
        letterSpacing="3"
      >
        RED
      </text>
      <rect
        x="55"
        y="16"
        width="130"
        height="1.6"
        fill="#00f0ff"
        opacity=".75"
      />
      <rect
        x="45"
        y="26"
        width="150"
        height="1.1"
        fill="#ff007a"
        opacity=".65"
      />
      <text
        x="120"
        y="50"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="500"
        fontSize="9"
        fill="#9ff3ff"
        letterSpacing="11"
      >
        FIGURE
      </text>
    </svg>
  );
}

function Icone({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <title>Red Figure — Logo</title>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="10"
        fill="#0a0118"
        stroke="#1e0a3a"
        strokeWidth="1"
      />
      <text
        x="30"
        y="40"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="28"
        fill="#ff007a"
        opacity=".88"
      >
        RF
      </text>
      <text
        x="34"
        y="42"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="28"
        fill="#00f0ff"
        opacity=".88"
      >
        RF
      </text>
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="28"
        fill="#ffffff"
      >
        RF
      </text>
      <rect x="10" y="22" width="44" height="1.2" fill="#00f0ff" opacity=".7" />
      <rect x="6" y="32" width="52" height="0.9" fill="#ff007a" opacity=".6" />
    </svg>
  );
}

function MonoBranco({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 60"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <title>Red Figure — Logo</title>
      <text
        x="120"
        y="31"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="24"
        fill="#ffffff"
        letterSpacing="3"
      >
        RED
      </text>
      <rect x="55" y="18" width="130" height="1.4" fill="#ffffff" />
      <rect x="45" y="26" width="150" height="1" fill="#ffffff" opacity=".6" />
      <text
        x="120"
        y="48"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="500"
        fontSize="8"
        fill="#ffffff"
        letterSpacing="10"
      >
        FIGURE
      </text>
    </svg>
  );
}

function MonoPreto({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 240 60"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <title>Red Figure — Logo</title>
      <text
        x="120"
        y="31"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="900"
        fontSize="24"
        fill="#0a0118"
        letterSpacing="3"
      >
        RED
      </text>
      <rect x="55" y="18" width="130" height="1.4" fill="#0a0118" />
      <rect x="45" y="26" width="150" height="1" fill="#0a0118" opacity=".6" />
      <text
        x="120"
        y="48"
        textAnchor="middle"
        fontFamily={COMMON_FONT}
        fontWeight="500"
        fontSize="8"
        fill="#0a0118"
        letterSpacing="10"
      >
        FIGURE
      </text>
    </svg>
  );
}

export function Logo({
  variant = "principal",
  className,
  ariaLabel,
}: LogoProps) {
  const label = ariaLabel ?? (variant === "icone" ? "RF" : "Red Figure");
  switch (variant) {
    case "compacta":
      return <Compacta className={className} ariaLabel={label} />;
    case "icone":
      return <Icone className={className} ariaLabel={label} />;
    case "mono-branco":
      return <MonoBranco className={className} ariaLabel={label} />;
    case "mono-preto":
      return <MonoPreto className={className} ariaLabel={label} />;
    case "principal":
    default:
      return <Principal className={className} ariaLabel={label} />;
  }
}
