import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        
        <div className="flex-1 overflow-y-auto bg-neutral-100 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-neutral-900 hidden md:block">{title}</h1>
              {/* Page-specific actions can be added here */}
            </div>
            
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
