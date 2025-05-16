import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPartnerLocationSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash, 
  MapPin, 
  Building, 
  Check, 
  Home, 
  Loader2, 
  Star,
  StarOff
} from "lucide-react";

// Form schema for partner locations
const locationSchema = z.object({
  name: z.string().min(2, { message: "Location name must be at least 2 characters" }),
  locationType: z.string().min(1, { message: "Please select a location type" }),
  addressLine1: z.string().min(2, { message: "Address line 1 is required" }),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1, { message: "City is required" }),
  state: z.string().min(1, { message: "State is required" }),
  postalCode: z.string().min(1, { message: "Postal code is required" }),
  country: z.string().default("US"),
  gln: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface PartnerLocationsProps {
  partnerId: number;
  partnerName: string;
}

export function PartnerLocations({ partnerId, partnerName }: PartnerLocationsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  
  // Set up form for adding/editing locations
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      locationType: "ship_to",
      addressLine1: "",
      addressLine2: null,
      city: "",
      state: "",
      postalCode: "",
      country: "US",
      gln: null,
      isDefault: false,
    },
  });
  
  // Set form values when editing an existing location
  useEffect(() => {
    if (selectedLocation && editLocationOpen) {
      form.reset({
        name: selectedLocation.name,
        locationType: selectedLocation.locationType,
        addressLine1: selectedLocation.addressLine1,
        addressLine2: selectedLocation.addressLine2 || null,
        city: selectedLocation.city,
        state: selectedLocation.state,
        postalCode: selectedLocation.postalCode,
        country: selectedLocation.country || "US",
        gln: selectedLocation.gln || null,
        isDefault: selectedLocation.isDefault,
      });
    } else if (!editLocationOpen) {
      form.reset({
        name: "",
        locationType: "ship_to",
        addressLine1: "",
        addressLine2: null,
        city: "",
        state: "",
        postalCode: "",
        country: "US",
        gln: null,
        isDefault: false,
      });
    }
  }, [selectedLocation, editLocationOpen, form]);
  
  // Fetch locations for this partner
  const { data: locations, isLoading } = useQuery({
    queryKey: [`/api/partner-locations/partner/${partnerId}`],
    enabled: !!partnerId && !!user,
  });
  
  // Mutation for adding a location
  const addLocationMutation = useMutation({
    mutationFn: async (values: LocationFormValues) => {
      const response = await fetch('/api/partner-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          partnerId: partnerId,
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add location');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partner-locations/partner/${partnerId}`] });
      setAddLocationOpen(false);
      form.reset();
      toast({
        title: "Location Added",
        description: "The location has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for updating a location
  const updateLocationMutation = useMutation({
    mutationFn: async (values: LocationFormValues & { id: number }) => {
      const { id, ...data } = values;
      const response = await fetch(`/api/partner-locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update location');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partner-locations/partner/${partnerId}`] });
      setEditLocationOpen(false);
      setSelectedLocation(null);
      toast({
        title: "Location Updated",
        description: "The location has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation for deleting a location
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/partner-locations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete location');
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/partner-locations/partner/${partnerId}`] });
      setDeleteDialogOpen(false);
      setSelectedLocation(null);
      toast({
        title: "Location Deleted",
        description: "The location has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission for adding a location
  const onSubmitAdd = (values: LocationFormValues) => {
    addLocationMutation.mutate(values);
  };
  
  // Handle form submission for editing a location
  const onSubmitEdit = (values: LocationFormValues) => {
    if (selectedLocation) {
      updateLocationMutation.mutate({
        ...values,
        id: selectedLocation.id,
      });
    }
  };
  
  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (selectedLocation) {
      deleteLocationMutation.mutate(selectedLocation.id);
    }
  };
  
  // Get icon for location type
  const getLocationTypeIcon = (type: string) => {
    switch (type) {
      case 'ship_from':
        return <Building className="h-4 w-4" />;
      case 'ship_to':
        return <MapPin className="h-4 w-4" />;
      case 'billing':
        return <Home className="h-4 w-4" />;
      default:
        return <Building className="h-4 w-4" />;
    }
  };
  
  // Get label for location type
  const getLocationTypeLabel = (type: string) => {
    switch (type) {
      case 'ship_from':
        return 'Ship From';
      case 'ship_to':
        return 'Ship To';
      case 'billing':
        return 'Billing';
      case 'headquarters':
        return 'Headquarters';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  // Set a location as default
  const handleSetDefault = (location: any) => {
    if (location) {
      updateLocationMutation.mutate({
        ...location,
        isDefault: true,
      });
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Locations for {partnerName}</h2>
        <Button onClick={() => setAddLocationOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Location
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Partner Locations</CardTitle>
          <CardDescription>
            Manage shipping, billing, and other addresses for this partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : locations && locations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location: any) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getLocationTypeIcon(location.locationType)}
                        <span>{getLocationTypeLabel(location.locationType)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{location.addressLine1}</div>
                        {location.addressLine2 && <div>{location.addressLine2}</div>}
                        <div>
                          {location.city}, {location.state} {location.postalCode}
                        </div>
                        <div>{location.country}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {location.isDefault ? (
                        <Badge className="bg-green-500">
                          <Check className="mr-1 h-3 w-3" /> Default
                        </Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSetDefault(location)}
                          title="Set as default"
                        >
                          <StarOff className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLocation(location);
                            setEditLocationOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedLocation(location);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No locations found for this partner. Click "Add Location" to create one.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Add Location Dialog */}
      <Dialog open={addLocationOpen} onOpenChange={setAddLocationOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitAdd)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Office" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ship_from">Ship From</SelectItem>
                          <SelectItem value="ship_to">Ship To</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="headquarters">Headquarters</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2 (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Suite 100" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="MX">Mexico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="gln"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GLN (Global Location Number) - Optional</FormLabel>
                    <FormControl>
                      <Input placeholder="0123456789012" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Set as Default
                      </FormLabel>
                      <FormDescription>
                        This address will be used as the default for this location type
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddLocationOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addLocationMutation.isPending}>
                  {addLocationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Location"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Location Dialog */}
      <Dialog open={editLocationOpen} onOpenChange={setEditLocationOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Office" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="locationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ship_from">Ship From</SelectItem>
                          <SelectItem value="ship_to">Ship To</SelectItem>
                          <SelectItem value="billing">Billing</SelectItem>
                          <SelectItem value="headquarters">Headquarters</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2 (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Suite 100" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="MX">Mexico</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="gln"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GLN (Global Location Number) - Optional</FormLabel>
                    <FormControl>
                      <Input placeholder="0123456789012" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Set as Default
                      </FormLabel>
                      <FormDescription>
                        This address will be used as the default for this location type
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditLocationOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateLocationMutation.isPending}>
                  {updateLocationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Location"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteLocationMutation.isPending}
            >
              {deleteLocationMutation.isPending ? (
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
    </div>
  );
}