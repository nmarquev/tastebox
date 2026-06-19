import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Volume2, Play, Save, RotateCcw, Settings } from "lucide-react";

interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
  voice: string;
  language: string;
}

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
  voice: 'default',
  language: 'es-AR'
};

const LANGUAGE_OPTIONS = [
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-US', label: 'Español (Estados Unidos)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' }
];

export const VoiceSettingsModal = ({ isOpen, onClose }: VoiceSettingsModalProps) => {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [testText] = useState("Hola, esta es una prueba de voz para la configuración de TTS.");

  // Load voices and settings on mount
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    const loadSettings = () => {
      const saved = localStorage.getItem('voice_settings');
      if (saved) {
        try {
          const parsedSettings = JSON.parse(saved);
          setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
        } catch (error) {
          console.error('Error loading voice settings:', error);
        }
      }
    };

    loadVoices();
    loadSettings();

    // Some browsers load voices asynchronously
    speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Filter voices by selected language
  const filteredVoices = availableVoices.filter(voice =>
    voice.lang.startsWith(settings.language.split('-')[0])
  );

  const handleSettingChange = (key: keyof VoiceSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestVoice = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = settings.volume;
      utterance.lang = settings.language;

      // Set specific voice if selected
      if (settings.voice) {
        const selectedVoice = availableVoices.find(voice => voice.name === settings.voice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      speechSynthesis.speak(utterance);
    }
  };

  const handleSave = () => {
    setLoading(true);
    try {
      localStorage.setItem('voice_settings', JSON.stringify(settings));
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error saving voice settings:', error);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('voice_settings');
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        closeButtonClassName="h-8 w-8 rounded-md bg-primary text-primary-foreground opacity-100 inline-flex items-center justify-center shadow-sm hover:bg-primary/90 hover:opacity-100 data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Configuración de Voz</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!('speechSynthesis' in window) && (
            <Alert variant="destructive">
              <AlertDescription>
                Tu navegador no soporta síntesis de voz (TTS). Esta funcionalidad no estará disponible.
              </AlertDescription>
            </Alert>
          )}

          {/* Language Selection */}
          <div className="space-y-2">
            <Label htmlFor="language">Idioma</Label>
            <Select
              value={settings.language}
              onValueChange={(value) => handleSettingChange('language', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar idioma" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label htmlFor="voice">Voz</Label>
            <Select
              value={settings.voice}
              onValueChange={(value) => handleSettingChange('voice', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Voz por defecto del sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Voz por defecto del sistema</SelectItem>
                {filteredVoices.map(voice => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} {voice.localService ? '(Local)' : '(Remota)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {filteredVoices.length} voz(ces) disponible(s) para {settings.language}
            </p>
          </div>

          {/* Rate Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="rate">Velocidad</Label>
              <span className="text-sm text-muted-foreground">{settings.rate.toFixed(1)}x</span>
            </div>
            <Slider
              value={[settings.rate]}
              onValueChange={(value) => handleSettingChange('rate', value[0])}
              min={0.1}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Muy lenta</span>
              <span>Normal</span>
              <span>Muy rápida</span>
            </div>
          </div>

          {/* Pitch Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="pitch">Tono</Label>
              <span className="text-sm text-muted-foreground">{settings.pitch.toFixed(1)}</span>
            </div>
            <Slider
              value={[settings.pitch]}
              onValueChange={(value) => handleSettingChange('pitch', value[0])}
              min={0.1}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Grave</span>
              <span>Normal</span>
              <span>Agudo</span>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label htmlFor="volume">Volumen</Label>
              <span className="text-sm text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider
              value={[settings.volume]}
              onValueChange={(value) => handleSettingChange('volume', value[0])}
              min={0.1}
              max={1.0}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Test Voice */}
          <div className="space-y-2">
            <Label>Probar configuración</Label>
            <Button
              variant="outline"
              onClick={handleTestVoice}
              className="w-full"
              disabled={!('speechSynthesis' in window)}
            >
              <Play className="h-4 w-4 mr-2" />
              Reproducir texto de prueba
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between space-x-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restablecer
            </Button>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};