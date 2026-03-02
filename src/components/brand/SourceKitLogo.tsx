import * as React from "react";
import { SourceKitMark } from "./SourceKitMark";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  size?: number; // height in px for the mark
  title?: string;
  className?: string;
  markClassName?: string;
  sourceClassName?: string;
  proofClassName?: string;
};

/**
 * SourceProofLogo
 * Mark + wordmark lockup (transparent background).
 * Typography assumes DM Sans is loaded in the app.
 */
export function SourceKitLogo({
  size = 24,
  title = "SourceProof",
  className,
  markClassName,
  sourceClassName,
  proofClassName,
  ...rest
}: Props) {
  return (
    <div
      aria-label={title}
      {...rest}
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 12, ...rest.style }}
    >
      <SourceKitMark
        width={size}
        height={size}
        className={markClassName}
      />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 0 }}>
        <span
          className={sourceClassName}
          style={{ fontFamily: "DM Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontWeight: 600, color: "var(--fg-primary, #FFFFFF)" }}
        >
          Source
        </span>
        <span
          className={proofClassName}
          style={{ fontFamily: "DM Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif", fontWeight: 500, color: "#9E9E9E" }}
        >
          Proof
        </span>
      </span>
    </div>
  );
}
