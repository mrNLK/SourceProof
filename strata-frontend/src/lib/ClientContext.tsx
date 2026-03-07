import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMyClients, setAuthContext, getActiveUserEmail } from "./api";

interface Client {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_active: boolean;
}

interface ClientContextValue {
  clients: Client[];
  activeClient: Client | null;
  switchClient: (id: string) => void;
  loading: boolean;
  userEmail: string;
}

const ClientContext = createContext<ClientContextValue>({
  clients: [],
  activeClient: null,
  switchClient: () => {},
  loading: true,
  userEmail: "",
});

export function useClient() {
  return useContext(ClientContext);
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const userEmail = getActiveUserEmail();

  useEffect(() => {
    // Bootstrap: set email header, fetch client list, pick first client
    setAuthContext(userEmail, "");
    getMyClients()
      .then((list: Client[]) => {
        setClients(list);
        if (list.length > 0) {
          const saved = localStorage.getItem("strata_active_client");
          const initial = list.find((c) => c.id === saved) || list[0];
          setActiveClient(initial);
          setAuthContext(userEmail, initial.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userEmail]);

  const switchClient = (id: string) => {
    const next = clients.find((c) => c.id === id);
    if (next) {
      setActiveClient(next);
      setAuthContext(userEmail, next.id);
      localStorage.setItem("strata_active_client", next.id);
    }
  };

  return (
    <ClientContext.Provider value={{ clients, activeClient, switchClient, loading, userEmail }}>
      {children}
    </ClientContext.Provider>
  );
}
