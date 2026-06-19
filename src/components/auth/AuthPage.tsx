import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ChefHat, Sparkles, BookOpen, Heart } from 'lucide-react';
import { Theme, useTheme } from '@/contexts/ThemeContext';

const THEME_LOGOS: Record<Theme, string> = {
  carrot: '/logos/logo_carrot.png',
  violetas: '/logos/logo_violetas.png',
  tierra: '/logos/logo_tierra.png',
  frutilla: '/logos/logo_frutilla.png',
  aguamarina: '/logos/logo_aguamarina.png',
  pasteles: '/logos/logo_pasteles.png',
};

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { theme } = useTheme();

  return (
    <div className="min-h-screen flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>
      </div>

      {/* Right side - Modern TasteBox branding */}
      <div className="hidden lg:block flex-1 relative bg-gradient-to-br from-primary/5 via-primary/20 to-primary/5">
        {/* Cooking pot simulation with bubbles */}
        <div className="absolute inset-0">
          {/* Bubbles rising from pot */}
          <div className="absolute inset-0 opacity-15">
            {/* Large bubbles */}
            <div className="absolute bottom-12 left-[20%] w-6 h-6 bg-orange-300 rounded-full animate-bubble-1"></div>
            <div className="absolute bottom-12 left-[35%] w-4 h-4 bg-amber-300 rounded-full animate-bubble-2"></div>
            <div className="absolute bottom-12 left-[50%] w-5 h-5 bg-orange-400 rounded-full animate-bubble-3"></div>
            <div className="absolute bottom-12 left-[65%] w-3 h-3 bg-amber-400 rounded-full animate-bubble-4"></div>
            <div className="absolute bottom-12 left-[80%] w-7 h-7 bg-orange-200 rounded-full animate-bubble-5"></div>

            {/* Medium bubbles */}
            <div className="absolute bottom-12 left-[25%] w-3 h-3 bg-amber-200 rounded-full animate-bubble-6"></div>
            <div className="absolute bottom-12 left-[42%] w-4 h-4 bg-orange-300 rounded-full animate-bubble-7"></div>
            <div className="absolute bottom-12 left-[58%] w-3 h-3 bg-amber-300 rounded-full animate-bubble-8"></div>
            <div className="absolute bottom-12 left-[72%] w-2 h-2 bg-orange-400 rounded-full animate-bubble-9"></div>

            {/* Small bubbles */}
            <div className="absolute bottom-12 left-[30%] w-2 h-2 bg-amber-100 rounded-full animate-bubble-10"></div>
            <div className="absolute bottom-12 left-[45%] w-2 h-2 bg-orange-200 rounded-full animate-bubble-11"></div>
            <div className="absolute bottom-12 left-[60%] w-2 h-2 bg-amber-200 rounded-full animate-bubble-12"></div>
            <div className="absolute bottom-12 left-[75%] w-1 h-1 bg-orange-300 rounded-full animate-bubble-13"></div>
          </div>
        </div>

        {/* Main content */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center max-w-lg">
            {/* Real app logo */}
            <div className="flex items-center justify-center mb-8">
              <img
                src={THEME_LOGOS[theme] || '/logo2.png'}
                alt="TasteBox"
                className="h-28 w-auto max-w-full object-contain"
              />
            </div>

            {/* Main tagline */}
            <p className="text-2xl font-medium text-gray-700 mb-6">
              Tu colección personal de sabores únicos
            </p>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Importa recetas desde cualquier web, organiza tu cocina digital y descubre nuevos sabores con inteligencia artificial
            </p>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">IA para importar recetas</span>
              </div>
              <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Organización inteligente</span>
              </div>
              <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <Heart className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Recetas favoritas</span>
              </div>
              <div className="flex items-center space-x-3 bg-white/50 backdrop-blur-sm rounded-lg p-3">
                <ChefHat className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-gray-700">Soporte Thermomix</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
