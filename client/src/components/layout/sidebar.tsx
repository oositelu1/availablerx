import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Home, 
  Upload, 
  Send, 
  Users, 
  History, 
  Settings, 
  LogOut,
  ShoppingCart,
  Package,
  Boxes,
  PackageCheck,
  PackageX,
  ClipboardList,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  indent?: boolean;
};

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was a problem logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const navItems = [
    { path: "/", label: "Dashboard", icon: <Home className="mr-3 h-5 w-5" /> },
    { path: "/upload", label: "Upload Files", icon: <Upload className="mr-3 h-5 w-5" /> },
    { path: "/files", label: "File History", icon: <History className="mr-3 h-5 w-5" /> },
    { path: "/partners", label: "Partners", icon: <Users className="mr-3 h-5 w-5" /> },
    { path: "/purchase-orders", label: "Purchase Orders", icon: <ShoppingCart className="mr-3 h-5 w-5" /> },
    { path: "/sales-orders", label: "Sales Orders", icon: <Send className="mr-3 h-5 w-5" /> },
    // Inventory section with improved icons
    { path: "/inventory", label: "Inventory", icon: <Boxes className="mr-3 h-5 w-5" /> },
    { path: "/inventory/scan-in", label: "Scan Product In", icon: <PackageCheck className="mr-3 h-5 w-5" />, indent: true },
    { path: "/inventory/scan-out", label: "Scan Product Out", icon: <PackageX className="mr-3 h-5 w-5" />, indent: true },
    { path: "/inventory/ledger", label: "Inventory Ledger", icon: <ClipboardList className="mr-3 h-5 w-5" />, indent: true },
    // T3 Document section
    { path: "/t3", label: "T3 Documents", icon: <FileText className="mr-3 h-5 w-5" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];

  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-neutral-300 h-screen">
      <div className="p-4 border-b border-neutral-300">
        <h1 className="text-xl font-semibold text-primary">EPCIS File Manager</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <div
                  className={`nav-item flex items-center ${item.indent ? 'pl-10' : 'px-4'} py-3 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                    location === item.path ? "active bg-neutral-50 font-medium" : ""
                  } ${item.indent ? 'text-sm' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="border-t border-neutral-300 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Avatar className="h-8 w-8 bg-primary text-white">
              <AvatarFallback>{user ? getInitials(user.fullName) : "U"}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-neutral-700 capitalize">{user?.role}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
