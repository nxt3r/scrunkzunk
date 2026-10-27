import { useEffect, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

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

function buildTree(entries: ScanEntry[], rootPath: string) {
  const root: any = { name: rootPath, path: rootPath, children: [], value: 0 };
  const map = new Map<string, any>();
  map.set(rootPath, root);

  const sorted = [...entries].sort((a, b) => a.path.length - b.path.length);

  sorted.forEach((entry) => {
    if (entry.path === rootPath) return;
    
    let relativePath = entry.path;
    if (relativePath.startsWith(rootPath)) {
      relativePath = relativePath.slice(rootPath.length);
    }
    
    const pathParts = relativePath.split("\\").filter(Boolean);
    if (pathParts.length === 0) return;

    let currentPath = rootPath;
    let parent = root;
    const limit = entry.is_dir ? pathParts.length : pathParts.length - 1;

    for (let i = 0; i < limit; i++) {
      currentPath += "\\" + pathParts[i];
      if (!map.has(currentPath)) {
        const newNode = { name: pathParts[i], path: currentPath, children: [], value: 0 };
        map.set(currentPath, newNode);
        parent.children.push(newNode);
      }
      parent = map.get(currentPath);
    }

    if (!entry.is_dir) {
      const fileNode = {
        name: pathParts[pathParts.length - 1],
        path: entry.path,
        value: entry.size,
      };
      parent.children.push(fileNode);
    }
  });

  function computeFolderSizes(node: any) {
    if (node.children && node.children.length > 0) {
      node.value = node.children.reduce((sum: number, child: any) => sum + computeFolderSizes(child), 0);
    }
    return node.value || 0;
  }
  
  computeFolderSizes(root);
  return root;
}

export function Treemap({ data, rootPath, onNodeClick }: TreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!data || data.length === 0) return <div style={{ color: "red", padding: 20 }}>No data.</div>;

  const treeData = buildTree(data, rootPath);
  if (treeData.value === 0) return <div style={{ color: "red", padding: 20 }}>Total size is 0.</div>;

  const root = hierarchy(treeData)
    .sum((d) => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  treemap().size([dimensions.width, dimensions.height]).paddingInner(1).paddingOuter(2).tile(treemapSquarify)(root);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", backgroundColor: "#1a1b26" }}>
      <svg width={dimensions.width} height={dimensions.height}>
        {root.descendants().map((node: any, i) => {
          if (node.depth !== 1) return null;
          if (node.x1 - node.x0 < 2 || node.y1 - node.y0 < 2) return null;

          let fill = "#4c566a"; 
          if (node.data.tier === "safe") fill = "#2e7d32";
          if (node.data.tier === "review") fill = "#e65100";
          if (node.data.tier === "blocked") fill = "#b71c1c";

          return (
            <g key={`node-${i}`} transform={`translate(${node.x0},${node.y0})`}>
              <rect
                width={node.x1 - node.x0}
                height={node.y1 - node.y0}
                fill={fill}
                stroke="#1a1b26"
                strokeWidth={2}
                style={{ cursor: "pointer" }}
                onClick={() => onNodeClick(node.data.path)}
              >
                <title>{node.data.path} ({(node.value! / 1024 / 1024).toFixed(1)} MB)</title>
              </rect>
              {(node.x1 - node.x0 > 40 && node.y1 - node.y0 > 30) && (
                <>
                  <text x={4} y={16} fill="#fff" fontSize={12} style={{ pointerEvents: "none", fontWeight: "bold" }}>
                    {node.data.name.length > 20 ? node.data.name.slice(0, 20) + "..." : node.data.name}
                  </text>
                  <text x={4} y={32} fill="#ccc" fontSize={11} style={{ pointerEvents: "none" }}>
                    {(node.value / 1024 / 1024).toFixed(1)} MB
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}