import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, X, FileArchive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendFileModalProps {
  fileId: number;
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => void;
  onClose?: () => void;
}

export function SendFileModal({ fileId, onClose, setIsOpen, isOpen = true }: SendFileModalProps) {
  const handleClose = () => {
    if (setIsOpen) {
      setIsOpen(false);
    } else if (onClose) {
      onClose();
    }
  };
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [transportType, setTransportType] = useState<"AS2" | "HTTPS" | "PRESIGNED">("AS2");
  const [priority, setPriority] = useState<string>("normal");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch file details
  const { data: file, isLoading: isLoadingFile } = useQuery<any>({
    queryKey: [`/api/files/${fileId}`],
    enabled: isOpen && !!fileId,
  });

  // Fetch partners
  const { data: partners, isLoading: isLoadingPartners } = useQuery<any[]>({
    queryKey: ["/api/partners?activeOnly=true"],
    enabled: isOpen,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPartnerId("");
      setTransportType("AS2");
      setPriority("normal");
    }
  }, [isOpen]);

  // Get selected partner details
  const selectedPartner = partners && Array.isArray(partners) 
    ? partners.find((p: any) => p.id.toString() === selectedPartnerId)
    : undefined;

  // Send file mutation
  const sendFileMutation = useMutation({
    mutationFn: async (data: { fileId: number; partnerId: string; transportType: string }) => {
      const res = await apiRequest("POST", `/api/files/${data.fileId}/send`, {
        partnerId: parseInt(data.partnerId),
        transportType: data.transportType,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File sent successfully",
        description: "The file has been queued for transmission to the partner.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send file",
        description: error.message || "There was an error sending the file. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedPartnerId) {
      toast({
        title: "Partner required",
        description: "Please select a trading partner to send the file to.",
        variant: "destructive",
      });
      return;
    }

    sendFileMutation.mutate({
      fileId,
      partnerId: selectedPartnerId,
      transportType,
    });
  };

  const handleCancel = () => {
    onClose();
  };

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent 
        className="max-w-lg max-h-[90vh] overflow-y-auto" 
        aria-describedby="send-file-description"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">Send File to Partner</DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={handleCancel}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div id="send-file-description" className="sr-only">
            Dialog for sending a file to a trading partner
          </div>
        </DialogHeader>
        
        {isLoadingFile ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : file ? (
          <>
            <div className="mb-6">
              <p className="font-medium mb-2">File</p>
              <div className="flex items-center p-3 bg-neutral-100 rounded-md">
                <FileArchive className="text-neutral-600 mr-2 h-5 w-5" />
                <div>
                  <p className="font-medium">{file?.originalName || "EPCIS File"}</p>
                  <p className="text-sm text-neutral-600">
                    Valid EPCIS 1.2 file • {formatFileSize(file?.fileSize || 0)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <Label htmlFor="partnerSelect" className="block text-sm font-medium text-neutral-700 mb-1">
                Select Partner
              </Label>
              {isLoadingPartners ? (
                <div className="flex items-center space-x-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading partners...</span>
                </div>
              ) : partners && Array.isArray(partners) && partners.length > 0 ? (
                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                  <SelectTrigger id="partnerSelect" className="w-full">
                    <SelectValue placeholder="Choose a trading partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((partner: any) => (
                      <SelectItem key={partner.id} value={partner.id.toString()}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-neutral-600 border border-neutral-200 rounded-md p-3">
                  No trading partners found. Please add a partner first.
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <Label className="block text-sm font-medium text-neutral-700 mb-1">
                Transfer Method
              </Label>
              <RadioGroup
                value={transportType}
                onValueChange={(value) => setTransportType(value as "AS2" | "HTTPS" | "PRESIGNED")}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AS2" id="as2" />
                  <Label htmlFor="as2">AS2</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="HTTPS" id="https" />
                  <Label htmlFor="https">HTTPS</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PRESIGNED" id="presigned" />
                  <Label htmlFor="presigned">Pre-Signed URL</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="mb-6">
              <Label className="block text-sm font-medium text-neutral-700 mb-1">
                Priority
              </Label>
              <RadioGroup
                value={priority}
                onValueChange={setPriority}
                className="flex items-center space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal">Normal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="high" />
                  <Label htmlFor="high">High</Label>
                </div>
              </RadioGroup>
            </div>
            
            {selectedPartner && (
              <div className="p-3 bg-neutral-100 rounded-md text-sm">
                <p className="font-medium">Connection Details</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {transportType !== "PRESIGNED" && (
                    <>
                      <div>
                        <p className="text-neutral-600">Endpoint URL:</p>
                      </div>
                      <div>
                        <p>{selectedPartner.endpointUrl || "Not configured"}</p>
                      </div>
                    </>
                  )}
                  {transportType === "AS2" && (
                    <>
                      <div>
                        <p className="text-neutral-600">AS2 ID:</p>
                      </div>
                      <div>
                        <p>{selectedPartner.as2Id || "Not configured"}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Certificate:</p>
                      </div>
                      <div>
                        <p>{selectedPartner.certificate ? 
                          `${selectedPartner.certificate} (valid)` : 
                          "Not configured"}</p>
                      </div>
                    </>
                  )}
                  {transportType === "HTTPS" && selectedPartner.authToken && (
                    <>
                      <div>
                        <p className="text-neutral-600">Authentication:</p>
                      </div>
                      <div>
                        <p>Configured</p>
                      </div>
                    </>
                  )}
                  {transportType === "PRESIGNED" && (
                    <>
                      <div>
                        <p className="text-neutral-600">Transport Method:</p>
                      </div>
                      <div>
                        <p>Pre-Signed URL</p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Link Expiration:</p>
                      </div>
                      <div>
                        <p>48 hours from creation</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center text-neutral-600">
            File not found or could not be loaded
          </div>
        )}
        
        <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-200 w-full">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedPartnerId || sendFileMutation.isPending}
          >
            {sendFileMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send File"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
