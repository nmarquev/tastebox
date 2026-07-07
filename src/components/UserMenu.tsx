import { useState } from "react";
import { Chrome, Cpu, LogOut, Settings, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { getServerBaseUrl } from "@/utils/api";
import { EditProfileModal } from "@/components/EditProfileModal";
import { VoiceSettingsModal } from "@/components/VoiceSettingsModal";
import { ModelSettingsModal } from "@/components/ModelSettingsModal";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isVoiceSettingsModalOpen, setIsVoiceSettingsModalOpen] = useState(false);
  const [isModelSettingsModalOpen, setIsModelSettingsModalOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  const initials = (user?.name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.profilePhoto ? `${getServerBaseUrl()}${user.profilePhoto}` : undefined}
                alt={user?.name || "Usuario"}
              />
              <AvatarFallback className="bg-[#a8dce9] text-xs text-[#6f6f6d]">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{user?.name}</p>
              <p className="w-[200px] truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsEditProfileModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Editar perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsVoiceSettingsModalOpen(true)}>
            <Volume2 className="mr-2 h-4 w-4" />
            Configuracion de voz
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsModelSettingsModalOpen(true)}>
            <Cpu className="mr-2 h-4 w-4" />
            Configuracion de IA
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsExtensionModalOpen(true)}>
            <Chrome className="mr-2 h-4 w-4" />
            Instalar Extension Chrome
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
      />
      <VoiceSettingsModal
        isOpen={isVoiceSettingsModalOpen}
        onClose={() => setIsVoiceSettingsModalOpen(false)}
      />
      <ModelSettingsModal
        isOpen={isModelSettingsModalOpen}
        onClose={() => setIsModelSettingsModalOpen(false)}
      />
      <ExtensionInstallModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />
    </>
  );
};
