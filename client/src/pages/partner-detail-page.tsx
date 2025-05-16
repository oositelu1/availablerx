import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Building, Mail, FileClock, Truck, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { PartnerLocations } from "@/components/partner-locations";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function PartnerDetailPage() {
  const [, params] = useRoute("/partners/:id");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Get partner ID from route
  const partnerId = params?.id ? parseInt(params.id) : 0;

  // Fetch partner details
  const { data: partner, isLoading } = useQuery({
    queryKey: [`/api/partners/${partnerId}`],
    enabled: !!partnerId && !!user,
  });

  // Helper function to get badge color for partner type
  const getPartnerTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'manufacturer':
        return 'bg-blue-500';
      case 'distributor':
        return 'bg-purple-500';
      case 'wholesaler':
        return 'bg-amber-500';
      case 'retailer':
        return 'bg-green-500';
      case 'pharmacy':
        return 'bg-teal-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Layout title={isLoading ? "Partner Details" : `Partner: ${partner?.name}`}>
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" asChild className="mr-4">
          <Link href="/partners">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Partners
          </Link>
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isLoading ? <Skeleton className="h-9 w-48" /> : partner?.name}
          </h1>
          <div className="flex items-center space-x-2 mt-1">
            {isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <Badge className={getPartnerTypeColor(partner?.partnerType)}>
                {partner?.partnerType}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Partner Information</CardTitle>
              <CardDescription>Basic information about this partner</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-1/4" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Contact Information</h3>
                    <Separator className="my-2" />
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{partner?.contactEmail}</span>
                      </div>
                      {partner?.contactPhone && (
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{partner?.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium">System Information</h3>
                    <Separator className="my-2" />
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Transport Type: {partner?.transportType}</span>
                      </div>
                      {partner?.gln && (
                        <div className="flex items-center">
                          <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>GLN: {partner?.gln}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <FileClock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Added: {new Date(partner?.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {partner?.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line">{partner.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="locations" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-8 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ) : (
            <PartnerLocations partnerId={partnerId} partnerName={partner?.name} />
          )}
        </TabsContent>
        
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Files</CardTitle>
              <CardDescription>Files shared with this partner</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                Coming soon. This section will show files shared with this partner.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Purchase orders and sales orders for this partner</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                Coming soon. This section will show orders associated with this partner.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}