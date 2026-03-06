import { useEffect, useState } from "react";

let showToastFn: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  showToastFn?.(msg);
}

export default function ToastContainer() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    showToastFn = (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 3000);
    };
    return () => {
      showToastFn = null;
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-accent text-bg px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50">
      {message}
    </div>
  );
}
