import React, { useState, useEffect, useMemo } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Upload, Loader2, Download, Wand2, ArrowRight, Trash2, CheckCircle2, X, Filter, Maximize2, ZoomIn, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import DropZone from './components/DropZone';
import { loadPDF, renderPageToCanvas, extractRegions, loadImageToCanvas } from './lib/extraction';
import './index.css';

// Modal Component
const ImageModal = ({ item, onClose, isSelected, onToggle }) => {
  if (!item) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white border border-gray-100 rounded-2xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 bg-white/80 hover:bg-gray-100 rounded-full text-gray-700 transition-colors shadow-sm">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjAuNSI+PHBhdGggZD0iTTAgMGwyMCAyMHBNMjAgMGwtMjAgMjAiLz48L3N2Zz4=')] bg-repeat bg-opacity-5 p-8">
          <img
            src={item.processedUrl || item.original}
            alt="Full Preview"
            className="max-w-full max-h-full object-contain drop-shadow-2xl"
          />
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-400 font-mono">
            Page {item.page} • {item.width} x {item.height} px
          </div>
          <button
            onClick={() => onToggle(item.id)}
            className={`
                            flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg transition-all
                            ${isSelected
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-105'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}
                        `}
          >
            <CheckCircle2 size={24} fill={isSelected ? "currentColor" : "none"} />
            {isSelected ? 'SELECTED' : 'SELECT'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState([]);

  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [selectedFinal, setSelectedFinal] = useState(new Set());

  const [previewItem, setPreviewItem] = useState(null);
  const [minSizeFilter, setMinSizeFilter] = useState(30);

  const itemsByPage = useMemo(() => {
    const groups = {};
    extractedItems.forEach(item => {
      if (item.width < minSizeFilter || item.height < minSizeFilter) return;
      if (!groups[item.page]) groups[item.page] = [];
      groups[item.page].push(item);
    });
    return groups;
  }, [extractedItems, minSizeFilter]);

  const handleFileAccepted = async (uploadedFile) => {
    setFile(uploadedFile);
    setStatus('loading_pdf'); // Keep same status name for simplicity or change to 'loading_file'
    setProgress(0);

    try {
      const items = [];
      const isPdf = uploadedFile.type === 'application/pdf';

      if (isPdf) {
        const pdf = await loadPDF(uploadedFile);
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
          setProgress((i / totalPages) * 100);
          const page = await pdf.getPage(i);
          const canvas = await renderPageToCanvas(page, 2.0);
          const regions = extractRegions(canvas);

          regions.forEach(r => {
            items.push({
              ...r,
              page: i,
              processed: false,
              original: r.dataUrl,
              processedUrl: null
            });
          });
        }
      } else {
        // Handle Image
        // It's a single page "document"
        setProgress(10); // Start
        const canvas = await loadImageToCanvas(uploadedFile);
        setProgress(50); // Loaded
        const regions = extractRegions(canvas);

        regions.forEach(r => {
          items.push({
            ...r,
            page: 1, // Treat image as page 1
            processed: false,
            original: r.dataUrl,
            processedUrl: null
          });
        });
        setProgress(100);
      }

      setExtractedItems(items);
      setSelectedCandidates(new Set());

      if (items.length === 0) {
        alert("No potential stamps/signatures found.");
        setStatus('idle');
        return;
      }

      setStatus('selection_phase');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const toggleCandidate = (id) => {
    const newSet = new Set(selectedCandidates);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCandidates(newSet);
  };

  const processSelectedCandidates = async () => {
    if (selectedCandidates.size === 0) return;

    setStatus('removing_bg');
    setProgress(0);

    const newItems = [...extractedItems];
    const total = selectedCandidates.size;
    let completed = 0;

    for (const item of newItems) {
      if (selectedCandidates.has(item.id)) {
        if (item.processed) {
          completed++;
          continue;
        }
        try {
          const blob = await removeBackground(item.original);
          const url = URL.createObjectURL(blob);
          item.processedUrl = url;
          item.processed = true;
        } catch (e) {
          console.error("BG Removal failed", item.id, e);
          item.processedUrl = item.original;
        }
        completed++;
        setProgress(Math.round((completed / total) * 100));
      }
    }

    setExtractedItems(newItems);

    const processedIds = newItems
      .filter(i => i.processed && selectedCandidates.has(i.id))
      .map(i => i.id);

    setSelectedFinal(new Set(processedIds));
    setStatus('ready');
  };

  const toggleFinal = (id) => {
    const newSet = new Set(selectedFinal);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFinal(newSet);
  };

  const downloadFinal = async () => {
    let count = 0;
    for (const item of extractedItems) {
      if (selectedFinal.has(item.id)) {
        const url = item.processedUrl || item.original;

        try {
          const blob = await fetch(url).then(r => r.blob());
          saveAs(blob, `stamp_page_${item.page}_${item.id}.png`);
          count++;
        } catch (e) {
          console.error("Download failed", e);
        }

        // Small delay to help browser handle multiple downloads if needed
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (count === 0) {
      alert("No items selected for download.");
    }
  };

  const togglePageSelection = (pageItems) => {
    const allSelected = pageItems.every(i => selectedCandidates.has(i.id));
    const newSet = new Set(selectedCandidates);

    pageItems.forEach(i => {
      if (allSelected) newSet.delete(i.id);
      else newSet.add(i.id);
    });
    setSelectedCandidates(newSet);
  };

  return (
    <div className="min-h-screen p-8 text-slate-900 relative">
      <div className="container mx-auto pb-32">
        <header className="mb-8 flex justify-between items-center glass-panel p-6 rounded-2xl sticky top-4 z-40 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-xl">
          <div>
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <span className="text-gradient">PNG+ v2</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {status === 'selection_phase' && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
                <Filter size={14} />
                <span>Filter Noise:</span>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={minSizeFilter}
                  onChange={(e) => setMinSizeFilter(Number(e.target.value))}
                  className="w-24 accent-indigo-500"
                />
              </div>
            )}
            {status !== 'idle' && (
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary text-sm flex items-center gap-2 py-2 px-4 shadow-lg hover:shadow-xl"
              >
                <X size={16} /> Start Over
              </button>
            )}
          </div>
        </header>

        <main className="flex flex-col items-center justify-center min-h-[50vh]">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
              >
                <DropZone onFileAccepted={handleFileAccepted} />
              </motion.div>
            )}

            {(status === 'loading_pdf' || status === 'removing_bg') && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center w-full max-w-lg"
              >
                <div className="loader mx-auto mb-8"></div>
                <h2 className="text-2xl font-bold mb-4">
                  {status === 'loading_pdf' ? 'Scanning & Detecting...' : 'Isolating Stamps...'}
                </h2>
                <div className="w-full h-2 bg-gray-200 rounded-full mx-auto overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
                <p className="mt-4 text-gray-500 font-mono text-sm">{Math.round(progress)}%</p>
              </motion.div>
            )}

            {status === 'selection_phase' && (
              <motion.div
                key="selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
              >
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-bold mb-2">Review Candidates</h2>
                  <p className="text-gray-500 max-w-2xl mx-auto text-sm">
                    Hover to enlarge, click to view full size. Select potential stamps.
                  </p>
                </div>

                <div className="space-y-12">
                  {Object.entries(itemsByPage).map(([page, items]) => (
                    <div key={page} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-4 mb-4 pb-2 border-b border-gray-200">
                        <h3 className="text-xl font-bold text-slate-800">Page {page}</h3>
                        <div className="flex-grow"></div>
                        <button
                          onClick={() => togglePageSelection(items)}
                          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1 rounded transition-colors"
                        >
                          {items.every(i => selectedCandidates.has(i.id)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {/* Grid Layout */}
                      <div className="flex flex-wrap gap-4 justify-start">
                        {items.map(item => {
                          const isSelected = selectedCandidates.has(item.id);
                          return (
                            <motion.div
                              layout
                              key={item.id}
                              whileHover={{ scale: 1.02 }}
                              className={`
                                relative group rounded-xl border-2 transition-all duration-200 overflow-hidden bg-white shadow-sm hover:shadow-md w-48 h-48 flex flex-col
                                ${isSelected
                                  ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                                  : 'border-slate-200 hover:border-slate-300'}
                              `}
                            >
                              {/* Top Bar with Dimensions & Zoom */}
                              <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-20 pointer-events-none">
                                <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                                  {item.width}x{item.height}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                                  className="pointer-events-auto p-1.5 bg-white/90 hover:bg-white rounded-full text-slate-700 shadow-sm transition-transform hover:scale-110"
                                  title="Enlarge View"
                                >
                                  <Maximize2 size={14} />
                                </button>
                              </div>

                              {/* Main Image Area */}
                              <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjAuNSI+PHBhdGggZD0iTTAgMGwyMCAyMHBNMjAgMGwtMjAgMjAiLz48L3N2Zz4=')] bg-repeat bg-opacity-5">
                                <img
                                  src={item.original}
                                  alt="Candidate"
                                  className="max-w-full max-h-full object-contain drop-shadow-sm"
                                />
                              </div>

                              {/* Bottom Selection Bar */}
                              <div
                                onClick={() => toggleCandidate(item.id)}
                                className={`
                                  cursor-pointer h-10 border-t flex items-center justify-center gap-2 transition-colors font-medium text-sm
                                  ${isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}
                                `}
                              >
                                <div className={`
                                  w-4 h-4 rounded border flex items-center justify-center
                                  ${isSelected ? 'bg-white border-white' : 'border-slate-400 bg-white'}
                                `}>
                                  {isSelected && <CheckCircle2 size={12} className="text-indigo-600" strokeWidth={4} />}
                                </div>
                                {isSelected ? 'Selected' : 'Select'}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Spacing for fixed footer */}
                <div className="h-32"></div>

                {/* Sticky Bottom Footer for Processing */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-200 flex items-center justify-center z-50 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={processSelectedCandidates}
                      disabled={selectedCandidates.size === 0}
                      className="btn-primary inline-flex items-center gap-3 text-lg px-12 py-4 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
                    >
                      <Wand2 size={24} />
                      PROCESS {selectedCandidates.size} ITEMS
                    </button>
                    <p className="text-xs text-slate-400 font-medium">
                      {selectedCandidates.size === 0 ? "Select items above to start" : "Ready to remove backgrounds"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'ready' && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
              >
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-semibold mb-2">Processed Results</h2>
                  <p className="text-gray-500 text-sm">Backgrounds removed. Check to download.</p>
                </div>

                <div className="flex justify-center mb-8">
                  <button onClick={downloadFinal} className="btn-primary flex items-center gap-2">
                    <Download size={18} /> Download Selected ({selectedFinal.size})
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {extractedItems.filter(i => i.processed && selectedCandidates.has(i.id)).map(item => (
                    <motion.div
                      layout
                      key={item.id}
                      onClick={() => toggleFinal(item.id)}
                      className={`
                            rounded-xl border relative cursor-pointer overflow-hidden transition-all duration-200 group
                            ${selectedFinal.has(item.id)
                          ? 'border-pink-500 ring-2 ring-pink-500/20'
                          : 'border-gray-200 bg-white opacity-80'}
                        `}
                    >
                      {/* Enlarged Trigger for processed items too */}
                      <div
                        onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                        className="absolute top-2 left-2 z-20 p-2 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <Maximize2 size={16} className="text-white" />
                      </div>

                      <div className="aspect-square w-full relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjAuNSI+PHBhdGggZD0iTTAgMGwyMCAyMHBNMjAgMGwtMjAgMjAiLz48L3N2Zz4=')] bg-repeat bg-opacity-5 flex items-center justify-center p-4">
                        <div className={`absolute top-2 right-2 z-10 transition-colors ${selectedFinal.has(item.id) ? 'text-pink-500' : 'text-gray-600'}`}>
                          <CheckCircle2 size={24} fill={selectedFinal.has(item.id) ? "currentColor" : "none"} />
                        </div>

                        <img
                          src={item.processedUrl}
                          alt="Processed"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Modal Layer */}
            <AnimatePresence>
              {previewItem && (
                <ImageModal
                  item={previewItem}
                  onClose={() => setPreviewItem(null)}
                  isSelected={selectedCandidates.has(previewItem.id)}
                  onToggle={(id) => toggleCandidate(id)}
                />
              )}
            </AnimatePresence>

            {status === 'error' && (
              <div className="text-red-400 text-center glass-panel p-8 rounded-xl">
                <p className="text-xl mb-4">Something went wrong processing the PDF.</p>
                <button onClick={() => window.location.reload()} className="btn-secondary">Try Again</button>
              </div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
