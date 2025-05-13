import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { File, Partner } from '@shared/schema';
import { Badge } from "@/components/ui/badge";
import { Loader2, Link as LinkIcon, Copy, Check, Clock, X, Calendar } from 'lucide-react';

interface PresignedLinkData {
  id: number;
  createdAt: string;
  expiresAt: string;
  fileId: number;
  partnerId: number;
  uuid: string;
  firstClickedAt: string | null;
  downloadedAt: string | null;
  isOneTimeUse: boolean;
  ipRestriction: string | null;
  partner: {
    id: number;
    name: string;
  };
  downloadUrl: string;
}

interface PresignedLinksProps {
  fileId: number;
}

export function PresignedLinks({ fileId }: PresignedLinksProps) {
  const { toast } = useToast();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [expirationHours, setExpirationHours] = useState<string>('48');
  const [isOneTimeUse, setIsOneTimeUse] = useState<boolean>(false);
  const [ipRestriction, setIpRestriction] = useState<string>('');
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

  // Fetch the file's pre-signed links
  const { data: links, isLoading: isLinksLoading } = useQuery<PresignedLinkData[]>({
    queryKey: ['/api/files', fileId, 'shared-links'],
    queryFn: getQueryFn(),
  });

  // Fetch all partners for the dropdown
  const { data: partners, isLoading: isPartnersLoading } = useQuery<Partner[]>({
    queryKey: ['/api/partners'],
    queryFn: getQueryFn(),
  });

  // Create a new pre-signed link
  const createLinkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartnerId) {
        throw new Error('Please select a partner');
      }

      const expirationSeconds = parseInt(expirationHours) * 3600; // Convert hours to seconds
      
      const res = await apiRequest('POST', `/api/files/${fileId}/share`, {
        partnerId: parseInt(selectedPartnerId),
        expirationSeconds,
        isOneTimeUse,
        ipRestriction: ipRestriction || null
      });
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Pre-signed link created',
        description: 'The link has been successfully created and is ready to share',
      });
      
      // Reset form
      setSelectedPartnerId('');
      setExpirationHours('48');
      setIsOneTimeUse(false);
      setIpRestriction('');
      
      // Invalidate queries to refresh the links list
      queryClient.invalidateQueries({ queryKey: ['/api/files', fileId, 'shared-links'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create pre-signed link',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleCopyLink = (link: PresignedLinkData) => {
    navigator.clipboard.writeText(link.downloadUrl).then(
      () => {
        setCopiedLinkId(link.id);
        setTimeout(() => setCopiedLinkId(null), 2000);
        
        toast({
          title: 'Link copied',
          description: 'The download link has been copied to your clipboard',
        });
      },
      () => {
        toast({
          title: 'Failed to copy',
          description: 'Could not copy the link to clipboard',
          variant: 'destructive',
        });
      }
    );
  };

  const getLinkStatus = (link: PresignedLinkData) => {
    const now = new Date();
    const expiresAt = new Date(link.expiresAt);
    
    if (now > expiresAt) {
      return { label: 'Expired', color: 'destructive' };
    }
    
    if (link.isOneTimeUse && link.downloadedAt) {
      return { label: 'Used', color: 'default' };
    }
    
    if (link.firstClickedAt) {
      return { label: 'Clicked', color: 'secondary' };
    }
    
    return { label: 'Active', color: 'success' };
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Pre-Signed Download Links</CardTitle>
        <CardDescription>Share this file with your partners using secure, expiring download links</CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Create new link form */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Create New Link</h3>
            
            <div className="space-y-2">
              <Label htmlFor="partner">Select Partner</Label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger id="partner">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {isPartnersLoading ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading partners...
                    </div>
                  ) : partners && partners.length > 0 ? (
                    partners.map(partner => (
                      <SelectItem key={partner.id} value={partner.id.toString()}>
                        {partner.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-muted-foreground">
                      No partners available. Please add a partner first.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expiration">Expiration (hours)</Label>
              <Select value={expirationHours} onValueChange={setExpirationHours}>
                <SelectTrigger id="expiration">
                  <SelectValue placeholder="Select expiration time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours (1 day)</SelectItem>
                  <SelectItem value="48">48 hours (2 days)</SelectItem>
                  <SelectItem value="72">72 hours (3 days)</SelectItem>
                  <SelectItem value="168">168 hours (1 week)</SelectItem>
                  <SelectItem value="720">720 hours (30 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="one-time-use"
                checked={isOneTimeUse}
                onCheckedChange={setIsOneTimeUse}
              />
              <Label htmlFor="one-time-use">One-time use only</Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ip-restriction">IP Restriction (optional)</Label>
              <Input
                id="ip-restriction"
                placeholder="e.g. 192.168.1.1"
                value={ipRestriction}
                onChange={(e) => setIpRestriction(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to allow access from any IP address
              </p>
            </div>
            
            <Button 
              onClick={() => createLinkMutation.mutate()}
              disabled={createLinkMutation.isPending || !selectedPartnerId}
              className="w-full"
            >
              {createLinkMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>Generate Pre-Signed Link</>
              )}
            </Button>
          </div>
          
          {/* Existing links */}
          <div className="space-y-4 mt-8">
            <h3 className="text-lg font-medium">Existing Links</h3>
            
            {isLinksLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : links && links.length > 0 ? (
              <div className="space-y-4">
                {links.map(link => {
                  const status = getLinkStatus(link);
                  return (
                    <div key={link.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Shared with {link.partner.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" /> 
                            Created {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                        <Badge variant={status.color as any}>{status.label}</Badge>
                      </div>
                      
                      <div className="bg-muted p-2 rounded flex items-center justify-between text-sm font-mono break-all">
                        <span className="truncate mr-2">{link.downloadUrl}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(link)}
                          className="h-8 px-2"
                        >
                          {copiedLinkId === link.id ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span>
                            {new Date() > new Date(link.expiresAt) 
                              ? 'Expired ' + formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })
                              : 'Expires ' + formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })}
                          </span>
                        </div>
                        
                        {link.isOneTimeUse && (
                          <div className="flex items-center">
                            {link.downloadedAt ? (
                              <>
                                <Check className="h-3 w-3 mr-1 text-muted-foreground" />
                                <span>Used {formatDistanceToNow(new Date(link.downloadedAt), { addSuffix: true })}</span>
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3 mr-1 text-muted-foreground" />
                                <span>One-time use (not used yet)</span>
                              </>
                            )}
                          </div>
                        )}
                        
                        {link.ipRestriction && (
                          <div>
                            <span className="bg-secondary px-1 py-0.5 rounded text-xs">
                              IP restricted: {link.ipRestriction}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No pre-signed links have been created for this file yet.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getQueryFn(options = {}) {
  return async ({ queryKey }: { queryKey: string[] }) => {
    const endpoint = Array.isArray(queryKey) ? queryKey.join('/') : queryKey;
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch data');
    }
    
    return response.json();
  };
}