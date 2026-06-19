import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, AlertCircle } from "lucide-react";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  loading: boolean;
}

export const FileUploader = ({ onFileSelect, loading }: FileUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const validateFile = (file: File): boolean => {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Por favor selecciona un archivo .docx válido');
      return false;
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. El tamaño máximo es 50MB.');
      return false;
    }

    return true;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold">Selecciona tu documento Word</h3>
        <p className="text-sm text-muted-foreground">
          Sube un archivo .docx que contenga tus recetas para importarlas automáticamente
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <Card className={`border-2 border-dashed transition-colors ${
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      }`}>
        <CardContent className="p-4">
          <div
            className="text-center space-y-2"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex justify-center">
              <div className="p-2.5 bg-primary/10 rounded-full">
                <Upload className={`h-6 w-6 ${dragActive ? "text-primary" : "text-muted-foreground"}`} />
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-base font-medium">
                {dragActive ? "Suelta tu archivo aquí" : "Arrastra y suelta tu archivo .docx"}
              </p>
              <p className="text-sm text-muted-foreground">
                o haz clic en el botón para seleccionar
              </p>
            </div>

            <div className="pt-1">
              <input
                type="file"
                accept=".docx"
                onChange={handleFileInput}
                disabled={loading}
                className="hidden"
                id="docx-file-input"
              />
              <label htmlFor="docx-file-input">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="cursor-pointer"
                  asChild
                >
                  <span>
                    <FileText className="h-4 w-4 mr-2" />
                    {loading ? "Procesando..." : "Seleccionar Archivo"}
                  </span>
                </Button>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium text-xs">Instrucciones:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Solo archivos .docx (Microsoft Word)</li>
              <li>• Tamaño máximo: 50MB</li>
              <li>• Recetas bien estructuradas (ingredientes e instrucciones)</li>
              <li>• Después elegís qué páginas procesar</li>
            </ul>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <FileText className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium text-xs">¿Qué esperamos encontrar?</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Títulos de recetas claros</li>
              <li>• Ingredientes con cantidades</li>
              <li>• Instrucciones paso a paso</li>
              <li>• Opcional: tiempos, porciones, dificultad</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};