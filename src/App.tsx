import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
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
  
  // Navigation State
  const [history, setHistory] = useState<string[]>(["F:\\Coding+Project+Work+hehe"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentPath = history[historyIndex];

  // Cleaner Selection State
  const [selected, setSelected] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Janitor State
  const [isJanitorOpen, setIsJanitorOpen] = useState(false);
  const [janitorPath, setJanitorPath] = useState("");
  const [janitorResults, setJanitorResults] = useState<{path: string, finding_type: string}[]>([]);
  const [janitorSelected, setJanitorSelected] = useState<string[]>([]);
  const [janitorAnalyzing, setJanitorAnalyzing] = useState(false);

  // Menu Dropdown State
  const [toolsOpen, setToolsOpen] = useState(false);

  async function handleScan(pathToScan: string) {
    setScanning(true);
    setSelected([]);
    try {
      const r = await invoke<ScanResult>("scan_disk", { path: pathToScan });
      setResult(r);
    } catch (e) {
      alert("Scan failed: " + e);
    } finally {
      setScanning(false);
    }
  }

  function navigateTo(path: string) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelected([]);
  }

  function goBack() { if (historyIndex > 0) setHistoryIndex(historyIndex - 1); }
  function goForward() { if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1); }
  function goUp() {
    if (currentPath === "F:\\Coding+Project+Work+hehe") return;
    const parts = currentPath.split("\\");
    parts.pop();
    const parent = parts.join("\\");
    if (parent.length >= 3) navigateTo(parent);
  }

  // --- JANITOR FUNCTIONS ---
  async function handleBrowseJanitor() {
    try {
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Project Folder for Janitor" });
      if (selectedPath) {
        setJanitorPath(selectedPath as string);
        setJanitorResults([]);
        setJanitorSelected([]);
      }
    } catch (e) { console.error(e); }
  }

  async function handleRunJanitor() {
    if (!janitorPath) return;
    setJanitorAnalyzing(true);
    setJanitorResults([]);
    setJanitorSelected([]);
    try {
      const res = await invoke<{path: string, finding_type: string}[]>("find_dead_code", { projectPath: janitorPath });
      setJanitorResults(res);
      if (res.length === 0) alert("No dead code found. (Is it a valid Node project?)");
    } catch (e) {
      alert("Analysis failed: " + e);
    } finally {
      setJanitorAnalyzing(false);
    }
  }

  async function executeJanitorDelete() {
    if (janitorSelected.length === 0) return;
    if (!confirm(`Move ${janitorSelected.length} unused files to Recycle Bin?`)) return;
    
    setJanitorAnalyzing(true);
    try {
      await invoke("delete_items", { paths: janitorSelected });
      alert("Files moved to Recycle Bin.");
      // Re-run analysis to update the list
      await handleRunJanitor();
    } catch (e) {
      alert("Error: " + e);
    } finally {
      setJanitorAnalyzing(false);
    }
  }

  // --- CLEANER FUNCTIONS ---
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
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-slate-300 font-sans">
      
      {/* 1. Menu Bar (Home, File, Tools) */}
      <div className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] border-b border-[#1e1e1e] text-xs select-none relative z-50">
        
        <button 
          onClick={() => navigateTo("F:\\Coding+Project+Work+hehe")}
          className="hover:bg-[#3d3d3d] px-3 py-1.5 rounded font-bold text-white"
        >
          Home
        </button>

        <button className="hover:bg-[#3d3d3d] px-3 py-1.5 rounded">
          File
        </button>

        {/* Tools Dropdown Menu */}
        <div className="relative">
          <button 
            onClick={() => setToolsOpen(!toolsOpen)}
            onBlur={() => setTimeout(() => setToolsOpen(false), 200)} // Close when clicking away
            className={`hover:bg-[#3d3d3d] px-3 py-1.5 rounded flex items-center gap-1 ${toolsOpen ? 'bg-[#3d3d3d]' : ''}`}
          >
            Tools <span className="text-[10px]">▼</span>
          </button>
          
          {toolsOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2d] border border-[#3d3d3d] rounded shadow-xl py-1">
              <button 
                onClick={() => {
                  setIsJanitorOpen(true);
                  setToolsOpen(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-[#3d3d3d] text-indigo-400 font-semibold"
              >
                Project Janitor
              </button>
            </div>
          )}
        </div>

        <button className="hover:bg-[#3d3d3d] px-3 py-1.5 rounded">
          Help
        </button>
      </div>

      {/* 2. Navigation Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#1e1e1e]">
        <div className="flex gap-1">
          <button onClick={goBack} disabled={historyIndex === 0} className="p-1.5 rounded hover:bg-[#3d3d3d] disabled:opacity-30 disabled:hover:bg-transparent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goForward} disabled={historyIndex === history.length - 1} className="p-1.5 rounded hover:bg-[#3d3d3d] disabled:opacity-30 disabled:hover:bg-transparent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={goUp} disabled={currentPath === "F:\\Coding+Project+Work+hehe"} className="p-1.5 rounded hover:bg-[#3d3d3d] disabled:opacity-30 disabled:hover:bg-transparent">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </button>
        </div>

        <div className="flex-1 flex items-center bg-[#1e1e1e] border border-[#3d3d3d] rounded px-3 py-1.5 text-sm">
          <span className="text-slate-500 mr-2">📁</span>
          <span className="truncate">{currentPath}</span>
        </div>

        <button onClick={() => handleScan(currentPath)} disabled={scanning} className="px-4 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded text-sm transition-colors disabled:opacity-50">
          {scanning ? "Scanning..." : "Scan Folder"}
        </button>
      </div>

      {/* 3. Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-64 bg-[#252526] border-r border-[#1e1e1e] flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Disk Stats</h2>
            <div className="bg-[#1e1e1e] p-3 rounded border border-[#3d3d3d] text-sm">
              <div className="flex justify-between mb-1"><span className="text-slate-500">Total:</span> <span>{result ? (result.total_bytes / 1024 / 1024 / 1024).toFixed(2) + " GB" : "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Files:</span> <span>{result?.file_count.toLocaleString() || "-"}</span></div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Actions</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => setShowConfirm(true)} disabled={selected.length === 0} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selected.length > 0 ? "bg-red-600 hover:bg-red-500 text-white" : "bg-[#1e1e1e] text-slate-500 cursor-not-allowed border border-[#3d3d3d]"}`}>
                Delete Selected ({selected.length})
              </button>
              <button onClick={handleSelectAllSafe} className="w-full text-left px-3 py-2 rounded text-sm bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">
                Select All Safe
              </button>
              <button onClick={() => setSelected([])} disabled={selected.length === 0} className="w-full text-left px-3 py-2 rounded text-sm bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white transition-colors disabled:opacity-50">
                Deselect All
              </button>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="mt-auto bg-[#1e1e1e] p-3 rounded border border-[#3d3d3d]">
              <div className="text-xs text-slate-400 mb-1">Selected Size:</div>
              <div className="text-lg font-bold text-emerald-400">{(selectedSize / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          )}
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-y-auto p-6 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Folders & Files</h3>
            <div className="border border-[#3d3d3d] rounded-lg overflow-hidden h-[350px]">
              {result ? (
                <Treemap 
                  data={result.entries.filter(e => e.path.startsWith(currentPath))} 
                  junk_findings={result.junk_findings}
                  rootPath={currentPath} 
                  onNodeClick={(path) => navigateTo(path)} 
                />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">Scan a folder to view contents</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Actionable Junk</h3>
            <div className="border border-[#3d3d3d] rounded-lg overflow-hidden bg-[#252526]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#2d2d2d] text-slate-400 uppercase tracking-wider text-xs border-b border-[#3d3d3d]">
                  <tr>
                    <th className="p-3 w-12"></th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3">Path</th>
                    <th className="p-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3d3d3d]">
                  {visibleJunk.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No junk found in this directory.</td></tr>
                  ) : (
                    visibleJunk.map((item) => {
                      const isBlocked = item.tier === "blocked";
                      const isSelected = selected.includes(item.path);
                      return (
                        <tr key={item.path} className={`transition-colors hover:bg-[#2d2d2d] ${isSelected ? "bg-[#2d2d2d]" : ""}`}>
                          <td className="p-3">
                            {isBlocked ? (
                              <span className="text-red-500 text-xs font-bold whitespace-nowrap">🔒 LOCKED</span>
                            ) : (
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(item)} className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-[#1e1e1e] cursor-pointer" />
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-300">{(item.size / 1024 / 1024).toFixed(1)} MB</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.tier === "safe" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : item.tier === "review" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                              {item.tier.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 break-all text-slate-400 font-mono text-xs">{item.path}</td>
                          <td className="p-3 text-slate-500">{item.reason}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CLEANER CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#252526] border border-[#3d3d3d] p-6 rounded-lg w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-2">Confirm Deletion</h2>
            <p className="text-slate-400 text-sm mb-6">Move {selected.length} items ({(selectedSize / 1024 / 1024).toFixed(1)} MB) to Recycle Bin?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded text-sm">Cancel</button>
              <button onClick={executeDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-bold">{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* JANITOR MODAL */}
      {isJanitorOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-[#3d3d3d] rounded-lg w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center bg-[#2d2d2d] px-4 py-3 border-b border-[#1e1e1e]">
              <h2 className="text-white font-bold flex items-center gap-2">
                <span className="text-indigo-400">🧹</span> Project Janitor Mode
              </h2>
              <button onClick={() => setIsJanitorOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              
              {/* Path Picker */}
              <div className="flex gap-2">
                <div className="flex-1 bg-[#252526] border border-[#3d3d3d] rounded px-3 py-2 text-sm text-slate-300 flex items-center overflow-hidden">
                  <span className="mr-2 text-slate-500">📁</span>
                  <span className="truncate">{janitorPath || "No folder selected..."}</span>
                </div>
                <button onClick={handleBrowseJanitor} className="px-4 py-2 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded text-sm whitespace-nowrap">Browse...</button>
                <button onClick={handleRunJanitor} disabled={!janitorPath || janitorAnalyzing} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-semibold disabled:opacity-50 whitespace-nowrap">
                  {janitorAnalyzing ? "Scanning..." : "Run Janitor"}
                </button>
              </div>

              {/* Janitor Actions */}
              {janitorResults.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setJanitorSelected(janitorResults.map(r => r.path))} className="px-3 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded text-xs">Select All</button>
                  <button onClick={() => setJanitorSelected([])} className="px-3 py-1.5 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white rounded text-xs">Deselect All</button>
                  <button onClick={executeJanitorDelete} disabled={janitorSelected.length === 0} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs ml-auto font-bold disabled:opacity-50">
                    Delete Selected ({janitorSelected.length})
                  </button>
                </div>
              )}

              {/* Results Area */}
              <div className="h-[400px] bg-[#252526] border border-[#3d3d3d] rounded-lg overflow-y-auto">
                {janitorAnalyzing ? (
                  <div className="flex items-center justify-center h-full text-slate-500 animate-pulse">Running Knip analysis...</div>
                ) : janitorResults.length > 0 ? (
                  <ul className="divide-y divide-[#3d3d3d]">
                    {janitorResults.map((item, i) => {
                      const isSelected = janitorSelected.includes(item.path);
                      return (
                        <li key={i} className={`p-3 flex justify-between items-center text-sm font-mono cursor-pointer hover:bg-[#2d2d2d] ${isSelected ? "bg-[#2d2d2d]" : ""}`} onClick={() => {
                          setJanitorSelected(prev => prev.includes(item.path) ? prev.filter(p => p !== item.path) : [...prev, item.path]);
                        }}>
                          <div className="flex items-center gap-3 truncate">
                            <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded border-slate-600 text-indigo-500 bg-[#1e1e1e] pointer-events-none" />
                            <span className="truncate text-slate-300">{item.path}</span>
                          </div>
                          <span className="text-xs bg-indigo-500/20 px-2 py-1 rounded text-indigo-300 border border-indigo-500/30 whitespace-nowrap ml-4">{item.finding_type}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">Select a folder and click Run Janitor to find dead code.</div>
                )}
              </div>
              
            </div>
          </div>
        </div>
      )}

    </div>
  );
}