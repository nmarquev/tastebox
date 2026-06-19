import { useRef, useState } from "react";
import { Upload, Globe, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CoverPickerProps {
  /** URL de la vista previa actual (blob: para archivos locales, o URL servida). */
  previewUrl: string | null;
  /** true mientras se descarga/optimiza una imagen desde la web. */
  loading?: boolean;
  /** Se llama cuando el usuario elige un archivo de su PC (o arrastra uno). */
  onPickFile: (file: File) => void;
  /** Se llama con la URL de una imagen elegida/arrastrada desde la web. */
  onPickUrl: (url: string) => void;
  /** Quitar la portada elegida. */
  onClear: () => void;
}

// Selector de portada reutilizable: arrastrar, elegir de la PC o pegar una URL de la web.
export function CoverPicker({ previewUrl, loading, onPickFile, onPickUrl, onClear }: CoverPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) { onPickFile(files[0]); return; }
    const html = e.dataTransfer.getData("text/html");
    const htmlSrc = html ? (html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "") : "";
    const url = (e.dataTransfer.getData("text/uri-list") || htmlSrc || e.dataTransfer.getData("text/plain") || "").trim();
    if (/^https?:\/\//i.test(url)) { onPickUrl(url); }
  };

  const submitUrl = () => {
    const url = urlValue.trim();
    if (!url) return;
    onPickUrl(url);
    setUrlValue("");
    setShowUrlInput(false);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* Recuadro para arrastrar / vista previa */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex h-28 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-gray-300"
          }`}
        >
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Portada" className="h-full w-full rounded-md object-cover" />
              <button
                type="button"
                onClick={onClear}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                aria-label="Quitar portada"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : loading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="text-xs text-gray-600">Agregando imagen...</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-gray-400" />
              <span className="text-xs text-gray-600">Arrastrá una imagen acá (desde tu PC o desde una página web)</span>
            </>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-col items-stretch justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            Agregar imagen de Mi PC
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={loading}
            onClick={() => setShowUrlInput(v => !v)}
          >
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-2 h-3.5 w-3.5" />}
            Agregar imagen de la web
          </Button>
        </div>
      </div>

      {showUrlInput && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitUrl(); } }}
            placeholder="Pegá el enlace de la imagen (https://...)"
            className="h-9"
            autoFocus
          />
          <Button type="button" size="sm" disabled={loading || !urlValue.trim()} onClick={submitUrl}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
