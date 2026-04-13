import { LogOut, Menu } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <button onClick={onMenuClick} className="md:hidden">
        <Menu size={20} />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  );
}
