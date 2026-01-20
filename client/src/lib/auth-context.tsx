import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("coster_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("coster_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("coster_user", JSON.stringify(data.user));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("coster_user", JSON.stringify(data.user));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("coster_user");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
