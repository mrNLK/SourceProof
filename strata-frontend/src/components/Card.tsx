import { ReactNode } from "react";

export default function Card({
  title,
  value,
  children,
}: {
  title: string;
  value?: string | number;
  children?: ReactNode;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5">
      <div className="text-muted text-xs uppercase tracking-wider mb-1">{title}</div>
      {value !== undefined && (
        <div className="text-2xl font-semibold text-text">{value}</div>
      )}
      {children}
    </div>
  );
}
