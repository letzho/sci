import { useCallback, useRef, useState } from 'react';
import { GitCompare, UploadCloud, FileText, X, Sparkles, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import { Button, LoadingSpinner } from './ui.jsx';

/**
 * Drag-and-drop policy comparison. The rep drops 2-4 policy PDFs (from any
 * insurer); the AI reads each and returns a normalized, side-by-side table of
 * objective facts. Compliance-safe: it lays out differences, never a "best" pick.
 */
export default function PolicyComparison() {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const addFiles = useCallback((incoming) => {
    const pdfs = Array.from(incoming).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    setError(null);
    setFiles((prev) => {
      const combined = [...prev];
      for (const f of pdfs) {
        if (!combined.some((c) => c.name === f.name && c.size === f.size) && combined.length < 4) {
          combined.push(f);
        }
      }
      return combined;
    });
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function runComparison() {
    if (files.length < 2) {
      setError('Add at least 2 policy PDFs to compare.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      const res = await api.post('/policies/compare', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Comparison failed. Check the backend is running with an OpenAI key.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setError(null);
  }

  const comparison = result?.comparison;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare size={14} className="text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-700">Compare policy documents</h3>
      </div>
      <p className="text-[11px] text-slate-500">
        Drop 2-4 policy PDFs (any insurer). AI lays out the differences side by side — objective facts only, never a recommendation.
      </p>

      {!comparison && (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
            }`}
          >
            <UploadCloud size={22} className="mx-auto text-brand-500 mb-1.5" />
            <p className="text-xs font-medium text-slate-600">Drag policy PDFs here</p>
            <p className="text-[10px] text-slate-400 mt-0.5">or click to browse · up to 4 files</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
                  <FileText size={13} className="text-slate-400 shrink-0" />
                  <span className="text-[11px] text-slate-600 truncate flex-1">{f.name}</span>
                  <span className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-rose-500" aria-label="Remove">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[11px] text-rose-600">{error}</p>}

          <Button size="sm" onClick={runComparison} disabled={loading || files.length < 2} className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <Sparkles size={13} className="animate-pulse" /> AI reading documents…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} /> Compare {files.length > 0 ? `${files.length} documents` : ''}
              </span>
            )}
          </Button>
        </>
      )}

      {loading && !comparison && (
        <div className="py-4 flex flex-col items-center gap-2">
          <LoadingSpinner />
          <p className="text-[10px] text-slate-400">Extracting text and normalizing benefits…</p>
        </div>
      )}

      {comparison && (
        <div className="space-y-3">
          {result.failed?.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-2">
              <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-700">
                Skipped: {result.failed.map((f) => f.name).join(', ')} (couldn't read text — likely scanned images).
              </p>
            </div>
          )}

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-2 text-slate-500 font-medium sticky left-0 bg-white">Attribute</th>
                  {comparison.policies.map((p, i) => (
                    <th key={i} className="text-left py-2 px-2 font-semibold text-slate-700 whitespace-nowrap min-w-[120px]">
                      <div>{p.name}</div>
                      {p.insurer && <div className="text-[9px] font-normal text-slate-400">{p.insurer}</div>}
                      {p.productType && <div className="text-[9px] font-normal text-brand-500">{p.productType}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.attributes.map((attr, r) => (
                  <tr key={r} className="border-b border-slate-50 align-top">
                    <td className="py-2 pr-2 font-medium text-slate-600 sticky left-0 bg-white">{attr.label}</td>
                    {attr.values.map((v, c) => (
                      <td key={c} className="py-2 px-2 text-slate-600">
                        {v == null || v === '' ? <span className="text-slate-300">—</span> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comparison.summary && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
              <p className="text-[11px] text-slate-600 leading-relaxed">{comparison.summary}</p>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Objective facts extracted from the uploaded documents. This tool does not recommend a policy — verify figures against the original documents.
          </p>

          <Button size="sm" variant="outline" onClick={reset} className="w-full">
            Compare different documents
          </Button>
        </div>
      )}
    </div>
  );
}
