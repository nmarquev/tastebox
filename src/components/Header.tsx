import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Download, User, LogOut, Settings, FileText, Volume2, Sparkles, Chrome, Cpu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EditProfileModal } from "@/components/EditProfileModal";
import { DocxImportModal } from "@/components/DocxImportModal";
import { PdfImportModal } from "@/components/pdf/PdfImportModal";
import { BulkUrlImportModal } from "@/components/BulkUrlImportModal";
import { IntelligentSearchModal } from "@/components/IntelligentSearchModal";
import { ExtensionInstallModal } from "@/components/ExtensionInstallModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { VoiceSettingsModal } from "@/components/VoiceSettingsModal";
import { ModelSettingsModal } from "@/components/ModelSettingsModal";
import { getServerBaseUrl } from "@/utils/api";
import { Theme, useTheme } from "@/contexts/ThemeContext";

const THEME_LOGOS: Record<Theme, string> = {
  carrot: "/logos/logo_carrot.png",
  violetas: "/logos/logo_violetas.png",
  tierra: "/logos/logo_tierra.png",
  frutilla: "/logos/logo_frutilla.png",
  aguamarina: "/logos/logo_aguamarina.png",
  pasteles: "/logos/logo_pasteles.png",
};

interface HeaderProps {
  onAddRecipe: () => void;
  onImportRecipe: () => void;
  onRecipeAdded?: () => void;
  onViewRecipe?: (recipe: any) => void;
  onLogoClick?: () => void;
  navItems?: { label: string; active: boolean; onClick: () => void }[];
  minimal?: boolean;
}

export const Header = ({
  onAddRecipe,
  onImportRecipe,
  onRecipeAdded,
  onViewRecipe,
  onLogoClick,
  minimal,
  navItems
}: HeaderProps) => {
  const headerRef = useRef<HTMLElement>(null);
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isDocxImportModalOpen, setIsDocxImportModalOpen] = useState(false);
  const [isPdfImportModalOpen, setIsPdfImportModalOpen] = useState(false);
  const [isBulkUrlImportModalOpen, setIsBulkUrlImportModalOpen] = useState(false);
  const [isVoiceSettingsModalOpen, setIsVoiceSettingsModalOpen] = useState(false);
  const [isIntelligentSearchModalOpen, setIsIntelligentSearchModalOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isModelSettingsModalOpen, setIsModelSettingsModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty(
        '--tastebox-header-height',
        `${header.getBoundingClientRect().height}px`
      );
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-white border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center rounded-md bg-white px-2 py-1 transition-transform hover:scale-105"
            title="Ir a la página principal"
            aria-label="Ir a la página principal"
          >
            <img
              src={THEME_LOGOS[theme]}
              alt="TasteBox"
              className="h-14 w-auto max-w-[280px] bg-white object-contain"
            />
          </button>

          {navItems && navItems.length > 0 && (
            <nav className="flex items-center gap-1 sm:gap-2">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`relative px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
                    item.active
                      ? 'text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {minimal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.close()}
              className="ml-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Cerrar
            </Button>
          )}

          <div className={`flex items-center justify-end gap-3 flex-wrap ${minimal ? 'hidden' : ''}`}>
              <ThemeSwitcher />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/80 border-0 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Importar Receta</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onImportRecipe}>
                    <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                    URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsBulkUrlImportModalOpen(true)}>
                    <Download className="mr-2 h-4 w-4 text-muted-foreground" />
                    URLs
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsDocxImportModalOpen(true)}>
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    DOCX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={onAddRecipe}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/80 border-0 transition-all duration-200 hover:scale-105 hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Receta</span>
              </Button>

              <Button
                onClick={() => setIsIntelligentSearchModalOpen(true)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/80 border-0 transition-all duration-200 hover:scale-105 hover:shadow-md"
                title="Búsqueda Inteligente con IA"
              >
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span className="hidden sm:inline font-medium">Buscador Inteligente</span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user?.profilePhoto ? `${getServerBaseUrl()}${user.profilePhoto}` : undefined}
                        alt={user?.name || 'Usuario'}
                      />
                      <AvatarFallback className="bg-[#a8dce9] text-[#6f6f6d] text-xs">
                        {getUserInitials(user?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user?.name}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsEditProfileModalOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Editar perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsVoiceSettingsModalOpen(true)}>
                    <Volume2 className="mr-2 h-4 w-4" />
                    Configuración de voz
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsModelSettingsModalOpen(true)}>
                    <Cpu className="mr-2 h-4 w-4" />
                    Configuración de IA
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsExtensionModalOpen(true)}>
                    <Chrome className="mr-2 h-4 w-4" />
                    Instalar Extensión Chrome
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>
      </div>

      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
      />

      <DocxImportModal
        isOpen={isDocxImportModalOpen}
        onClose={() => setIsDocxImportModalOpen(false)}
        onRecipeSaved={(recipeId) => {
          console.log('Recipe saved from DOCX:', recipeId);
          onRecipeAdded?.(); // Refresh the recipes list
        }}
      />

      <PdfImportModal
        isOpen={isPdfImportModalOpen}
        onClose={() => setIsPdfImportModalOpen(false)}
        onRecipeSaved={(recipeId) => {
          console.log('Recipe saved from PDF:', recipeId);
          onRecipeAdded?.(); // Refresh the recipes list
        }}
      />

      <BulkUrlImportModal
        isOpen={isBulkUrlImportModalOpen}
        onClose={() => setIsBulkUrlImportModalOpen(false)}
        onRecipeSaved={() => {
          onRecipeAdded?.(); // Refresh the recipes list
        }}
      />

      <VoiceSettingsModal
        isOpen={isVoiceSettingsModalOpen}
        onClose={() => setIsVoiceSettingsModalOpen(false)}
      />

      <IntelligentSearchModal
        isOpen={isIntelligentSearchModalOpen}
        onClose={() => setIsIntelligentSearchModalOpen(false)}
        onRecipeSaved={(recipeId) => {
          console.log('Recipe saved from AI search:', recipeId);
          onRecipeAdded?.(); // Refresh the recipes list
        }}
        onViewRecipe={onViewRecipe}
      />

      <ExtensionInstallModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />

      <ModelSettingsModal
        isOpen={isModelSettingsModalOpen}
        onClose={() => setIsModelSettingsModalOpen(false)}
      />
    </header>
  );
};
