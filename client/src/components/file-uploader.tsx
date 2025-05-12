import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileStatus } from "./file-status";

export function FileUploader() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const xhr = new XMLHttpRequest();
      
      // Create a promise to track progress and completion
      const promise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch (error) {
              reject(new Error("Invalid response format"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.message || "Upload failed"));
            } catch (error) {
              reject(new Error(`HTTP error ${xhr.status}`));
            }
          }
        };
        
        xhr.onerror = () => {
          reject(new Error("Network error occurred"));
        };
      });
      
      // Configure and send the request
      xhr.open("POST", "/api/files/upload", true);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.withCredentials = true;
      xhr.send(formData);
      
      return promise;
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive",
      });
    }
  });

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFile = useCallback((file: File) => {
    setSelectedFile(file);
    
    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['zip', 'xml'].includes(extension || '')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a ZIP or XML file",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB",
        variant: "destructive",
      });
      return;
    }
    
    // Create form data and upload
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadProgress(0);
    uploadMutation.mutate(formData);
  }, [toast, uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  }, [processFile]);

  const handleBrowseClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  }, [processFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBrowseClick();
    }
  }, [handleBrowseClick]);

  const handleTryAgain = useCallback(() => {
    setSelectedFile(null);
    uploadMutation.reset();
  }, [uploadMutation]);

  const renderUploadState = () => {
    if (uploadMutation.isPending) {
      return (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Uploading file...</p>
            <p className="text-sm font-medium">{uploadProgress}%</p>
          </div>
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-sm text-neutral-600 mt-2">
            {selectedFile?.name} • {(selectedFile?.size || 0) / (1024 * 1024) < 0.1 
              ? `${Math.round((selectedFile?.size || 0) / 1024)} KB` 
              : `${((selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
          </p>
        </div>
      );
    }
    
    if (uploadMutation.isSuccess) {
      const data = uploadMutation.data;
      const metadata = data.file.metadata || {};
      
      return (
        <FileStatus 
          type="success"
          title="File validated and stored successfully!"
          description={`The file contains ${metadata.objectEvents || 0} ObjectEvents, ${metadata.aggregationEvents || 0} AggregationEvents, and ${metadata.transactionEvents || 0} TransactionEvents.`}
          fileId={data.file.id}
          onTryAgain={handleTryAgain}
        />
      );
    }
    
    if (uploadMutation.isError) {
      const error = uploadMutation.error as Error;
      let errorMessage = error.message;
      let remediation = "Please try uploading a different file.";
      
      // Custom error handling based on error codes
      if (errorMessage.includes('MULTI-XML')) {
        errorMessage = "The ZIP file contains multiple XML files.";
        remediation = "Compress only one XML file before sending.";
      } else if (errorMessage.includes('NO-XML')) {
        errorMessage = "The ZIP file doesn't contain any XML files.";
        remediation = "Make sure your ZIP file contains an EPCIS XML file.";
      } else if (errorMessage.includes('VERSION-MISMATCH')) {
        errorMessage = "Invalid EPCIS version. Expected: 1.2";
        remediation = "Please use a valid EPCIS 1.2 formatted file.";
      } else if (errorMessage.includes('TS-MISSING')) {
        errorMessage = "Missing required transaction statement.";
        remediation = "Ensure your file includes the DSCSA transaction statement.";
      } else if (errorMessage.includes('XSD-VALIDATION-FAILED')) {
        errorMessage = "XML does not validate against the EPCIS 1.2 schema.";
        remediation = "Please check your XML format against the EPCIS 1.2 specification.";
      }
      
      return (
        <FileStatus 
          type="error"
          title="File validation failed"
          description={`What went wrong: ${errorMessage}`}
          remediation={`How to fix: ${remediation}`}
          onTryAgain={handleTryAgain}
        />
      );
    }
    
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">Upload EPCIS File</h2>
      
      <div
        id="fileDropZone"
        className={`file-drop-zone rounded-lg p-8 cursor-pointer text-center ${isDragOver ? 'drag-over' : ''}`}
        tabIndex={0}
        aria-label="Drop zone for file upload. Click or press Enter to browse for files."
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col items-center">
          <div className="text-neutral-500 mb-4">
            <Upload className="h-16 w-16" />
          </div>
          <p className="text-lg font-medium mb-2">Drag & drop your file here</p>
          <p className="text-neutral-700 mb-4">or</p>
          <Button>Browse Files</Button>
          <p className="text-sm text-neutral-600 mt-4">
            Supported formats: .zip, .xml (max 100MB)
          </p>
        </div>
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          className="hidden"
          accept=".zip,.xml"
          onChange={handleFileChange}
        />
      </div>
      
      {renderUploadState()}
    </div>
  );
}
