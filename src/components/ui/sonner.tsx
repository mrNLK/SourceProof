import { useSyncExternalStore } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function getTheme() {
  return (typeof localStorage !== "undefined" && localStorage.getItem("sourcekit-theme")) || "dark";
}

function subscribeTheme(cb: () => void) {
  const handler = (e: StorageEvent) => { if (e.key === "sourcekit-theme") cb(); };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark");

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
