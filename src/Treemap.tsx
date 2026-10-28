import { useState } from "react";

interface ScanEntry {
  path: string;
  size: number;
  is_dir: boolean;
}

interface JunkFinding {
  path: string;
  tier: "safe" | "review" | "blocked";
}

interface TreemapProps {
  data: ScanEntry[];
  junk_findings: JunkFinding[];
  rootPath: string;
  onNodeClick: (path: string) => void;
}

export function Treemap({ data, junk_findings, rootPath, onNodeClick }: TreemapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 1. Get only the immediate children
  const immediateChildren = data.filter(item => {
    if (item.path === rootPath) return false;
    let relativePath = item.path;
    if (relativePath.startsWith(rootPath)) relativePath = relativePath.slice(rootPath.length);
    const parts = relativePath.split("\\").filter(Boolean);
    return parts.length === 1;
  }).map(item => {
    // 2. Roll up the folder sizes properly
    if (item.is_dir && item.size === 0) {
      const folderSize = data
        .filter(child => child.path.startsWith(item.path + "\\") && !child.is_dir)
        .reduce((sum, child) => sum + child.size, 0);
      return { ...item, size: folderSize };
    }
    return item;
  });

  // 3. Sort descending
  const sortedChildren = [...immediateChildren].sort((a, b) => b.size - a.size);

  if (sortedChildren.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-900/50 rounded-xl">
        Empty folder
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-4 bg-slate-900/80">
      {/* Uniform Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedChildren.map((item) => {
          const isFolder = !item.path.split('\\').pop()?.includes('.');
          
          // Check if this folder has a specific safety tier
          const junkInfo = junk_findings.find(j => j.path === item.path);

          // Determine colors
          let bgColor = isFolder ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-800/50 hover:bg-slate-700/50";
          let borderColor = isFolder ? "border-slate-600" : "border-slate-700";
          
          if (junkInfo) {
            if (junkInfo.tier === "safe") { bgColor = "bg-emerald-900/40 hover:bg-emerald-800/60"; borderColor = "border-emerald-700/50"; }
            if (junkInfo.tier === "review") { bgColor = "bg-amber-900/40 hover:bg-amber-800/60"; borderColor = "border-amber-700/50"; }
            if (junkInfo.tier === "blocked") { bgColor = "bg-red-900/40 hover:bg-red-800/60"; borderColor = "border-red-700/50"; }
          }

          return (
            <div
              key={item.path}
              onClick={() => onNodeClick(item.path)}
              onMouseEnter={() => setHoveredId(item.path)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                ${bgColor} ${borderColor} border rounded-xl p-4 cursor-pointer 
                transition-all duration-200 relative overflow-hidden flex flex-col justify-between
                h-[120px] w-full
                ${hoveredId === item.path ? 'ring-2 ring-indigo-500 shadow-xl scale-[1.02] z-10' : 'shadow-sm'}
              `}
            >
              <div className="flex items-start gap-2 z-10 relative">
                <span className="text-2xl mt-0.5">
                  {junkInfo?.tier === "safe" ? '🟢' : junkInfo?.tier === "review" ? '🟡' : junkInfo?.tier === "blocked" ? '🔴' : (isFolder ? '📁' : '📄')}
                </span>
                <span className="font-semibold text-slate-200 text-sm break-all line-clamp-2" title={item.path}>
                  {item.path.split('\\').pop()}
                </span>
              </div>
              
              <div className="z-10 relative">
                <div className="text-xs font-mono text-slate-400">
                  {(item.size / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}