export interface EventoInstalacionPwa extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface ContextoInstalacionPwa {
  disponible: boolean;
  instalando: boolean;
  ayuda: string;
  instalar(): Promise<void>;
}
