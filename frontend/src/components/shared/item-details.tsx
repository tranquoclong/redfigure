import { formatCurrency } from "@/lib/constants";

interface CartItemDetailsProps {
  variationLabel?: string | null;
  variationName?: string | null;
  scaleName?: string | null;

  scaleExtraPrice?: number;

  price?: number;
  className?: string;
}

export function CartItemDetails({
  variationLabel,
  variationName,
  scaleName,
  scaleExtraPrice,
  price,
  className = "text-xs text-white/50",
}: CartItemDetailsProps) {
  const parts: React.ReactNode[] = [];

  if (variationName) {
    parts.push(
      <span key="var">
        {variationLabel ?? "Phiên bản"}:{" "}
        <span className="text-cyan">{variationName}</span>
      </span>,
    );
  }

  if (scaleName) {
    parts.push(
      <span key="scale">
        Kích thước: <span className="text-cyan">{scaleName}</span>
        {scaleExtraPrice != null && scaleExtraPrice > 0 && (
          <span className="text-white/40 ml-1">
            (+{formatCurrency(scaleExtraPrice)})
          </span>
        )}
      </span>,
    );
  }

  if (price != null && price > 0) {
    parts.push(
      <span
        key="price"
        className="[font-family:var(--font-orbitron)] text-white font-medium"
      >
        {formatCurrency(price)}
      </span>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">·</span>}
          {part}
        </span>
      ))}
    </span>
  );
}

interface OrderItemDetailsProps {
  variationLabel?: string | null;
  variationName?: string | null;
  scaleName?: string | null;

  scalePercentage?: number | null;

  unitPrice?: number;
  className?: string;
}

export function OrderItemDetails({
  variationLabel,
  variationName,
  scaleName,
  scalePercentage,
  unitPrice,
  className = "text-xs text-white/50",
}: OrderItemDetailsProps) {
  const parts: React.ReactNode[] = [];

  if (variationName) {
    parts.push(
      <span key="var">
        {variationLabel ?? "Phiên bản"}:{" "}
        <span className="text-cyan">{variationName}</span>
      </span>,
    );
  }

  if (scaleName) {
    parts.push(
      <span key="scale">
        Kích thước: <span className="text-cyan">{scaleName}</span>
        {scalePercentage != null &&
          scalePercentage > 0 &&
          unitPrice != null && (
            <span className="text-white/40 ml-1">
              (+{scalePercentage}%
              {unitPrice > 0 &&
                ` = +${formatCurrency(unitPrice - unitPrice / (1 + scalePercentage / 100))}`}
              )
            </span>
          )}
      </span>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">·</span>}
          {part}
        </span>
      ))}
    </span>
  );
}
