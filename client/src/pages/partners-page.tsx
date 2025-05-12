import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { PartnerWizard } from "@/components/partner-wizard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash,
  Building, 
  Link as LinkIcon,
  Mail,
  ShieldCheck,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function PartnersPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: partners, isLoading } = useQuery({
    queryKey: ["/api/partners"],
  });

  const togglePartnerMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/partners/${id}`, { isActive });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({
        title: "Partner updated",
        description: "The partner status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update partner status.",
        variant: "destructive",
      });
    },
  });

  const deletePartnerMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/partners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({
        title: "Partner deleted",
        description: "The partner has been removed successfully.",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete partner.",
        variant: "destructive",
      });
    },
  });

  const handleToggleActive = (id: number, isActive: boolean) => {
    togglePartnerMutation.mutate({ id, isActive: !isActive });
  };

  const handleDeleteClick = (id: number) => {
    setSelectedPartnerId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPartnerId !== null) {
      deletePartnerMutation.mutate(selectedPartnerId);
    }
  };

  const getPartnerTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'supplier':
        return <Building className="h-4 w-4 text-blue-600" />;
      case 'distributor':
        return <LinkIcon className="h-4 w-4 text-green-600" />;
      case 'manufacturer':
        return <ShieldCheck className="h-4 w-4 text-purple-600" />;
      case 'retailer':
        return <Mail className="h-4 w-4 text-orange-600" />;
      default:
        return <Building className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Layout title="Trading Partners">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Trading Partners</h1>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Network</CardTitle>
          <CardDescription>
            Manage your trading partners for sending and receiving EPCIS files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : partners && partners.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Transfer Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner: any) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {getPartnerTypeIcon(partner.partnerType)}
                        <span className="ml-2 capitalize">{partner.partnerType}</span>
                      </div>
                    </TableCell>
                    <TableCell>{partner.contactEmail}</TableCell>
                    <TableCell>{partner.transportType || "AS2"}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={partner.isActive}
                          onCheckedChange={() => handleToggleActive(partner.id, partner.isActive)}
                          disabled={togglePartnerMutation.isPending}
                        />
                        <Badge variant={partner.isActive ? "outline" : "secondary"}>
                          {partner.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteClick(partner.id)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-neutral-500">
              <p>No trading partners found. Add your first partner to get started.</p>
              <Button 
                variant="outline"
                className="mt-4"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Partner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner Wizard */}
      <PartnerWizard
        isOpen={wizardOpen}
        setIsOpen={setWizardOpen}
        onPartnerAdded={() => queryClient.invalidateQueries({ queryKey: ["/api/partners"] })}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the partner
              and all associated connection information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deletePartnerMutation.isPending}
            >
              {deletePartnerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
