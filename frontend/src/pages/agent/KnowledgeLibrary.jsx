import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import api from '../../api/client';
import { Badge, Button, Card, LoadingSpinner, ProductSelect, productLabel } from '../../components/ui.jsx';
import styles from './KnowledgeLibrary.module.css';

const STATUS_TONE = { active: 'success', processing: 'warning', failed: 'danger' };
const STATUS_LABEL = { active: 'Active', processing: 'Processing...', failed: 'Failed' };

function DocumentRow({ doc, onDelete, deleting }) {
  const isUrl = doc.sourceType === 'url';
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 ${styles.docRow}`}>
      <div className="h-9 w-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
        {isUrl ? <Link2 size={16} className="text-brand-600" /> : <FileText size={16} className="text-brand-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 truncate" title={doc.filename}>
          {doc.title || doc.filename}
        </div>
        {isUrl && doc.sourceUrl && (
          <a
            href={doc.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-brand-500 hover:underline truncate block"
            title={doc.sourceUrl}
          >
            {doc.sourceUrl}
          </a>
        )}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <Badge tone="neutral">{doc.productType ? productLabel(doc.productType) : 'General'}</Badge>
          <Badge tone={STATUS_TONE[doc.status] || 'neutral'}>
            {doc.status === 'processing' && <Loader2 size={11} className={styles.spin} />}
            {STATUS_LABEL[doc.status] || doc.status}
          </Badge>
          {doc.status === 'active' && (
            <span className="text-[11px] text-slate-400">{doc.chunkCount} chunk{doc.chunkCount === 1 ? '' : 's'} learned</span>
          )}
          {doc.status === 'failed' && doc.error && <span className="text-[11px] text-rose-500">{doc.error}</span>}
        </div>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        title="Remove document"
        className={`text-slate-400 hover:text-rose-600 shrink-0 p-1.5 rounded-lg hover:bg-rose-50 ${styles.deleteBtn}`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function ApprovedEntryCard({ entry }) {
  return (
    <div className={`rounded-xl border border-slate-100 p-3 ${styles.entryCard}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-700">{entry.topic}</div>
        <Badge tone="brand">{productLabel(entry.productType)}</Badge>
      </div>
      <p className="text-xs text-slate-500 mt-1">{entry.plainEnglish}</p>
      <details className="mt-1.5">
        <summary className="text-[11px] text-brand-600 cursor-pointer select-none">Approved wording</summary>
        <p className="text-xs text-slate-700 mt-1 bg-slate-50 rounded-lg border border-slate-100 p-2">{entry.approvedMessage}</p>
      </details>
    </div>
  );
}

/**
 * Knowledge Library (agent role only): browse the curated, pre-approved
 * messaging library, and upload product PDFs so the Knowledge Agent can
 * ground chat drafts / live guidance in your own reference material when
 * the curated library doesn't already cover a question. Uploaded content
 * is always tagged "from your document" wherever it surfaces downstream -
 * it supplements approved messaging, it never replaces it.
 */
