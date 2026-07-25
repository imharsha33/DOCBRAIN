import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
} from "@/components/ui/sidebar";
import {
    LayoutDashboard,
    FileText,
    MessageSquare,
    FolderKanban,
    Settings,
    Sparkles,
    LogOut,
} from "lucide-react";
import { auth } from "@/integrations/firebase/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";

const items = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Documents", url: "/documents", icon: FileText },
    { title: "Chat", url: "/chat", icon: MessageSquare },
    { title: "Collections", url: "/collections", icon: FolderKanban },
    { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
    const path = useRouterState({ select: (r) => r.location.pathname });
    const navigate = useNavigate();
    const qc = useQueryClient();

    async function handleSignOut() {
        await qc.cancelQueries();
        qc.clear();
        await signOut(auth);
        navigate({ to: "/auth", replace: true });
    }

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
                        <img src="/logo.jpg" alt="DocBrain Logo" className="h-full w-full object-cover" />
                    </div>
                    <span className="font-semibold tracking-tight">DocBrain AI</span>
                </Link>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.url}>
                                    <SidebarMenuButton asChild isActive={path === item.url || path.startsWith(item.url + "/")}>
                                        <Link to={item.url} className="flex items-center gap-2">
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
