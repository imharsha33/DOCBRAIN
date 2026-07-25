import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { auth } from "@/integrations/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "docbrain-theme";

function apply(theme: "light" | "dark") {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    useEffect(() => {
        const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as
            | "light"
            | "dark"
            | null;
        const initial = stored ?? "dark";
        setTheme(initial);
        apply(initial);
    }, []);
    const toggle = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        apply(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch { }
    };
    return { theme, toggle };
}

export function ThemeToggle() {
    const { theme, toggle } = useTheme();
    return (
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
    );
}

export function useAuthUser() {
    const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser({ id: firebaseUser.uid, email: firebaseUser.email ?? null });
            } else {
                setUser(null);
            }
            setLoading(false);
            router.invalidate();
        });
        return unsubscribe;
    }, [router]);
    return { user, loading };
}
