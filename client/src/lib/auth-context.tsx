import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

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
            const response = await apiRequest("POST", "/api/auth/login", { username, password });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                localStorage.setItem("coster_user", JSON.stringify(data.user));
                return true;
            } else {
                console.error("Login rejected by server with status:", response.status);
                return false;
            }
        } catch (error) {
            console.error("Network or CORS error during login:", error);
            return false;
        }
    };

    const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
        try {
            const response = await apiRequest("POST", "/api/auth/register", userData);

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                localStorage.setItem("coster_user", JSON.stringify(data.user));
                return true;
            } else {
                console.error("Register rejected by server with status:", response.status);
                return false;
            }
        } catch (error) {
            console.error("Network or CORS error during register:", error);
            return false;
        }
    };

    const logout = async () => {
        try {
            // اختياري: إبلاغ السيرفر بتسجيل الخروج لإلغاء الـ Session
            await apiRequest("POST", "/api/auth/logout");
        } catch (e) {
            console.error("Logout error", e);
        }
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