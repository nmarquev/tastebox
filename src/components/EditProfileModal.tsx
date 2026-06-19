import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Mail, Tag, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { ProfilePhotoUpload } from "./ProfilePhotoUpload";
import { getServerBaseUrl } from "@/utils/api";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal = ({ isOpen, onClose }: EditProfileModalProps) => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state (datos del perfil)
  const [formData, setFormData] = useState({
    email: user?.email || '',
    name: user?.name || '',
    alias: user?.alias || '',
  });

  // Diálogo de cambio de contraseña
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '' });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handlePhotoUpdate = async () => {
    if (refreshUser) {
      await refreshUser();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Solo enviar los campos que cambiaron
      const updateData: any = {};

      if (formData.email !== user?.email) {
        updateData.email = formData.email;
      }

      if (formData.name !== user?.name) {
        updateData.name = formData.name;
      }

      if (formData.alias !== (user?.alias || '')) {
        updateData.alias = formData.alias || null;
      }

      if (Object.keys(updateData).length === 0) {
        setError('No hay cambios para guardar');
        setLoading(false);
        return;
      }

      await api.auth.updateProfile(updateData);

      setSuccess('Perfil actualizado correctamente');

      if (refreshUser) {
        await refreshUser();
      }

      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (!passwordData.current || !passwordData.new) {
      setPwError('Completá ambos campos');
      return;
    }
    if (passwordData.new.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    setPwLoading(true);
    try {
      await api.auth.updateProfile({
        currentPassword: passwordData.current,
        newPassword: passwordData.new,
      });
      setPasswordData({ current: '', new: '' });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowPasswordDialog(false);
      setSuccess('Contraseña actualizada correctamente');
    } catch (err: any) {
      setPwError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setPwLoading(false);
    }
  };

  const closePasswordDialog = () => {
    if (pwLoading) return;
    setPasswordData({ current: '', new: '' });
    setPwError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowPasswordDialog(false);
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        email: user?.email || '',
        name: user?.name || '',
        alias: user?.alias || '',
      });
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className="sm:max-w-md max-h-[90vh] overflow-y-auto"
          closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
        >
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription className="text-green-600">{success}</AlertDescription>
              </Alert>
            )}

            {/* Profile Photo */}
            <div className="space-y-2">
              <Label>Foto de perfil</Label>
              <ProfilePhotoUpload
                currentPhotoUrl={user?.profilePhoto ? `${getServerBaseUrl()}${user.profilePhoto}` : undefined}
                onPhotoUpdate={handlePhotoUpdate}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Alias */}
            <div className="space-y-2">
              <Label htmlFor="alias">Alias (opcional)</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => handleInputChange('alias', e.target.value)}
                  className="pl-10"
                  placeholder="Cómo quieres que aparezca tu nombre"
                />
              </div>
            </div>

            {/* Botón para abrir el diálogo de cambio de contraseña */}
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowPasswordDialog(true)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Cambiar contraseña
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de cambio de contraseña */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { if (!open) closePasswordDialog(); }}>
        <DialogContent
          className="sm:max-w-md"
          closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
        >
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {pwError && (
              <Alert variant="destructive">
                <AlertDescription>{pwError}</AlertDescription>
              </Alert>
            )}

            {/* Contraseña actual */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.current}
                  onChange={(e) => { setPasswordData(prev => ({ ...prev, current: e.target.value })); setPwError(null); }}
                  className="pl-10 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            {/* Nueva contraseña */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordData.new}
                  onChange={(e) => { setPasswordData(prev => ({ ...prev, new: e.target.value })); setPwError(null); }}
                  className="pl-10 pr-10"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={closePasswordDialog} disabled={pwLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pwLoading}>
                {pwLoading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
