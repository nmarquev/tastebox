import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cpu, Save, RotateCcw, Loader2, KeyRound, CheckCircle2, PlugZap } from "lucide-react";
import { api, AiSettings, CookidooSettings, FooditSettings } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ModelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Presets comunes. Con OpenRouter como proveedor, el id lleva prefijo (openai/, anthropic/, etc.).
const MODEL_PRESETS = [
  { value: "openai/gpt-4o-mini", label: "OpenAI · GPT-4o mini (rápido/barato)" },
  { value: "openai/gpt-4o", label: "OpenAI · GPT-4o" },
  { value: "anthropic/claude-3.5-sonnet", label: "Anthropic · Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3.5-haiku", label: "Anthropic · Claude 3.5 Haiku" },
  { value: "google/gemini-flash-1.5", label: "Google · Gemini 1.5 Flash" },
  { value: "meta-llama/llama-3.1-70b-instruct", label: "Meta · Llama 3.1 70B" },
];

export const ModelSettingsModal = ({ isOpen, onClose }: ModelSettingsModalProps) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [model, setModel] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cookidoo
  const [cookidoo, setCookidoo] = useState<CookidooSettings | null>(null);
  const [ckUsername, setCkUsername] = useState("");
  const [ckPassword, setCkPassword] = useState("");
  const [savingCk, setSavingCk] = useState(false);
  const [testingCk, setTestingCk] = useState(false);

  // Foodit (La Nación)
  const [foodit, setFoodit] = useState<FooditSettings | null>(null);
  const [fdUsername, setFdUsername] = useState("");
  const [fdPassword, setFdPassword] = useState("");
  const [savingFd, setSavingFd] = useState(false);
  const [testingFd, setTestingFd] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      api.settings.getAi(),
      api.settings.getCookidoo().catch(() => null),
      api.settings.getFoodit().catch(() => null),
    ])
      .then(([s, ck, fd]) => {
        setSettings(s);
        setModel(s.overridden.model ? s.model : "");
        setVisionModel(s.overridden.visionModel ? s.visionModel : "");
        if (ck) {
          setCookidoo(ck);
          setCkUsername(ck.username || "");
        }
        setCkPassword("");
        if (fd) {
          setFoodit(fd);
          setFdUsername(fd.username || "");
        }
        setFdPassword("");
      })
      .catch((err) => {
        toast({
          title: "Error",
          description: err.message || "No se pudo cargar la configuración de IA",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [isOpen, toast]);

  const handleSaveCookidoo = async () => {
    setSavingCk(true);
    try {
      const updated = await api.settings.updateCookidoo({ username: ckUsername, password: ckPassword });
      setCookidoo(updated);
      setCkPassword("");
      toast({
        title: "Credenciales guardadas",
        description: updated.configured
          ? "Ya podés importar recetas de Cookidoo por URL."
          : "Credenciales borradas.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setSavingCk(false);
    }
  };

  const handleTestCookidoo = async () => {
    setTestingCk(true);
    try {
      const result = await api.settings.testCookidoo();
      toast({
        title: result.ok ? "Login correcto ✓" : "Login fallido",
        description: result.ok ? (result.message || "Conexión con Cookidoo OK.") : (result.error || "No se pudo iniciar sesión."),
        variant: result.ok ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo probar", variant: "destructive" });
    } finally {
      setTestingCk(false);
    }
  };

  const handleSaveFoodit = async () => {
    setSavingFd(true);
    try {
      const updated = await api.settings.updateFoodit({ username: fdUsername, password: fdPassword });
      setFoodit(updated);
      setFdPassword("");
      toast({
        title: "Credenciales guardadas",
        description: updated.configured
          ? "Ya podés importar recetas de Foodit por URL."
          : "Credenciales borradas.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setSavingFd(false);
    }
  };

  const handleTestFoodit = async () => {
    setTestingFd(true);
    try {
      const result = await api.settings.testFoodit();
      toast({
        title: result.ok ? "Login correcto ✓" : "Login fallido",
        description: result.ok ? (result.message || "Conexión con Foodit OK.") : (result.error || "No se pudo iniciar sesión."),
        variant: result.ok ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo probar", variant: "destructive" });
    } finally {
      setTestingFd(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.settings.updateAi({ model, visionModel });
      setSettings(updated);
      toast({
        title: "Guardado",
        description: `Modelo activo: ${updated.model}`,
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setModel("");
    setVisionModel("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Configuración de IA
          </DialogTitle>
          <DialogDescription>
            Elegí el modelo usado para importar recetas, nutrición y TTS. El cambio aplica al instante, sin reiniciar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo de texto</Label>
              <Select value={MODEL_PRESETS.some((p) => p.value === model) ? model : ""} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir un preset (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={settings ? `Default: ${settings.defaults.model}` : "ej: openai/gpt-4o-mini"}
              />
              <p className="text-xs text-muted-foreground">
                Vacío = usa el default del servidor ({settings?.defaults.model}).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visionModel">Modelo de visión (PDFs)</Label>
              <Input
                id="visionModel"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                placeholder={settings ? `Default: ${settings.defaults.visionModel}` : "ej: openai/gpt-4o-mini"}
              />
              <p className="text-xs text-muted-foreground">
                Debe soportar imágenes. Vacío = usa el modelo de texto.
              </p>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                Modelo activo actual: <strong>{settings?.model}</strong>
                {settings && settings.model !== settings.visionModel && (
                  <> · visión: <strong>{settings.visionModel}</strong></>
                )}
              </AlertDescription>
            </Alert>

            {/* Credenciales de Cookidoo: permiten importar recetas de Cookidoo por URL
                (el servidor inicia sesión para acceder a la preparación, que es de pago). */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Cuenta de Cookidoo</h4>
                {cookidoo?.configured && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Configurada
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Necesario para importar recetas de Cookidoo por URL. Cookidoo oculta la preparación detrás del login,
                así que el servidor inicia sesión con tu cuenta. La contraseña se guarda cifrada.
              </p>
              <div className="space-y-2">
                <Label htmlFor="ckUsername">Email</Label>
                <Input
                  id="ckUsername"
                  type="email"
                  autoComplete="off"
                  value={ckUsername}
                  onChange={(e) => setCkUsername(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ckPassword">Contraseña</Label>
                <Input
                  id="ckPassword"
                  type="password"
                  autoComplete="new-password"
                  value={ckPassword}
                  onChange={(e) => setCkPassword(e.target.value)}
                  placeholder={cookidoo?.configured ? "•••••••• (dejá vacío para mantener)" : "Tu contraseña de Cookidoo"}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestCookidoo}
                  disabled={testingCk || !cookidoo?.configured}
                  className="flex items-center gap-2"
                >
                  {testingCk ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Probar login
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCookidoo}
                  disabled={savingCk || (!ckUsername && !cookidoo?.configured)}
                  className="flex items-center gap-2"
                >
                  {savingCk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar credenciales
                </Button>
              </div>
            </div>

            {/* Credenciales de Foodit / La Nación: permiten importar recetas de Foodit por
                URL (el servidor inicia sesión con un navegador headless para acceder a los
                tips y la preparación, que están detrás del paywall). */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Cuenta de Foodit (La Nación)</h4>
                {foodit?.configured && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Configurada
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Necesario para importar recetas de Foodit por URL. Foodit oculta los tips y la preparación detrás
                del paywall, así que el servidor inicia sesión con tu cuenta de La Nación. La contraseña se guarda cifrada.
              </p>
              <div className="space-y-2">
                <Label htmlFor="fdUsername">Email</Label>
                <Input
                  id="fdUsername"
                  type="email"
                  autoComplete="off"
                  value={fdUsername}
                  onChange={(e) => setFdUsername(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fdPassword">Contraseña</Label>
                <Input
                  id="fdPassword"
                  type="password"
                  autoComplete="new-password"
                  value={fdPassword}
                  onChange={(e) => setFdPassword(e.target.value)}
                  placeholder={foodit?.configured ? "•••••••• (dejá vacío para mantener)" : "Tu contraseña de La Nación"}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestFoodit}
                  disabled={testingFd || !foodit?.configured}
                  className="flex items-center gap-2"
                >
                  {testingFd ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                  Probar login
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveFoodit}
                  disabled={savingFd || (!fdUsername && !foodit?.configured)}
                  className="flex items-center gap-2"
                >
                  {savingFd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar credenciales
                </Button>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={handleReset} disabled={saving} className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Usar default
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
