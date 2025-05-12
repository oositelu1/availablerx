import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Eye, Send, Download, Search, Filter, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { SendFileModal } from "./send-file-modal";
import { formatDistanceToNow } from "date-fns";

interface FilesTableProps {
  status?: string;
  partnerId?: number;
  startDate?: string;
  endDate?: string;
}

export function FilesTable({ status, partnerId, startDate, endDate }: FilesTableProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.append("page", page.toString());
  queryParams.append("limit", limit.toString());
  
  if (status) queryParams.append("status", status);
  if (partnerId) queryParams.append("partnerId", partnerId.toString());
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);

  const { data, isLoading } = useQuery({
    queryKey: [`/api/files?${queryParams.toString()}`],
  });

  const handleSendClick = (fileId: number) => {
    setSelectedFile(fileId);
    setSendModalOpen(true);
  };

  const handleDownload = (fileId: number) => {
    window.location.href = `/api/files/${fileId}/download`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Note: For full implementation this would apply search parameters and refetch
    console.log("Searching for:", searchTerm);
  };

  const handleStatusFilter = (value: string) => {
    // This would be implemented to filter by status
    console.log("Filter by status:", value);
  };

  const handleExportCsv = () => {
    // Generate URL with current filters
    const exportParams = new URLSearchParams();
    if (status) exportParams.append("status", status);
    if (partnerId) exportParams.append("partnerId", partnerId.toString());
    if (startDate) exportParams.append("startDate", startDate);
    if (endDate) exportParams.append("endDate", endDate);
    
    window.location.href = `/api/export/files?${exportParams.toString()}`;
  };

  // Status Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    let color = "";
    switch (status.toLowerCase()) {
      case "validated":
        color = "bg-success bg-opacity-10 text-success";
        break;
      case "failed":
        color = "bg-destructive bg-opacity-10 text-destructive";
        break;
      case "sending":
        color = "bg-warning bg-opacity-10 text-warning";
        break;
      case "sent":
        color = "bg-primary bg-opacity-10 text-primary";
        break;
      default:
        color = "bg-neutral-200 text-neutral-700";
    }
    return (
      <Badge variant="outline" className={`${color} capitalize`}>
        {status}
      </Badge>
    );
  };

  const renderPagination = () => {
    if (!data || !data.totalPages) return null;

    const pages = [];
    const totalPages = data.totalPages;
    const currentPage = data.page;

    // Always show first page
    pages.push(
      <PaginationItem key="first">
        <PaginationLink
          isActive={currentPage === 1}
          onClick={() => setPage(1)}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    // Show ellipsis if needed
    if (currentPage > 3) {
      pages.push(
        <PaginationItem key="ellipsis1">
          <span className="px-3 py-1">...</span>
        </PaginationItem>
      );
    }

    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i === 1 || i === totalPages) continue; // Skip first and last page as they're always shown
      pages.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={currentPage === i}
            onClick={() => setPage(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Show ellipsis if needed
    if (currentPage < totalPages - 2) {
      pages.push(
        <PaginationItem key="ellipsis2">
          <span className="px-3 py-1">...</span>
        </PaginationItem>
      );
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(
        <PaginationItem key="last">
          <PaginationLink
            isActive={currentPage === totalPages}
            onClick={() => setPage(totalPages)}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : 0}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            />
          </PaginationItem>
          
          {pages}
          
          <PaginationItem>
            <PaginationNext
              aria-disabled={currentPage === totalPages}
              tabIndex={currentPage === totalPages ? -1 : 0}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Files</h2>
        <div className="flex">
          <form onSubmit={handleSearch} className="relative mr-3">
            <Input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </form>
          <Select onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-[130px] mr-2">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  <div className="flex justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : data?.files?.length > 0 ? (
              data.files.map((file: any) => (
                <TableRow key={file.id} className="hover:bg-neutral-50">
                  <TableCell>
                    <div className="flex items-center">
                      <FileArchive className="text-neutral-600 mr-2 h-5 w-5" />
                      <span className="font-medium">{file.originalName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* In a real implementation, this would show the partner the file was received from or sent to */}
                    {file.partner?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={file.status} />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    {file.metadata ? (
                      (file.metadata.objectEvents || 0) + 
                      (file.metadata.aggregationEvents || 0) + 
                      (file.metadata.transactionEvents || 0)
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-primary hover:text-primary/90" 
                        aria-label="View details"
                        asChild
                      >
                        <Link href={`/files/${file.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={file.status === 'validated' ? "text-primary hover:text-primary/90" : "text-neutral-400 cursor-not-allowed"}
                        aria-label="Send file"
                        disabled={file.status !== 'validated'}
                        onClick={() => file.status === 'validated' && handleSendClick(file.id)}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-primary hover:text-primary/90" 
                        aria-label="Download file"
                        onClick={() => handleDownload(file.id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6">
                  No files found. Upload a file to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {data?.files?.length > 0 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-neutral-600">
            Showing {((data.page - 1) * data.limit) + 1}-{Math.min(data.page * data.limit, data.total)} of {data.total} files
          </p>
          {renderPagination()}
        </div>
      )}

      {/* Send File Modal */}
      {selectedFile !== null && (
        <SendFileModal
          isOpen={sendModalOpen}
          setIsOpen={setSendModalOpen}
          fileId={selectedFile}
        />
      )}
    </div>
  );
}
