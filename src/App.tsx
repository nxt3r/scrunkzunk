import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Treemap } from "./Treemap";

interface ScanEntry { path: string; size: number; is_dir: boolean; }
interface JunkFinding { path: string; size: number; tier: "safe" | "review" | "blocked"; reason: string; }
interface ScanResult {
  root: string;
  total_bytes: number;
  file_count: number;
  entries: ScanEntry[];
  junk_findings: JunkFinding[];
  skipped_errors: string[];
}

export default function App() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [currentPath, setCurrentPath] = useState("D:\\projects");
  const [selected, setSelected] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleScan(pathToScan: string) {
    setScanning(true);
    setSelected([]);
    try {
      const r = await invoke<ScanResult>("scan_disk", { path: pathToScan });
      setResult(r);
      setCurrentPath(pathToScan);
    } catch (e) {
      alert("Scan failed: " + e);
    } finally {
      setScanning(false);
    }
  }

  const visibleJunk = result?.junk_findings.filter(j => j.path.startsWith(currentPath)) || [];
  
  const selectedSize = selected.reduce((sum, path) => {
    const item = result?.junk_findings.find(j => j.path === path);
    return sum + (item ? item.size : 0);
  }, 0);

  function toggleSelection(item: JunkFinding) {
    if (item.tier === "blocked") return;
    setSelected(prev => prev.includes(item.path) ? prev.filter(p => p !== item.path) : [...prev, item.path]);
  }

  function handleSelectAllSafe() {
    const safePaths = visibleJunk.filter(j => j.tier === "safe").map(j => j.path);
    setSelected(prev => Array.from(new Set([...prev, ...safePaths])));
  }

  async function executeDelete() {
    if (selected.length === 0) return;
    setDeleting(true);
    try {
      await invoke("delete_items", { paths: selected });
      setShowConfirm(false);
      await handleScan(currentPath);
    } catch (e) {
      alert("Error: " + e);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">ScrunkZunk</h1>
        <button 
          onClick={() => handleScan("D:\\projects")} 
          disabled={scanning} 
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Rescan D:\\projects"}
        </button>
      </div>

      {result && (
        <>
          {/* Stats Bar */}
          <div className="flex gap-6 p-4 bg-slate-800/50 border border-slate-700 rounded-xl backdrop-blur-sm text-sm text-slate-300">
            <div><span className="text-slate-500">Path:</span> {currentPath}</div>
            <div><span className="text-slate-500">Total:</span> {(result.total_bytes / 1024 / 1024 / 1024).toFixed(2)} GB</div>
            {selected.length > 0 && (
              <div className="text-emerald-400 font-semibold ml-auto">
                Selected: {selected.length} items ({(selectedSize / 1024 / 1024).toFixed(1)} MB)
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowConfirm(true)} 
              disabled={selected.length === 0} 
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                selected.length > 0 
                  ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              Delete Selected ({selected.length})
            </button>
            
            <button 
              onClick={handleSelectAllSafe} 
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-emerald-900/20"
            >
              Select All Safe
            </button>

            {currentPath !== "D:\\projects" && (
              <button 
                onClick={() => setCurrentPath("D:\\projects")} 
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-all border border-slate-700"
              >
                ⬅ Back to Root
              </button>
            )}
          </div>

          {/* Treemap Section */}
          <div className="border border-slate-700 rounded-xl overflow-hidden h-[350px] shadow-2xl">
            <Treemap data={result.entries.filter(e => e.path.startsWith(currentPath))} rootPath={currentPath} onNodeClick={(path) => setCurrentPath(path)} />
          </div>
          
          {/* Junk Table */}
          <div>
            <h3 className="text-xl font-bold mb-4">Actionable Junk</h3>
            <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-4 w-12"></th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Tier</th>
                    <th className="p-4">Path</th>
                    <th className="p-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {visibleJunk.map((item) => {
                    const isBlocked = item.tier === "blocked";
                    const isSelected = selected.includes(item.path);
                    return (
                      <tr key={item.path} className={`transition-colors hover:bg-slate-800/50 ${isSelected ? "bg-slate-800/80" : ""}`}>
                        <td className="p-4">
                          {isBlocked ? (
                            <span className="text-red-500 text-xs font-bold whitespace-nowrap">🔒 LOCKED</span>
                          ) : (
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => toggleSelection(item)} 
                              className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 bg-slate-700 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="p-4 font-mono text-slate-300">{(item.size / 1024 / 1024).toFixed(1)} MB</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            item.tier === "safe" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : item.tier === "review" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {item.tier.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 break-all text-slate-300 font-mono text-xs">{item.path}</td>
                        <td className="p-4 text-slate-500">{item.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Confirm Deletion</h2>
            <p className="text-slate-300 mb-6">
              You are about to move <strong className="text-white">{selected.length} items</strong> ({(selectedSize / 1024 / 1024).toFixed(1)} MB) to the Recycle Bin.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowConfirm(false)} 
                disabled={deleting} 
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete} 
                disabled={deleting} 
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-900/30"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}