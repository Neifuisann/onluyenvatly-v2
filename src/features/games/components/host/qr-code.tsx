import { encode } from "uqr";

/**
 * The join link as a QR code, drawn on the server as one SVG path, so the
 * encoder never ships to the browser. Dark modules use `currentColor`; the
 * caller sets the light background (a white card reads best on a projector).
 */
export function QrCode({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const { data, size } = encode(text, { ecc: "M", border: 2 });
  let d = "";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
