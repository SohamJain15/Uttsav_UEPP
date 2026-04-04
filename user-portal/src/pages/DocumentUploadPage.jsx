import { useState } from "react";
import { useParams } from "react-router-dom";
import FileUploadCard from "../components/FileUploadCard";
import { applicationService } from "../services/applicationService";

const documentList = [
  "Organizer ID",
  "Venue Owner Consent",
  "Event Layout Plan",
  "Safety Plan",
  "Insurance Certificate",
];

const DocumentUploadPage = () => {
  const { appId } = useParams();
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadResults, setUploadResults] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!appId) {
      setStatusMessage("Open uploads from a specific application so we know which app_id to attach.");
      return;
    }

    const entries = Object.entries(selectedFiles).filter(([, file]) => Boolean(file));
    if (!entries.length) {
      setStatusMessage("Please select at least one document before saving.");
      return;
    }

    setIsUploading(true);
    setStatusMessage("");

    try {
      const nextResults = {};
      for (const [docType, file] of entries) {
        const formData = new FormData();
        formData.append("app_id", appId);
        formData.append("doc_type", docType);
        formData.append("file", file);

        const response = await applicationService.uploadDocument(formData);
        nextResults[docType] = response?.storage_url || response?.public_url || response?.document_url || file.name;
      }

      setUploadResults((previous) => ({ ...previous, ...nextResults }));
      setStatusMessage(`${entries.length} document(s) uploaded successfully.`);
    } catch (error) {
      setStatusMessage(applicationService.getErrorMessage(error, "Document upload failed."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">Document Upload</h2>
        <p className="mt-2 text-sm text-textSecondary">
          Upload mandatory supporting files for application {appId || "(open from tracking page)"}.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-3 md:grid-cols-2">
          {documentList.map((documentName) => (
            <FileUploadCard
              key={documentName}
              title={documentName}
              required={documentName !== "Venue Owner Consent"}
              uploadedFile={uploadResults[documentName] ? { name: uploadResults[documentName] } : null}
              onFileSelected={(_, file) =>
                setSelectedFiles((prev) => ({
                  ...prev,
                  [documentName]: file,
                }))
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleUpload}
          disabled={isUploading}
          className="mt-5 rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          {isUploading ? "Uploading..." : "Save Uploaded Documents"}
        </button>

        {Object.keys(selectedFiles).length > 0 ? (
          <p className="mt-3 text-sm text-success">
            {Object.keys(selectedFiles).length} document(s) selected.
          </p>
        ) : null}

        {statusMessage ? (
          <p className="mt-3 text-sm text-textSecondary">{statusMessage}</p>
        ) : null}
      </div>
    </section>
  );
};

export default DocumentUploadPage;
