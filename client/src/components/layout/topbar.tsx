import { Menu, Bell, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

interface TopbarProps {
  title: string;
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="bg-white border-b border-neutral-300 px-4 py-2 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden mr-2"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>
          
          <h1 className="text-xl font-semibold text-neutral-900 md:hidden">{title}</h1>
        </div>
        
        <div className="flex items-center ml-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-neutral-700 hover:bg-neutral-100"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-neutral-700 hover:bg-neutral-100"
            aria-label="Get help"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
