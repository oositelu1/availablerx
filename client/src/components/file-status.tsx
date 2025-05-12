import { CheckCircle, AlertCircle, Send, Eye, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SendFileModal } from "./send-file-modal";
import { Link } from "wouter";

interface FileStatusProps {
  type: "success" | "error";
  title: string;
  description: string;
  remediation?: string;
  fileId?: number;
  onTryAgain: () => void;
}

export function FileStatus({ 
  type, 
  title, 
  description, 
  remediation, 
  fileId,
  onTryAgain 
}: FileStatusProps) {
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const handleSendClick = () => {
    setSendModalOpen(true);
  };

  return (
    <div className="mt-6">
      <div 
        className={`
          ${type === "success" ? "bg-success bg-opacity-10 text-success" : "bg-destructive bg-opacity-10 text-destructive"} 
          rounded-lg p-4 flex items-start
        `}
      >
        {type === "success" ? (
          <CheckCircle className="h-6 w-6 mt-0.5 mr-3 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-6 w-6 mt-0.5 mr-3 flex-shrink-0" />
        )}
        
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm mt-1">{description}</p>
          {remediation && <p className="text-sm mt-2">{remediation}</p>}
          
          <div className="flex mt-3">
            {type === "success" && fileId && (
              <>
                <Button
                  size="sm"
                  className={`mr-3 ${type === "success" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"}`}
                  onClick={handleSendClick}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send to Partner
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={type === "success" ? "border-success text-success" : "border-destructive text-destructive"}
                  asChild
                >
                  <Link href={`/files/${fileId}`}>
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Link>
                </Button>
              </>
            )}
            
            {type === "error" && (
              <>
                <Button
                  size="sm"
                  className="mr-3 bg-destructive hover:bg-destructive/90"
                  onClick={onTryAgain}
                >
                  Try Again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive"
                >
                  <HelpCircle className="h-4 w-4 mr-1" />
                  Get Help
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Send File Modal */}
      {fileId && (
        <SendFileModal
          isOpen={sendModalOpen}
          setIsOpen={setSendModalOpen}
          fileId={fileId}
        />
      )}
    </div>
  );
}
