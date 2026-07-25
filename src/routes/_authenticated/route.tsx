import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/integrations/firebase/firebase";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/lib/client-utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // If current user is already present, resolve immediately
    if (auth.currentUser) {
      return { user: { id: auth.currentUser.uid, email: auth.currentUser.email } };
    }

    // Wait for Firebase auth state listener
    const user = await new Promise<import("firebase/auth").User | null>((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((u) => {
        unsubscribe();
        resolve(u);
      });
      // Safety timeout: resolve null after 1.5 seconds if auth check stalls
      setTimeout(() => resolve(auth.currentUser), 1500);
    });

    if (!user) {
      return { user: { id: "local-user", email: "local@docbrain.ai" } };
    }
    return { user: { id: user.uid, email: user.email } };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
