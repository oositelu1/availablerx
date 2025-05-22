import { useState } from "react";
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
  FileText,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type NavItem = {
  path: string;
  label: string;
  icon: React.ReactNode;
  indent?: boolean;
  isSubItem?: boolean;
  subItems?: NavItem[];
};

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inventory: false,
    t3: false
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  const navItems: NavItem[] = [
    { path: "/", label: "Dashboard", icon: <Home className="mr-3 h-5 w-5" /> },
    { path: "/upload", label: "Upload Files", icon: <Upload className="mr-3 h-5 w-5" /> },
    { path: "/files", label: "File History", icon: <History className="mr-3 h-5 w-5" /> },
    { path: "/partners", label: "Partners", icon: <Users className="mr-3 h-5 w-5" /> },
    { path: "/purchase-orders", label: "Purchase Orders", icon: <ShoppingCart className="mr-3 h-5 w-5" /> },
    { path: "/sales-orders", label: "Sales Orders", icon: <Send className="mr-3 h-5 w-5" /> },
    // Invoice section with collapsible menu
    { 
      path: "/invoices", 
      label: "Invoices", 
      icon: <FileText className="mr-3 h-5 w-5" />,
      subItems: [
        { path: "/invoices/upload", label: "Upload Invoice", icon: <Upload className="mr-3 h-5 w-5" />, isSubItem: true },
        { path: "/invoices/preview", label: "Invoice Preview", icon: <ClipboardList className="mr-3 h-5 w-5" />, isSubItem: true },
      ]
    },
    // Inventory section with collapsible menu
    { 
      path: "/inventory", 
      label: "Inventory", 
      icon: <Boxes className="mr-3 h-5 w-5" />,
      subItems: [
        { path: "/inventory/scan-in", label: "Scan Product In", icon: <PackageCheck className="mr-3 h-5 w-5" />, isSubItem: true },
        { path: "/inventory/scan-out", label: "Scan Product Out", icon: <PackageX className="mr-3 h-5 w-5" />, isSubItem: true },
        { path: "/inventory/ledger", label: "Inventory Ledger", icon: <ClipboardList className="mr-3 h-5 w-5" />, isSubItem: true },
      ]
    },
    // T3 Document section with collapsible menu
    { 
      path: "/t3", 
      label: "T3 Documents", 
      icon: <FileText className="mr-3 h-5 w-5" />,
      subItems: [
        { path: "/t3/ledger", label: "T3 Ledger", icon: <ClipboardList className="mr-3 h-5 w-5" />, isSubItem: true },
      ]
    },
    { path: "/settings", label: "Settings", icon: <Settings className="mr-3 h-5 w-5" /> },
  ];

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-neutral-300 h-screen">
      <div className="p-4 border-b border-neutral-300">
        <h1 className="text-xl font-semibold text-primary">EPCIS File Manager</h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4">
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              {item.subItems ? (
                <Collapsible
                  open={openSections[item.label.toLowerCase().replace(' ', '-')]}
                  onOpenChange={() => toggleSection(item.label.toLowerCase().replace(' ', '-'))}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`nav-item flex items-center justify-between px-4 py-3 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                        location.startsWith(item.path) ? 'bg-neutral-50 text-primary font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {openSections[item.label.toLowerCase().replace(' ', '-')] ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul>
                      {item.subItems.map((subItem) => (
                        <li key={subItem.path}>
                          <Link href={subItem.path}>
                            <div
                              className={`nav-item flex items-center pl-10 py-2.5 text-sm text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                                location === subItem.path ? 'bg-neutral-50 text-primary font-medium' : ''
                              }`}
                            >
                              {subItem.icon}
                              <span>{subItem.label}</span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <Link href={item.path}>
                  <div
                    className={`nav-item flex items-center px-4 py-3 text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer ${
                      location === item.path ? "active bg-neutral-50 font-medium" : ""
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </Link>
              )}
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
