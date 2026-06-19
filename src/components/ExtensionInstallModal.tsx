import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Chrome, CheckCircle2 } from "lucide-react";

interface ExtensionInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionInstallModal = ({ isOpen, onClose }: ExtensionInstallModalProps) => {
  // Detect environment
  const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';
  const extensionDownloadUrl = 'https://tastebox.beweb.com.ar/downloads/tastebox-extension.zip';

  const handleInstallExtension = () => {
    if (isProduction) {
      // In production, download extension zip
      window.open(extensionDownloadUrl, '_blank');
    } else {
      // In development, open extension folder
      window.open('file:///C:/Users/nicol/Local Sites/recipe-genius/thermo-recipe-genius/extension', '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Chrome className="h-6 w-6 text-primary" />
            Instalar Extensión Chrome de TasteBox
          </DialogTitle>
          <DialogDescription>
            Importa recetas desde cualquier sitio web con un solo click
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Features */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              ¿Qué puedes hacer con la extensión?
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong>Detección automática:</strong> La extensión detecta recetas en la página que estás visitando</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong>Importación con 1 click:</strong> Botón flotante para guardar recetas instantáneamente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong>Sin limitaciones:</strong> Funciona en cualquier sitio web de recetas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span><strong>Configuración dev/prod:</strong> Cambia entre desarrollo y producción fácilmente</span>
              </li>
            </ul>
          </div>

          {/* Installation Steps - Production */}
          {isProduction ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Instalación Manual</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Descarga la extensión</p>
                    <p className="text-sm text-muted-foreground">Click en "Descargar Extensión" abajo para obtener el archivo ZIP</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Descomprime el archivo</p>
                    <p className="text-sm text-muted-foreground">Extrae el contenido del ZIP en una carpeta de tu elección</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Abre Chrome Extensions</p>
                    <p className="text-sm text-muted-foreground">Ve a <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions/</code> en tu navegador</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Activa "Modo de desarrollador"</p>
                    <p className="text-sm text-muted-foreground">Toggle en la esquina superior derecha de la página</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    5
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Carga la extensión</p>
                    <p className="text-sm text-muted-foreground">Click en "Cargar extensión sin empaquetar" y selecciona la carpeta que descomprimiste</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    6
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">¡Listo!</p>
                    <p className="text-sm text-muted-foreground">Verás el ícono de TasteBox en tu barra de herramientas</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Installation Steps - Development */
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Instalación (Modo Desarrollo)</h3>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Abre Chrome Extensions</p>
                    <p className="text-sm text-muted-foreground">Ve a <code className="bg-muted px-1 py-0.5 rounded">chrome://extensions/</code> en tu navegador Chrome</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Activa "Modo de desarrollador"</p>
                    <p className="text-sm text-muted-foreground">Toggle en la esquina superior derecha de la página</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Carga la extensión sin empaquetar</p>
                    <p className="text-sm text-muted-foreground mb-2">Click en "Cargar extensión sin empaquetar"</p>
                    <p className="text-sm text-muted-foreground">Selecciona la carpeta:</p>
                    <code className="block bg-muted px-2 py-1 rounded text-xs mt-1 break-all">
                      C:\Users\nicol\Local Sites\recipe-genius\thermo-recipe-genius\extension
                    </code>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">¡Listo!</p>
                    <p className="text-sm text-muted-foreground">Verás el ícono de TasteBox en tu barra de extensiones</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Usage */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold text-lg">Cómo usar</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Navega a cualquier sitio web con recetas (ej: cookpad.com, cookidoo.international)</li>
              <li>Si detecta una receta, verás un <strong className="text-primary">botón flotante naranja</strong></li>
              <li>Click en el botón para importar la receta a TasteBox</li>
              <li>Alternativamente, usa el ícono de la extensión para importar manualmente</li>
            </ol>
          </div>

          {/* Environment Note */}
          {!isProduction && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>💡 Nota:</strong> Estás en modo desarrollo. En producción, la extensión estará disponible en Chrome Web Store para instalación con un solo click.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {isProduction ? (
              <>
                <Button
                  onClick={handleInstallExtension}
                  variant="default"
                  className="flex-1 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Descargar Extensión
                </Button>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleInstallExtension}
                  variant="outline"
                  className="flex-1 flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Carpeta de Extensión
                </Button>
                <Button
                  onClick={onClose}
                  variant="default"
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};