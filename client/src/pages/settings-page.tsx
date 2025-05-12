import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  User,
  Key,
  Shield,
  Settings,
  AlertCircle,
  HelpCircle,
  Lock,
} from "lucide-react";

// Form schema for API settings
const apiSettingsSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  enableWebhooks: z.boolean().default(false),
  webhookUrl: z.string().url("Please enter a valid URL").or(z.string().length(0)).optional(),
});

type ApiSettingsFormValues = z.infer<typeof apiSettingsSchema>;

// Form schema for security settings
const securitySettingsSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SecuritySettingsFormValues = z.infer<typeof securitySettingsSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";
  const [activeTab, setActiveTab] = useState("account");

  // Form for API settings
  const apiSettingsForm = useForm<ApiSettingsFormValues>({
    resolver: zodResolver(apiSettingsSchema),
    defaultValues: {
      apiKey: "sk_test_example_key_for_demo",
      enableWebhooks: false,
      webhookUrl: "",
    },
  });

  // Form for security settings
  const securitySettingsForm = useForm<SecuritySettingsFormValues>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onApiSettingsSubmit = (data: ApiSettingsFormValues) => {
    console.log("API Settings:", data);
    // This would be implemented to update API settings
  };

  const onSecuritySettingsSubmit = (data: SecuritySettingsFormValues) => {
    console.log("Security Settings:", data);
    // This would be implemented to update security settings
  };

  // For admin-only access check
  if (isAdmin === false && activeTab === "system") {
    setActiveTab("account");
  }

  return (
    <Layout title="Settings">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-3 gap-2 sm:inline-flex">
            <TabsTrigger value="account" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span>Account</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center">
              <Key className="mr-2 h-4 w-4" />
              <span>API</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="system" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                <span>System</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Account Settings */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  View and update your account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input 
                      value={user?.username} 
                      readOnly
                      className="mt-1 bg-neutral-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Full Name</label>
                    <Input 
                      value={user?.fullName} 
                      readOnly
                      className="mt-1 bg-neutral-50"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Input 
                      value={user?.role} 
                      readOnly
                      className="mt-1 bg-neutral-50 capitalize"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Update your password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...securitySettingsForm}>
                  <form 
                    onSubmit={securitySettingsForm.handleSubmit(onSecuritySettingsSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={securitySettingsForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securitySettingsForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormDescription>
                            Must be at least 6 characters long
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={securitySettingsForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end pt-2">
                      <Button type="submit">
                        <Lock className="mr-2 h-4 w-4" />
                        Update Password
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Settings */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Settings</CardTitle>
                <CardDescription>
                  Manage your API keys and webhook configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...apiSettingsForm}>
                  <form 
                    onSubmit={apiSettingsForm.handleSubmit(onApiSettingsSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={apiSettingsForm.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key</FormLabel>
                          <FormControl>
                            <div className="flex">
                              <Input {...field} type="password" />
                              <Button
                                type="button"
                                variant="outline"
                                className="ml-2 whitespace-nowrap"
                                onClick={() => {
                                  // This would generate a new API key
                                  apiSettingsForm.setValue("apiKey", "new_generated_key_" + Math.random().toString(36).substr(2, 9));
                                }}
                              >
                                Regenerate
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Used for service-to-service file uploads
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={apiSettingsForm.control}
                      name="enableWebhooks"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Webhooks</FormLabel>
                            <FormDescription>
                              Receive notifications when files are validated or sent
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {apiSettingsForm.watch("enableWebhooks") && (
                      <FormField
                        control={apiSettingsForm.control}
                        name="webhookUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook URL</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="https://your-server.com/webhook" 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              We'll send POST requests to this URL when events occur
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <div className="flex justify-end pt-2">
                      <Button type="submit">Save API Settings</Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings (Admin Only) */}
          {isAdmin && (
            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Configure global system settings (administrators only)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <h3 className="font-medium">File Size Limit</h3>
                      <p className="text-sm text-neutral-600">
                        Maximum file size for uploads (currently 100 MB)
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24 text-right"
                      defaultValue="100"
                    />
                  </div>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <h3 className="font-medium">File Retention Period</h3>
                      <p className="text-sm text-neutral-600">
                        How long to keep files in the system (in years)
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="w-24 text-right"
                      defaultValue="6"
                    />
                  </div>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <h3 className="font-medium">Enable Automatic Retries</h3>
                      <p className="text-sm text-neutral-600">
                        Automatically retry failed transmissions
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button>Save System Settings</Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage user accounts and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center py-8">
                    <div className="flex flex-col items-center text-center max-w-md">
                      <Shield className="h-12 w-12 text-primary opacity-70 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        User Management
                      </h3>
                      <p className="text-neutral-600 mb-4">
                        User management features will be available in a future update.
                        Contact your system administrator for user account changes.
                      </p>
                      <Button variant="outline" disabled>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Contact Support
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
