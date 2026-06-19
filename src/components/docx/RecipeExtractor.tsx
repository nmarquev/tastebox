import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ChefHat, FileText, ArrowRight, RotateCcw } from "lucide-react";
import { DocxUploadResponse, PageRange } from "@/types/docx";

interface RecipeExtractorProps {
  uploadData: DocxUploadResponse;
  selectedPages: PageRange;
  onRestart: () => void;
  loading: boolean;
}

export const RecipeExtractor = ({
  uploadData,
  selectedPages,
  onRestart,
  loading
}: RecipeExtractorProps) => {
  const pagesCount = selectedPages.end - selectedPages.start + 1;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          {loading ? 'Extrayendo recetas...' : 'Listo para volver a intentar'}
        </h3>
        <p className="text-muted-foreground">
          {loading
            ? 'Procesando...'
            : `No se pudo completar el procesamiento de las páginas ${selectedPages.start} a ${selectedPages.end}.`}
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Resumen del Procesamiento</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{uploadData.totalPages}</div>
              <div className="text-sm text-muted-foreground">Total de páginas</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">{pagesCount}</div>
              <div className="text-sm text-muted-foreground">Páginas a procesar</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">?</div>
              <div className="text-sm text-muted-foreground">Recetas detectadas</div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Processing Indicators */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <ChefHat className="h-6 w-6 text-blue-600 animate-pulse" />
                <div className="flex-1">
                  <h4 className="font-medium">Procesando recetas...</h4>
                  <p className="text-sm text-muted-foreground">
                    Esto puede tomar unos momentos dependiendo del número de páginas
                  </p>
                </div>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {pagesCount > 15 && !loading && (
        <Alert>
          <AlertDescription>
            <strong>Nota:</strong> Procesarás {pagesCount} páginas, lo que puede tomar varios minutos.
            Para un procesamiento más rápido, considera dividir el documento en rangos más pequeños.
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {!loading && <div className="flex flex-wrap justify-center gap-3">
        <Button
          size="lg"
          onClick={onRestart}
          className="px-8"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reintentar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>}
    </div>
  );
};
