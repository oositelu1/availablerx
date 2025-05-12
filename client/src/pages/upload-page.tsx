import { Layout } from "@/components/layout/layout";
import { FileUploader } from "@/components/file-uploader";
import { FilesTable } from "@/components/files-table";

export default function UploadPage() {
  return (
    <Layout title="Upload Files">
      <FileUploader />
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recently Uploaded Files</h2>
        <FilesTable />
      </div>
    </Layout>
  );
}
