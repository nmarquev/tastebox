import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, Eye, ArrowRight } from "lucide-react";
import { DocxUploadResponse, PageRange } from "@/types/docx";
import { api } from "@/services/api";

interface PageSelectorProps {
  uploadData: DocxUploadResponse;
  onPageSelect: (pageRange: PageRange) => void;
  loading: boolean;
}

export const PageSelector = ({ uploadData, onPageSelect, loading }: PageSelectorProps) => {
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(uploadData.totalPages); // Por defecto, procesar hasta la última página
  const [preview, setPreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    // Cargar/actualizar el preview al montar y cada vez que cambia el rango (con debounce).
    const timer = setTimeout(() => { loadPreview(); }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPage, endPage]);

  const loadPreview = async () => {
    if (!uploadData.fileId) return;

    setPreviewLoading(true);
    setPreviewError('');

    try {
      const previewResponse = await api.docx.preview(
        uploadData.fileId,
        startPage,
        Math.min(endPage, startPage + 2) // Limit preview to avoid large responses
      );

      if (previewResponse.success) {
        setPreview(previewResponse.preview);
      } else {
        setPreviewError(previewResponse.error || 'Failed to load preview');
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      setPreviewError(error.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStartPageChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= uploadData.totalPages) {
      setStartPage(num);
      if (num > endPage) {
        setEndPage(num);
      }
    }
  };

  const handleEndPageChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= startPage && num <= uploadData.totalPages) {
      setEndPage(num);
    }
  };

  const handleProceed = () => {
    if (startPage <= endPage && startPage >= 1 && endPage <= uploadData.totalPages) {
      onPageSelect({ start: startPage, end: endPage });
    }
  };

  const isValidRange = startPage <= endPage && startPage >= 1 && endPage <= uploadData.totalPages;
  const pagesCount = endPage - startPage + 1;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-sm font-semibold">Selecciona las páginas a procesar</h3>
        <p className="text-xs text-muted-foreground">
          El documento tiene <span className="font-medium">{uploadData.totalPages} páginas</span>. Elegí el rango a procesar.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Page Range Selector */}
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <BookOpen className="h-5 w-5" />
              <span>Rango de Páginas</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="start-page" className="text-xs">Página inicial</Label>
                <Input
                  id="start-page"
                  type="number"
                  min={1}
                  max={uploadData.totalPages}
                  value={startPage}
                  onChange={(e) => handleStartPageChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-page" className="text-xs">Página final</Label>
                <Input
                  id="end-page"
                  type="number"
                  min={startPage}
                  max={uploadData.totalPages}
                  value={endPage}
                  onChange={(e) => handleEndPageChange(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {isValidRange && (
              <div className="text-sm text-muted-foreground">
                Se procesarán <span className="font-medium">{pagesCount} página{pagesCount !== 1 ? 's' : ''}</span>.
                {pagesCount > 10 && (
                  <span className="text-amber-600 font-medium"> (puede tardar más tiempo)</span>
                )}
              </div>
            )}

            {!isValidRange && (
              <Alert variant="destructive">
                <AlertDescription>
                  Rango de páginas inválido. La página inicial debe ser menor o igual a la final.
                </AlertDescription>
              </Alert>
            )}

          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="flex items-center space-x-2 text-lg">
              <Eye className="h-5 w-5" />
              <span>Vista Previa del Contenido</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {previewError && (
              <Alert variant="destructive">
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            )}

            <Textarea
              value={preview || uploadData.preview}
              readOnly
              className="min-h-[150px] font-mono text-xs resize-none"
              placeholder={previewLoading ? "Cargando vista previa..." : "Vista previa del contenido aparecerá aquí"}
            />

            {!preview && !previewLoading && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrando vista previa inicial del documento. Haz clic en "Vista Previa" para ver el rango seleccionado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleProceed}
          disabled={!isValidRange || loading}
          className="px-8"
        >
          Procesar las páginas
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};