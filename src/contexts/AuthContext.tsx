import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string;
  alias?: string;
  profilePhoto?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, alias?: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const url = new URL(window.location.href);

      if (url.searchParams.get('google_login') === 'success') {
        try {
          const response = await api.auth.completeGoogleLogin();
          const userData = {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            alias: response.user.alias,
            profilePhoto: response.user.profilePhoto
          };
          setUser(userData);
          localStorage.setItem('thermomix_user', JSON.stringify(userData));
          checkBookmarkletLogin();
        } catch (error) {
          console.error('Google login error:', error);
          localStorage.removeItem('thermomix_user');
          localStorage.removeItem('auth_token');
        } finally {
          url.searchParams.delete('google_login');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          setIsLoading(false);
        }
        return;
      }

      const savedUser = localStorage.getItem('thermomix_user');
      const authToken = localStorage.getItem('auth_token');

      if (savedUser && authToken) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          checkBookmarkletLogin();
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          localStorage.removeItem('thermomix_user');
          localStorage.removeItem('auth_token');
        }
      } else {
        localStorage.removeItem('thermomix_user');
        localStorage.removeItem('auth_token');
      }
      setIsLoading(false);
    };

    void initializeAuth();
  }, []);

  // Function to check if this is a bookmarklet login and notify parent
  const checkBookmarkletLogin = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isBookmarklet = urlParams.get('bookmarklet') === 'true';

    if (isBookmarklet && window.opener) {
      console.log('🔖 Detected bookmarklet login, notifying parent window...');

      // Send message to parent window (bookmarklet)
      try {
        window.opener.postMessage({
          type: 'TASTEBOX_LOGIN_SUCCESS',
          timestamp: Date.now()
        }, '*');

        console.log('✅ Login success message sent to bookmarklet');

        // Close this window after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);

      } catch (error) {
        console.error('Error sending message to parent window:', error);
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await api.auth.login(email, password);
      const userData = { id: response.user.id, email: response.user.email, name: response.user.name, alias: response.user.alias, profilePhoto: response.user.profilePhoto };
      setUser(userData);
      localStorage.setItem('thermomix_user', JSON.stringify(userData));

      // Check if this login should notify bookmarklet
      checkBookmarkletLogin();

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string, alias?: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await api.auth.register(email, password, name, alias);
      const userData = { id: response.user.id, email: response.user.email, name: response.user.name, alias: response.user.alias, profilePhoto: response.user.profilePhoto };
      setUser(userData);
      localStorage.setItem('thermomix_user', JSON.stringify(userData));

      // Check if this registration should notify bookmarklet
      checkBookmarkletLogin();

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Register error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('thermomix_user');
    api.auth.logout();
  };

  const refreshUser = async () => {
    try {
      const userData = await api.auth.getProfile();
      setUser(userData);
      localStorage.setItem('thermomix_user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error refreshing user data:', error);
      // If refresh fails, try to get user from localStorage
      const savedUser = localStorage.getItem('thermomix_user');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } catch (parseError) {
          console.error('Error parsing saved user data:', parseError);
        }
      }
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    refreshUser,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