export default function KnowledgeLibrary() {
  const [documents, setDocuments] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadProductType, setUploadProductType] = useState('');
  const [kbFilter, setKbFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sourceTab, setSourceTab] = useState('pdf'); // 'pdf' | 'url'
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    const res = await api.get('/documents');
    setDocuments(res.data.documents);
  }, []);

  const loadKb = useCallback(async (productType) => {
    const res = await api.get('/knowledge-base', { params: productType ? { productType } : {} });
    setKbEntries(res.data.entries);
  }, []);

  useEffect(() => {
    Promise.all([loadDocuments(), loadKb('')]).finally(() => setLoading(false));
  }, [loadDocuments, loadKb]);

  useEffect(() => {
    loadKb(kbFilter);
  }, [kbFilter, loadKb]);

  function isPdf(file) {
    return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  }

  async function uploadPdf(file) {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('productType', uploadProductType);
    const res = await api.post('/documents', formData);
    return res.data.document;
  }

  async function handleFiles(fileList) {
    const allFiles = Array.from(fileList || []);
    const pdfFiles = allFiles.filter(isPdf);
    if (!pdfFiles.length) {
      setUploadError('Please choose one or more PDF files.');
      return;
    }

    const skipped = allFiles.length - pdfFiles.length;
    setUploading(true);
    setUploadError(null);
    setUploadProgress({ done: 0, total: pdfFiles.length, currentName: pdfFiles[0].name });

    const uploaded = [];
    const errors = [];

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      setUploadProgress({ done: i, total: pdfFiles.length, currentName: file.name });
      try {
        const doc = await uploadPdf(file);
        uploaded.push(doc);
        setDocuments((prev) => [doc, ...prev]);
      } catch (err) {
        errors.push(`${file.name}: ${err.response?.data?.error || 'Upload failed'}`);
      }
    }

    setUploadProgress(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (errors.length) {
      const summary =
        uploaded.length > 0
          ? `${uploaded.length} uploaded, ${errors.length} failed — ${errors.join('; ')}`
          : errors.join('; ');
      setUploadError(summary);
    } else if (skipped > 0) {
      setUploadError(`${skipped} non-PDF file${skipped === 1 ? '' : 's'} skipped.`);
    }
  }

  async function handleUrlSubmit(e) {
    e.preventDefault();
    const url = urlValue.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      setUploadError('Please paste a valid http(s) link.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await api.post('/documents/url', { url, productType: uploadProductType });
      setDocuments((prev) => [res.data.document, ...prev]);
      setUrlValue('');
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Could not process that link - please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Knowledge Library</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Browse approved messaging, and teach the AI from your own product PDFs or links when it doesn't have an answer.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <UploadCloud size={16} className="text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-700">Teach the Knowledge Agent</h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Product summaries, fact sheets, fund prospectuses, or a public link (an insurer's product page, MAS/CPF
          guidance). The AI will use short excerpts as extra reference material - clearly labelled "from your
          document" - only when approved messaging doesn't already cover the question.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Tag with product:</span>
          <ProductSelect value={uploadProductType} onChange={setUploadProductType} includeAll />
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 mb-3 bg-slate-50">
          <button
            type="button"
            onClick={() => {
              setSourceTab('pdf');
              setUploadError(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sourceTab === 'pdf' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            Upload PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceTab('url');
              setUploadError(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sourceTab === 'url' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            Paste URL
          </button>
        </div>

        {sourceTab === 'pdf' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4 py-6 ${styles.dropzone} ${
              dragOver ? styles.dropzoneActive : 'border-slate-200'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={22} className={`text-brand-500 mb-2 ${styles.spin}`} />
                <p className="text-sm text-slate-500">
                  {uploadProgress
                    ? `Reading ${uploadProgress.done + 1} of ${uploadProgress.total}: ${uploadProgress.currentName}`
                    : 'Reading and chunking your PDFs…'}
                </p>
              </>
            ) : (
              <>
                <UploadCloud size={22} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Drag PDFs here, or</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  Choose PDFs
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleUrlSubmit} className="rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-4 py-6 gap-3">
            {uploading ? (
              <>
                <Loader2 size={22} className={`text-brand-500 mb-1 ${styles.spin}`} />
                <p className="text-sm text-slate-500">Fetching and reading that page...</p>
              </>
            ) : (
              <>
                <Link2 size={22} className="text-slate-300" />
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://www.example-insurer.com/product-page"
                  className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                <Button type="submit" variant="outline" size="sm" disabled={!urlValue.trim()}>
                  Learn from this link
                </Button>
              </>
            )}
          </form>
        )}
        {uploadError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600">
            <AlertTriangle size={13} /> {uploadError}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-slate-400">No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} deleting={deletingId === doc.id} />
            ))
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-700">Approved messaging library</h2>
          </div>
          <ProductSelect value={kbFilter} onChange={setKbFilter} includeAll />
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Pre-approved wording every channel pulls from - the same source of truth behind live guidance and chat
          drafts. Browse it any time, even outside a live session.
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {kbEntries.map((entry) => (
            <ApprovedEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
        {kbEntries.length === 0 && <p className="text-xs text-slate-400">No entries found for this filter.</p>}
      </Card>

      <Card className={`p-4 flex items-start gap-3 ${styles.trustNote}`}>
        <CheckCircle2 size={17} className="text-emerald-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          Uploaded documents never overwrite or get treated as approved messaging - they only fill gaps, and every
          chat draft or live guidance card sourced from one is labelled "from your document" so it stays transparent.
        </p>
      </Card>
    </div>
  );
}
