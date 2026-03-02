import * as React from "react";

type Props = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

/**
 * SourceProofMark
 * Shield + checkmark verification mark. Do not edit paths or stroke widths; scale only.
 */
export const SourceKitMark = React.forwardRef<SVGSVGElement, Props>(
  ({ title = "SourceProof", ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-label={title}
      role="img"
      {...props}
    >
      {/* Shield outline */}
      <path
        d="M128 28L204 60V140C204 190 128 228 128 228C128 228 52 190 52 140V60Z"
        stroke="currentColor"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark */}
      <polyline
        points="88,132 116,164 172,100"
        stroke="currentColor"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
);
SourceKitMark.displayName = "SourceProofMark";
