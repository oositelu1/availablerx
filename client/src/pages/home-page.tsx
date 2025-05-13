import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Send, CheckCircle, ArrowUp, ShoppingCart } from "lucide-react";
import { FileUploader } from "@/components/file-uploader";
import { FilesTable } from "@/components/files-table";
import { RecentPurchaseOrders } from "@/components/recent-purchase-orders";
import { Link } from "wouter";

export default function HomePage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  return (
    <Layout title="Dashboard">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <Link href="/upload">
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Upload className="mr-2 h-4 w-4" />
            Upload New File
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700">Files Received</p>
                <p className="text-2xl font-semibold mt-1">
                  {isLoading ? (
                    <span className="text-neutral-400">--</span>
                  ) : (
                    stats?.filesReceived || 0
                  )}
                </p>
              </div>
              <div className="bg-primary bg-opacity-10 p-3 rounded-full">
                <Upload className="h-5 w-5 text-primary" />
              </div>
            </div>
            {!isLoading && stats?.filesReceived > 0 && (
              <div className="mt-4">
                <p className="text-sm text-success flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Recent activity
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700">Files Sent</p>
                <p className="text-2xl font-semibold mt-1">
                  {isLoading ? (
                    <span className="text-neutral-400">--</span>
                  ) : (
                    stats?.filesSent || 0
                  )}
                </p>
              </div>
              <div className="bg-secondary bg-opacity-10 p-3 rounded-full">
                <Send className="h-5 w-5 text-primary" />
              </div>
            </div>
            {!isLoading && stats?.filesSent > 0 && (
              <div className="mt-4">
                <p className="text-sm text-success flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Recent activity
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700">Validation Success Rate</p>
                <p className="text-2xl font-semibold mt-1">
                  {isLoading ? (
                    <span className="text-neutral-400">--</span>
                  ) : (
                    `${stats?.validationRate || 0}%`
                  )}
                </p>
              </div>
              <div className="bg-success bg-opacity-10 p-3 rounded-full">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
            </div>
            {!isLoading && stats?.validationRate > 0 && (
              <div className="mt-4">
                <p className="text-sm text-success flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" />
                  High success rate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Purchase Orders */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Purchase Orders</h2>
          <Link href="/purchase-orders">
            <Button variant="outline" size="sm">
              <ShoppingCart className="mr-2 h-4 w-4" />
              View All
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <RecentPurchaseOrders limit={5} />
          </CardContent>
        </Card>
      </div>

      {/* File Upload Section */}
      <FileUploader />

      {/* Recent Files Table */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Recent Files</h2>
        <FilesTable limit={5} showPagination={false} />
      </div>
    </Layout>
  );
}
