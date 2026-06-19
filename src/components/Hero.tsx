import { Button } from "@/components/ui/button";
import { ChefHat, Heart, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface HeroProps {
  onGetStarted: () => void;
  onViewFeatured: () => void;
}

// Imágenes de fondo del banner (en public/). Se van alternando con un fundido.
const HERO_IMAGES = ["/hero-bg.webp", "/hero-bg2.webp"];
const HERO_INTERVAL_MS = 6000;

export const Hero = ({ onGetStarted, onViewFeatured }: HeroProps) => {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    if (HERO_IMAGES.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % HERO_IMAGES.length);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative bg-gradient-warm overflow-hidden">
      {/* Imágenes de fondo (en public/), se alternan con fundido cruzado */}
      {HERO_IMAGES.map((src, index) => (
        <div
          key={src}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            index === currentImage ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
      {/* Filtro para que se lean bien las letras: más opaco a la izquierda (texto) y
          más transparente a la derecha para que se vea la imagen. */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/50" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6 sm:py-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-primary font-medium">Tu cocina inteligente</span>
              </div>
            </div>
            
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight shimmer-text">
              Organiza tus recetas como nunca antes
            </h1>
            
            <p className="mt-6 text-xl text-muted-foreground max-w-2xl">
              Guarda, organiza e importa tus recetas favoritas desde cualquier web. 
              Tu colección personal de sabores únicos, siempre a tu alcance.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button
                onClick={onGetStarted}
                className="text-lg px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                <ChefHat className="mr-2 h-5 w-5" />
                Comenzar a cocinar
              </Button>

              <Button
                onClick={onViewFeatured}
                variant="outline"
                size="lg"
                className="text-lg px-8 py-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Heart className="mr-2 h-5 w-5" />
                Ver recetas destacadas
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};