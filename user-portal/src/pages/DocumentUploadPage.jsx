import { useState } from "react";
import FileUploadCard from "../components/FileUploadCard";

const documentList = [
  "Organizer ID",
  "Venue Owner Consent",
  "Event Layout Plan",
  "Safety Plan",
  "Insurance Certificate",
];

const DocumentUploadPage = () => {
  const [uploaded, setUploaded] = useState({});

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-[22px] font-semibold text-textPrimary">Document Upload</h2>
        <p className="mt-2 text-sm text-textSecondary">
          Upload mandatory supporting files. Drag and drop is supported for each document category.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-3 md:grid-cols-2">
          {documentList.map((documentName) => (
            <FileUploadCard
              key={documentName}
              title={documentName}
              required={documentName !== "Venue Owner Consent"}
              onFileSelected={(name) =>
                setUploaded((prev) => ({
                  ...prev,
                  [documentName]: name,
                }))
              }
            />
          ))}
        </div>

        <button
          type="button"
          className="mt-5 rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
        >
          Save Uploaded Documents
        </button>

        {Object.keys(uploaded).length > 0 ? (
          <p className="mt-3 text-sm text-success">{Object.keys(uploaded).length} document(s) selected.</p>
        ) : null}
      </div>
    </section>
  );
};

export default DocumentUploadPage;
