import { useState } from "react";

interface ScanEntry {
  path: string;
  size: number;
  is_dir: boolean;
}

interface TreemapProps {
  data: ScanEntry[];
  rootPath: string;
  onNodeClick: (path: string) => void;
}

export function Treemap({ data, rootPath, onNodeClick }: TreemapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 1. Get only the immediate children of the current root
  const immediateChildren = data.filter(item => {
    if (item.path === rootPath) return false;
    let relativePath = item.path;
    if (relativePath.startsWith(rootPath)) {
      relativePath = relativePath.slice(rootPath.length);
    }
    const parts = relativePath.split("\\").filter(Boolean);
    return parts.length === 1;
  }).map(item => {
    // If it's a folder (size 0), calculate its total size by summing all files inside it
    if (item.is_dir && item.size === 0) {
      const folderSize = data
        .filter(child => child.path.startsWith(item.path + "\\") && !child.is_dir)
        .reduce((sum, child) => sum + child.size, 0);
      return { ...item, size: folderSize };
    }
    return item;
  });

  if (immediateChildren.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-900/50 rounded-xl">
        Empty folder
      </div>
    );
  }

  // 2. Sort by size descending
  const sortedChildren = [...immediateChildren].sort((a, b) => b.size - a.size);
  
  // 3. Calculate total size to determine percentages
  const totalSize = sortedChildren.reduce((sum, item) => sum + item.size, 0) || 1;

  // 4. Categorize items: "Big" items get proportion-based heights (min 150px), 
  // small items get a fixed height so they don't disappear.
  const threshold = totalSize * 0.05; // Items > 5% of total are "big"

  return (
    <div className="w-full h-full overflow-y-auto p-4 bg-slate-900/80">
      {/* File Explorer Grid */}
      <div className="flex flex-wrap gap-2 content-start">
        {sortedChildren.map((item) => {
          const isBig = item.size > threshold;
          const percentage = ((item.size / totalSize) * 100).toFixed(1);
          
          // Determine colors based on whether it's a folder (no extension) or file
          // A better heuristic: if it has no dot in the last part, it's a folder.
          const isFolder = !item.path.split('\\').pop()?.includes('.');
          
          let bgColor = isFolder ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-800/50 hover:bg-slate-700/50";
          let borderColor = isFolder ? "border-slate-600" : "border-slate-700";

          return (
            <div
              key={item.path}
              onClick={() => onNodeClick(item.path)}
              onMouseEnter={() => setHoveredId(item.path)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                ${bgColor} ${borderColor} border rounded-xl p-4 cursor-pointer 
                transition-all duration-200 relative overflow-hidden flex flex-col justify-between
                ${isBig ? 'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.5rem)] min-h-[140px]' : 'w-[calc(25%-0.5rem)] sm:w-[calc(16.666%-0.5rem)] lg:w-[calc(12.5%-0.5rem)] min-h-[80px]'}
                ${hoveredId === item.path ? 'ring-2 ring-indigo-500 shadow-xl scale-[1.02] z-10' : 'shadow-sm'}
              `}
            >
              <div className="flex items-center gap-2 z-10 relative">
                <span className="text-2xl">{isFolder ? '📁' : '📄'}</span>
                <span className="font-semibold text-slate-200 text-sm truncate" title={item.path}>
                  {item.path.split('\\').pop()}
                </span>
              </div>
              
              <div className="mt-4 z-10 relative">
                <div className="text-xs font-mono text-slate-400">
                  {(item.size / 1024 / 1024).toFixed(1)} MB
                </div>
                {isBig && (
                  <div className="w-full bg-slate-900/50 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}