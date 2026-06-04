import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { supabase } from "../utils/supabaseClient";

export default function MindMapModal({ isOpen, onClose, reelId, reelData, onMindMapGenerated }) {
  const [mindMap, setMindMap] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  // New features state
  const [toast, setToast] = useState(null);
  const [showRegenDropdown, setShowRegenDropdown] = useState(false);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);

  const regenDropdownRef = useRef(null);
  const copyDropdownRef = useRef(null);

  // Viewport/Transform State
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Styling Themes: "dark" (glass), "neon", "light"
  const [theme, setTheme] = useState(() => {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  useEffect(() => {
    if (isOpen) {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    }
  }, [isOpen]);

  useEffect(() => {
    if (reelData && reelData.reel_metadata) {
      setMindMap(reelData.reel_metadata.mind_map || null);
    }
  }, [reelData]);

  // Handle outside click or Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle clicking outside of dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (regenDropdownRef.current && !regenDropdownRef.current.contains(e.target)) {
        setShowRegenDropdown(false);
      }
      if (copyDropdownRef.current && !copyDropdownRef.current.contains(e.target)) {
        setShowCopyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Convert SVG to PNG Blob helper
  const svgToPngBlob = (svgElement) => {
    return new Promise((resolve, reject) => {
      try {
        const clonedSvg = svgElement.cloneNode(true);
        clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        
        // Remove style tag transition to avoid scale anomalies in rendering
        const styleTag = clonedSvg.querySelector("style");
        if (styleTag) {
          styleTag.textContent = styleTag.textContent.replace(".node-group:hover", "");
        }

        const gEl = svgElement.querySelector("#mindmap-container-g");
        if (!gEl) {
          reject(new Error("Inner container graphics group not found"));
          return;
        }

        const bbox = gEl.getBBox();
        const padding = 100;
        
        const width = bbox.width + padding * 2;
        const height = bbox.height + padding * 2;

        // Reset transform on cloned group to prevent double translations/scale anomalies
        const clonedG = clonedSvg.querySelector("#mindmap-container-g");
        if (clonedG) {
          clonedG.setAttribute("transform", "translate(0, 0) scale(1)");
        }

        clonedSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
        clonedSvg.setAttribute("width", width);
        clonedSvg.setAttribute("height", height);

        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          
          // Draw background matching active theme
          ctx.fillStyle = theme === "light" ? "#fafafa" : (theme === "neon" ? "#020202" : "#060608");
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Canvas conversion to Blob failed"));
            }
          }, "image/png");
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });
  };

  if (!isOpen) return null;

  const handleGenerate = async (detailLevel = "moderate") => {
    const actualDetailLevel = (detailLevel && typeof detailLevel === "string") ? detailLevel : "moderate";
    setGenerating(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session found.");

      const res = await axios.post(`http://localhost:5000/api/reels/${reelId}/mindmap`, {
        detail_level: actualDetailLevel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMindMap(res.data);
      if (onMindMapGenerated) {
        onMindMapGenerated(res.data);
      }
      showToast(`Mind map successfully generated (${detailLevel})`);
    } catch (err) {
      console.error("Error generating mind map:", err);
      setError(err.response?.data?.error || err.message || "Failed to generate mind map.");
    } finally {
      setGenerating(false);
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    // Bounds check
    newZoom = Math.max(0.2, Math.min(newZoom, 3.0));
    setZoom(newZoom);
  };

  // Zoom control buttons
  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3.0));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.2));
  const resetView = () => {
    setZoom(0.85);
    setPan({ x: 0, y: 0 });
  };
  const fitView = () => {
    if (!mindMap) return;
    // Set fit-to-screen scale based on branch count
    const branchCount = mindMap.branches ? mindMap.branches.length : 1;
    const computedZoom = Math.max(0.5, 1.2 - (branchCount * 0.08));
    setZoom(computedZoom);
    setPan({ x: 0, y: 0 });
  };

  // Download SVG
  const downloadSVG = () => {
    const svgEl = document.getElementById("superbrain-mindmap-svg");
    if (!svgEl) return;
    
    // Clone SVG to modify properties for offline rendering
    const clonedSvg = svgEl.cloneNode(true);
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const gEl = svgEl.querySelector("#mindmap-container-g");
    if (gEl) {
      const bbox = gEl.getBBox();
      const padding = 100;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      // Reset transform on cloned group to prevent displacement in offline viewing
      const clonedG = clonedSvg.querySelector("#mindmap-container-g");
      if (clonedG) {
        clonedG.setAttribute("transform", "translate(0, 0) scale(1)");
      }

      clonedSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
      clonedSvg.setAttribute("width", width);
      clonedSvg.setAttribute("height", height);
    }
    
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `${(mindMap.title || "superbrain-mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  // Regenerate Mind Map with specific detail level
  const handleRegenerate = async (detailLevel) => {
    setShowRegenDropdown(false);
    setGenerating(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session found.");

      const res = await axios.post(`http://localhost:5000/api/reels/${reelId}/mindmap`, {
        detail_level: detailLevel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMindMap(res.data);
      if (onMindMapGenerated) {
        onMindMapGenerated(res.data);
      }
      showToast(`Mind map successfully regenerated (${detailLevel})`);
    } catch (err) {
      console.error("Error regenerating mind map:", err);
      setError(err.response?.data?.error || err.message || "Failed to regenerate mind map.");
    } finally {
      setGenerating(false);
    }
  };

  // Copy SVG String (Raw XML) to Clipboard
  const handleCopySVG = () => {
    setShowCopyDropdown(false);
    const svgEl = document.getElementById("superbrain-mindmap-svg");
    if (!svgEl) {
      showToast("SVG element not found", "error");
      return;
    }
    try {
      const clonedSvg = svgEl.cloneNode(true);
      clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const svgString = new XMLSerializer().serializeToString(clonedSvg);
      
      navigator.clipboard.writeText(svgString)
        .then(() => {
          showToast("SVG copied to clipboard");
        })
        .catch(err => {
          console.error("Failed to copy SVG:", err);
          showToast("Failed to copy SVG", "error");
        });
    } catch (err) {
      console.error(err);
      showToast("Failed to copy SVG", "error");
    }
  };

  // Copy as rasterized PNG image to Clipboard
  const handleCopyPNG = async () => {
    setShowCopyDropdown(false);
    const svgEl = document.getElementById("superbrain-mindmap-svg");
    if (!svgEl) {
      showToast("SVG element not found", "error");
      return;
    }
    
    showToast("Generating PNG...");
    try {
      const blob = await svgToPngBlob(svgEl);
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob
        })
      ]);
      showToast("PNG copied to clipboard");
    } catch (err) {
      console.error("Failed to copy PNG:", err);
      showToast("Failed to copy PNG", "error");
    }
  };

  const DX_BRANCH = 300;
  const DX_LEAF = 320;
  const VERTICAL_SPACING_LEAF = 95; // Increased from 75 to handle 13px font text without overlaps

  // Wrap text helper for SVG nodes
  const wrapText = (text, maxChars = 32) => {
    if (!text) return [];
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    words.forEach(word => {
      if ((currentLine + " " + word).trim().length <= maxChars) {
        currentLine = (currentLine + " " + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const renderMindMapContent = () => {
    if (!mindMap || !mindMap.branches) return null;

    const branches = mindMap.branches;
    const midIndex = Math.ceil(branches.length / 2);
    const leftBranches = branches.slice(0, midIndex);
    const rightBranches = branches.slice(midIndex);

    // Calculate Y coordinates for right branches
    const rightTotalLeaves = rightBranches.reduce((acc, b) => acc + (b.points ? b.points.length : 1), 0);
    const leftTotalLeaves = leftBranches.reduce((acc, b) => acc + (b.points ? b.points.length : 1), 0);

    // Dynamic vertical gaps based on leaf node sizes and increased spacing
    const rightHeight = Math.max(rightBranches.length * 160, rightTotalLeaves * VERTICAL_SPACING_LEAF);
    const leftHeight = Math.max(leftBranches.length * 160, leftTotalLeaves * VERTICAL_SPACING_LEAF);

    const rightNodes = [];
    const leftNodes = [];
    const paths = [];

    // Distinct theme colors for branches (e.g. Sky, Emerald, Amber, Orange, Rose)
    const branchColors = [
      { border: "#3b82f6", text: "#60a5fa", bg: "rgba(59, 130, 246, 0.08)", line: "#2563eb", neon: "rgba(59, 130, 246, 0.6)" },
      { border: "#10b981", text: "#34d399", bg: "rgba(16, 185, 129, 0.08)", line: "#059669", neon: "rgba(16, 185, 129, 0.6)" },
      { border: "#f59e0b", text: "#fbbf24", bg: "rgba(245, 158, 11, 0.08)", line: "#d97706", neon: "rgba(245, 158, 11, 0.6)" },
      { border: "#f97316", text: "#fb923c", bg: "rgba(249, 115, 22, 0.08)", line: "#ea580c", neon: "rgba(249, 115, 22, 0.6)" },
      { border: "#ec4899", text: "#f472b6", bg: "rgba(236, 72, 153, 0.08)", line: "#db2777", neon: "rgba(236, 72, 153, 0.6)" },
      { border: "#14b8a6", text: "#2dd4bf", bg: "rgba(20, 184, 166, 0.08)", line: "#0d9488", neon: "rgba(20, 184, 166, 0.6)" },
    ];

    // --- Lay out RIGHT Branches ---
    let currentRightY = -rightHeight / 2 + 50;
    rightBranches.forEach((branch, idx) => {
      const color = branchColors[idx % branchColors.length];
      const leafCount = branch.points ? branch.points.length : 0;
      const branchHeight = Math.max(140, leafCount * VERTICAL_SPACING_LEAF);
      
      const branchX = DX_BRANCH;
      const branchY = currentRightY + branchHeight / 2;

      rightNodes.push({
        type: "branch",
        name: branch.name,
        x: branchX,
        y: branchY,
        color,
        points: branch.points || []
      });

      // Connection Root -> Branch
      const pathD = `M 0 0 C ${DX_BRANCH / 2} 0, ${DX_BRANCH / 2} ${branchY}, ${branchX} ${branchY}`;
      paths.push({ d: pathD, color: color.line, neon: color.neon, isBranch: true });

      // Lay out points under this branch
      let currentLeafY = branchY - ((leafCount - 1) * VERTICAL_SPACING_LEAF) / 2;
      (branch.points || []).forEach((point) => {
        const leafX = branchX + DX_LEAF;
        const leafY = currentLeafY;

        rightNodes.push({
          type: "leaf",
          name: point,
          x: leafX,
          y: leafY,
          color,
          parentY: branchY
        });

        // Connection Branch -> Leaf
        const leafPathD = `M ${branchX} ${branchY} C ${branchX + DX_LEAF / 2} ${branchY}, ${branchX + DX_LEAF / 2} ${leafY}, ${leafX} ${leafY}`;
        paths.push({ d: leafPathD, color: color.line, neon: color.neon, isBranch: false });

        currentLeafY += VERTICAL_SPACING_LEAF;
      });

      currentRightY += branchHeight + 40;
    });

    // --- Lay out LEFT Branches ---
    let currentLeftY = -leftHeight / 2 + 50;
    leftBranches.forEach((branch, idx) => {
      // Pick colors from the end of the palette for contrast
      const color = branchColors[(branchColors.length - 1 - idx) % branchColors.length];
      const leafCount = branch.points ? branch.points.length : 0;
      const branchHeight = Math.max(140, leafCount * VERTICAL_SPACING_LEAF);
      
      const branchX = -DX_BRANCH;
      const branchY = currentLeftY + branchHeight / 2;

      leftNodes.push({
        type: "branch",
        name: branch.name,
        x: branchX,
        y: branchY,
        color,
        points: branch.points || []
      });

      // Connection Root -> Branch
      const pathD = `M 0 0 C ${-DX_BRANCH / 2} 0, ${-DX_BRANCH / 2} ${branchY}, ${branchX} ${branchY}`;
      paths.push({ d: pathD, color: color.line, neon: color.neon, isBranch: true });

      // Lay out points under this branch
      let currentLeafY = branchY - ((leafCount - 1) * VERTICAL_SPACING_LEAF) / 2;
      (branch.points || []).forEach((point) => {
        const leafX = branchX - DX_LEAF;
        const leafY = currentLeafY;

        leftNodes.push({
          type: "leaf",
          name: point,
          x: leafX,
          y: leafY,
          color,
          parentY: branchY
        });

        // Connection Branch -> Leaf
        const leafPathD = `M ${branchX} ${branchY} C ${branchX - DX_LEAF / 2} ${branchY}, ${branchX - DX_LEAF / 2} ${leafY}, ${leafX} ${leafY}`;
        paths.push({ d: leafPathD, color: color.line, neon: color.neon, isBranch: false });

        currentLeafY += VERTICAL_SPACING_LEAF;
      });

      currentLeftY += branchHeight + 40;
    });

    // Node & Path rendering configuration based on Theme
    const getPathStyle = (p) => {
      const strokeVal = p.gradientId ? `url(#${p.gradientId})` : p.color;
      if (theme === "neon") {
        return {
          stroke: strokeVal,
          strokeWidth: p.isBranch ? 3.5 : 2,
          fill: "none",
          filter: "url(#neon-glow-filter)",
          opacity: 0.95
        };
      } else if (theme === "light") {
        return {
          stroke: p.gradientId ? `url(#${p.gradientId})` : (p.isBranch ? "#64748b" : "#cbd5e1"),
          strokeWidth: p.isBranch ? 3 : 1.5,
          fill: "none",
          strokeDasharray: p.isBranch ? "none" : "3,3",
          opacity: 0.8
        };
      } else {
        // Dark theme: smooth glass color lines
        return {
          stroke: strokeVal,
          strokeWidth: p.isBranch ? 3 : 1.8,
          fill: "none",
          opacity: 0.75
        };
      }
    };

    return (
      <g>
        <defs>
          {/* Neon Glow Filter */}
          <filter id="neon-glow-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Gradients for Right Branches */}
          {rightBranches.map((branch, idx) => {
            const color = branchColors[idx % branchColors.length];
            const startColor = theme === "light" ? "#1e293b" : "#10b981"; // root stroke color
            return (
              <linearGradient id={`grad-right-${idx}`} key={`grad-right-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={startColor} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color.border} stopOpacity="1" />
              </linearGradient>
            );
          })}

          {/* Gradients for Left Branches */}
          {leftBranches.map((branch, idx) => {
            const color = branchColors[(branchColors.length - 1 - idx) % branchColors.length];
            const startColor = theme === "light" ? "#1e293b" : "#10b981"; // root stroke color
            return (
              <linearGradient id={`grad-left-${idx}`} key={`grad-left-${idx}`} x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor={startColor} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color.border} stopOpacity="1" />
              </linearGradient>
            );
          })}
        </defs>

        {/* 1. Connections (Paths) */}
        {paths.map((p, i) => (
          <path key={i} d={p.d} style={getPathStyle(p)} />
        ))}

        {/* 2. Left & Right Branch and Leaf Nodes */}
        {[...rightNodes, ...leftNodes].map((node, i) => {
          const isLeft = node.x < 0;

          if (node.type === "branch") {
            const nameLines = wrapText(node.name, 24);
            const width = 240;
            const height = Math.max(54, nameLines.length * 17 + 22);
            const rx = node.x - width / 2;
            const ry = node.y - height / 2;

            // Compute exact inline styles based on Theme to avoid external CSS dependencies
            const rectStyle = {
              fill: theme === "light" ? "#ffffff" : (theme === "neon" ? "#000000" : "#141414"),
              stroke: node.color.border,
              strokeWidth: theme === "neon" ? "2px" : "1.5px",
              rx: "12px",
              ry: "12px",
              filter: theme === "neon" ? "url(#neon-glow-filter)" : "none"
            };

            const textStyle = {
              fill: theme === "neon" ? node.color.text : (theme === "light" ? "#1e293b" : "#e5e5e5"),
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: "14px",
              fontWeight: "600",
              textAnchor: "middle",
              pointerEvents: "none",
              userSelect: "none"
            };

            // Accent bar on the side facing the center (x = 0)
            const showAccentLeft = !isLeft; // if node.x > 0 (right), accent bar on the left (rx + 2)
            const barX = showAccentLeft ? rx + 2 : rx + width - 7;
            const textX = showAccentLeft ? node.x + 4 : node.x - 4;

            return (
              <g key={`branch-${i}`} className="node-group" style={{ cursor: "pointer" }}>
                <rect
                  x={rx}
                  y={ry}
                  width={width}
                  height={height}
                  style={rectStyle}
                />
                {/* Premium Vertical Accent Bar */}
                <rect
                  x={barX}
                  y={ry + 4}
                  width="5"
                  height={height - 8}
                  style={{
                    fill: node.color.border,
                    rx: "2.5px",
                    ry: "2.5px"
                  }}
                />
                <text
                  x={textX}
                  y={node.y}
                  style={textStyle}
                >
                  {nameLines.map((line, idx) => (
                    <tspan
                      key={idx}
                      x={textX}
                      dy={idx === 0 ? `-${(nameLines.length - 1) * 8.5 - 5}px` : "17px"}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          } else {
            // Leaf points
            const leafLines = wrapText(node.name, 30);
            const width = 285;
            const height = Math.max(44, leafLines.length * 16 + 18);
            // Left branch leaf should expand to the left, Right branch leaf to the right.
            const rx = isLeft ? node.x - width : node.x;
            const ry = node.y - height / 2;

            const rectStyle = {
              fill: theme === "light" ? "#ffffff" : (theme === "neon" ? "#050505" : "#0d0d0d"),
              stroke: theme === "light" ? "#e2e8f0" : (theme === "neon" ? "#1f2937" : "#262626"),
              strokeWidth: "1px",
              rx: "8px",
              ry: "8px",
              boxShadow: theme === "light" ? "0 1px 2px rgba(0,0,0,0.02)" : "none"
            };

            const textStyle = {
              fill: theme === "light" ? "#475569" : (theme === "neon" ? "#d4d4d4" : "#a3a3a3"),
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: "13px",
              fontWeight: "450",
              textAnchor: "start",
              pointerEvents: "none",
              userSelect: "none"
            };

            // Anchor dot & text alignment
            const dotCX = rx + 14;
            const textX = rx + 24;

            return (
              <g key={`leaf-${i}`} className="node-group" style={{ cursor: "pointer" }}>
                <rect
                  x={rx}
                  y={ry}
                  width={width}
                  height={height}
                  style={rectStyle}
                />
                {/* Bullet Dot indicator matching branch color */}
                <circle
                  cx={dotCX}
                  cy={node.y}
                  r="3.5"
                  style={{
                    fill: node.color.border,
                    opacity: 0.85
                  }}
                />
                <text
                  x={textX}
                  y={node.y}
                  style={textStyle}
                >
                  {leafLines.map((line, idx) => (
                    <tspan
                      key={idx}
                      x={textX}
                      dy={idx === 0 ? `-${(leafLines.length - 1) * 8 - 4}px` : "16px"}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          }
        })}

        {/* 3. Central Root Node */}
        <g className="node-group" style={{ cursor: "pointer" }}>
          {/* Outer glowing double outline ring for Neon/Dark theme */}
          {theme !== "light" && (() => {
            const rootLines = wrapText(mindMap.title, 22);
            const rootWidth = 280;
            const rootHeight = Math.max(54, rootLines.length * 18 + 22);
            const rootRx = -rootWidth / 2;
            const rootRy = -rootHeight / 2;
            return (
              <rect
                x={rootRx - 10}
                y={rootRy - 10}
                width={rootWidth + 20}
                height={rootHeight + 20}
                fill="none"
                stroke={theme === "neon" ? "#00f2fe" : "#10b981"}
                strokeWidth="1.5"
                opacity="0.3"
                style={{
                  rx: `${(rootHeight + 20) / 2}px`,
                  ry: `${(rootHeight + 20) / 2}px`,
                  filter: "url(#neon-glow-filter)"
                }}
              />
            );
          })()}
          {(() => {
            const rootLines = wrapText(mindMap.title, 22);
            const rootWidth = 280;
            const rootHeight = Math.max(54, rootLines.length * 18 + 22);
            const rootRx = -rootWidth / 2;
            const rootRy = -rootHeight / 2;

            return (
              <>
                <rect
                  x={rootRx}
                  y={rootRy}
                  width={rootWidth}
                  height={rootHeight}
                  style={{
                    fill: theme === "light" ? "#1e293b" : "#0a0a0c",
                    stroke: theme === "neon" ? "#00f2fe" : (theme === "light" ? "#334155" : "#10b981"),
                    strokeWidth: theme === "neon" ? "3px" : "2px",
                    rx: `${rootHeight / 2}px`,
                    ry: `${rootHeight / 2}px`,
                    filter: theme === "neon" ? "url(#neon-glow-filter)" : "none"
                  }}
                />
                <text
                  x="0"
                  y="0"
                  style={{
                    fill: "#ffffff",
                    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: "15px",
                    fontWeight: "800",
                    letterSpacing: "0.06em",
                    textAnchor: "middle",
                    pointerEvents: "none",
                    userSelect: "none"
                  }}
                >
                  {rootLines.map((line, idx) => (
                    <tspan
                      key={idx}
                      x="0"
                      dy={idx === 0 ? `-${(rootLines.length - 1) * 9 - 5}px` : "18px"}
                    >
                      {line.toUpperCase()}
                    </tspan>
                  ))}
                </text>
              </>
            );
          })()}
        </g>
      </g>
    );
  };

  const getThemeBackground = () => {
    if (theme === "light") return "bg-[#fafafa]";
    if (theme === "neon") return "bg-[#020202]";
    return "bg-[#060608]";
  };

  const getThemeUI = () => {
    if (theme === "light") {
      return {
        cardBg: "bg-[#ffffff] border-neutral-200 text-neutral-800",
        headerBg: "bg-[#f8fafc] border-neutral-200",
        headerText: "text-neutral-900",
        headerSub: "text-neutral-500",
        selectBg: "bg-neutral-100/80 border-neutral-200 text-neutral-800",
        closeBtn: "text-neutral-500 hover:text-neutral-900 border-neutral-200 hover:border-neutral-300 bg-neutral-100/50",
        loadingText: "text-neutral-800",
        loadingSub: "text-neutral-400",
        emptyBg: "bg-neutral-50 border-neutral-200",
        emptyText: "text-neutral-800",
        emptySub: "text-neutral-500",
        controlBg: "bg-white/95 border-neutral-200 shadow-md",
        controlBtn: "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100",
        divider: "bg-neutral-200",
        downloadBtn: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200",
        dropdownBg: "bg-white border-neutral-200 shadow-lg text-neutral-800",
        dropdownHover: "hover:bg-neutral-50 text-neutral-800 hover:text-neutral-900",
        toastBg: "bg-white border-neutral-200 text-neutral-800 shadow-xl"
      };
    } else {
      return {
        cardBg: "bg-[#09090b] dark:bg-[#070708] border-neutral-800 text-neutral-100",
        headerBg: "bg-[#0c0c0e] border-neutral-800",
        headerText: "text-neutral-100",
        headerSub: "text-neutral-500",
        selectBg: "bg-neutral-900/50 border-neutral-800 text-neutral-200",
        closeBtn: "text-neutral-500 hover:text-neutral-200 border-neutral-800 hover:border-neutral-700 bg-neutral-900/40",
        loadingText: "text-neutral-200",
        loadingSub: "text-neutral-500",
        emptyBg: "bg-neutral-950/40 border-neutral-900",
        emptyText: "text-neutral-200",
        emptySub: "text-neutral-500",
        controlBg: "bg-[#0c0c0e]/95 border-neutral-800 shadow-lg",
        controlBtn: "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850",
        divider: "bg-neutral-800",
        downloadBtn: "text-emerald-400 hover:text-emerald-300 hover:bg-[#10b981]/5 border-emerald-500/20",
        dropdownBg: "bg-[#0e0e11] border-neutral-850 shadow-2xl text-neutral-200",
        dropdownHover: "hover:bg-neutral-900 text-neutral-100 hover:text-white",
        toastBg: "bg-[#0e0e11] border-neutral-800 text-neutral-100 shadow-2xl"
      };
    }
  };

  const ui = getThemeUI();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div className={`relative w-full h-full max-w-7xl border rounded-[4px] overflow-hidden flex flex-col shadow-2xl transition-all duration-300 ${ui.cardBg}`}>
        
        {/* Header Controls */}
        <header className={`flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4 transition-all duration-300 ${ui.headerBg}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-[3px] border border-emerald-500/20">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 10a6 6 0 00-6-6H4v16h8a6 6 0 006-6zM14 10h4m-4 4h4" />
              </svg>
            </div>
            <div>
              <h2 className={`text-sm font-semibold font-sans tracking-wide transition-all duration-300 ${ui.headerText}`}>AI CONCEPT MIND MAP</h2>
              <p className={`text-[10px] font-mono uppercase transition-all duration-300 ${ui.headerSub}`}>{reelData?.reel_metadata?.title || "Reel Visualizer"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Selector */}
            {mindMap && (
              <div className={`flex items-center gap-1.5 border px-2 py-1 rounded-[3px] transition-all duration-300 ${ui.selectBg}`}>
                <span className="text-[10px] font-mono text-neutral-500 select-none">THEME:</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  aria-label="Select Mind Map Theme"
                  className="bg-transparent border-none text-xs font-mono focus:outline-none cursor-pointer"
                >
                  <option value="dark" className={theme === "light" ? "bg-white text-neutral-800" : "bg-[#0c0c0e] text-neutral-200"}>Glassmorphism</option>
                  <option value="neon" className={theme === "light" ? "bg-white text-neutral-800" : "bg-[#0c0c0e] text-neutral-200"}>Neon Accent</option>
                  <option value="light" className={theme === "light" ? "bg-white text-neutral-800" : "bg-[#ffffff] text-neutral-800"}>Classic Light</option>
                </select>
              </div>
            )}

            {/* Regenerate Dropdown */}
            {mindMap && (
              <div className="relative" ref={regenDropdownRef}>
                <button
                  onClick={() => setShowRegenDropdown(!showRegenDropdown)}
                  disabled={generating}
                  className={`flex items-center justify-center p-2 border rounded-[3px] transition-all duration-300 ${
                    generating ? "opacity-50 cursor-not-allowed" : ""
                  } ${ui.selectBg}`}
                  title="Regenerate Mind Map"
                >
                  <svg
                    className={`w-4 h-4 text-emerald-400 ${generating ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>

                {showRegenDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 border rounded-[3px] shadow-xl z-50 flex flex-col p-1.5 transition-all ${ui.dropdownBg}`}>
                    <button
                      onClick={() => handleRegenerate("concise")}
                      className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-[2px] transition-colors w-full ${ui.dropdownHover}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16" />
                      </svg>
                      Conciseise
                    </button>
                    <button
                      onClick={() => handleRegenerate("moderate")}
                      className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-[2px] transition-colors w-full ${ui.dropdownHover}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                      </svg>
                      Moderate
                    </button>
                    <button
                      onClick={() => handleRegenerate("detailed")}
                      className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-[2px] transition-colors w-full ${ui.dropdownHover}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Detailed
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Close Modal */}
            <button
              onClick={onClose}
              className={`text-xs font-mono p-2 rounded-[3px] transition-all duration-300 ${ui.closeBtn}`}
              title="Close Mind Map"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Canvas Area */}
        <div 
          ref={containerRef}
          className={`flex-1 relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${getThemeBackground()} transition-colors duration-300`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
        >
          {generating ? (
            /* Loading State */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-4">
              <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-1.5">
                <p className={`text-sm font-semibold font-sans ${ui.loadingText}`}>SuperBrain AI structuring mind map...</p>
                <p className={`text-[10px] font-mono uppercase tracking-widest animate-pulse ${ui.loadingSub}`}>Running semantic decomposition</p>
              </div>
            </div>
          ) : error ? (
            /* Error State */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center">
              <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 p-8 rounded-[4px] shadow-xl">
                <p className="text-rose-500 font-mono text-xs mb-4">Error: {error}</p>
                <button
                  onClick={() => handleGenerate("moderate")}
                  className="text-xs font-mono bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-[3px]"
                >
                  Retry Generation
                </button>
              </div>
            </div>
          ) : !mindMap ? (
            /* Not Yet Generated Empty State */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className={`max-w-md border p-8 rounded-[4px] space-y-4 ${ui.emptyBg}`}>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className={`text-sm font-semibold ${ui.emptyText}`}>No Mind Map Found</h3>
                  <p className={`text-xs ${ui.emptySub}`}>Transform this curated post's takeaways and concepts into an interactive, visual structured map.</p>
                </div>
                <button
                  onClick={() => handleGenerate("moderate")}
                  className="w-full text-xs font-mono font-semibold bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-[3px] transition-colors"
                >
                  Generate Mind Map Instantly
                </button>
              </div>
            </div>
          ) : (
            /* Render Dynamic Mind Map SVG */
            <svg
              id="superbrain-mindmap-svg"
              width="100%"
              height="100%"
              className="w-full h-full"
              style={{ pointerEvents: "none" }}
            >
              <style>
                {`
                  .node-group {
                    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    transform-box: fill-box;
                    transform-origin: center;
                    pointer-events: auto;
                  }
                  .node-group:hover {
                    transform: scale(1.04);
                  }
                `}
              </style>

              {/* Grid Background */}
              {theme !== "light" ? (
                <defs>
                  <pattern id="mindmap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.015)" strokeWidth="1" />
                  </pattern>
                </defs>
              ) : (
                <defs>
                  <pattern id="mindmap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 0, 0, 0.018)" strokeWidth="1" />
                  </pattern>
                </defs>
              )}
              {/* Solid Background for Offline Sharing */}
              <rect
                x="-5000"
                y="-5000"
                width="10000"
                height="10000"
                fill={theme === "light" ? "#fafafa" : (theme === "neon" ? "#020202" : "#060608")}
              />
              <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#mindmap-grid)" />

              {/* Responsive container transformed by state */}
              <g id="mindmap-container-g" transform={`translate(${containerRef.current ? containerRef.current.clientWidth / 2 + pan.x : pan.x}, ${containerRef.current ? containerRef.current.clientHeight / 2 + pan.y : pan.y}) scale(${zoom})`}>
                {renderMindMapContent()}
              </g>
            </svg>
          )}

          {/* Floating Controls at bottom-right */}
          {mindMap && (
            <div className={`absolute bottom-6 right-6 flex items-center gap-2 p-2 rounded-[4px] border transition-all duration-300 ${ui.controlBg}`}>
              <button
                onClick={zoomOut}
                className={`text-xs font-mono p-1.5 rounded-[3px] transition-colors ${ui.controlBtn}`}
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={zoomIn}
                className={`text-xs font-mono p-1.5 rounded-[3px] transition-colors ${ui.controlBtn}`}
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <div className={`w-px h-4 ${ui.divider}`} />
              <button
                onClick={fitView}
                className={`text-xs font-mono px-2.5 py-1 rounded-[3px] transition-colors ${ui.controlBtn}`}
                title="Fit to Screen"
              >
                FIT
              </button>
              <button
                onClick={resetView}
                className={`text-xs font-mono px-2.5 py-1 rounded-[3px] transition-colors ${ui.controlBtn}`}
                title="Reset Scale"
              >
                RESET
              </button>
              <div className={`w-px h-4 ${ui.divider}`} />
              
              {/* Copy Dropdown Menu */}
              <div className="relative" ref={copyDropdownRef}>
                <button
                  onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                  className={`text-xs font-mono px-2.5 py-1 border rounded-[3px] transition-all flex items-center gap-1.5 ${ui.controlBtn} hover:border-emerald-500/30`}
                  title="Copy Mind Map"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-8.25M8.25 16.5V18" />
                  </svg>
                  COPY
                </button>

                {showCopyDropdown && (
                  <div className={`absolute right-0 bottom-full mb-2 w-48 border rounded-[3px] shadow-2xl z-50 flex flex-col p-1.5 transition-all ${ui.dropdownBg}`}>
                    <button
                      onClick={handleCopySVG}
                      className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-[2px] transition-colors w-full ${ui.dropdownHover}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                      </svg>
                      Copy SVG (Raw XML)
                    </button>
                    <button
                      onClick={handleCopyPNG}
                      className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-[2px] transition-colors w-full ${ui.dropdownHover}`}
                    >
                      <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      Copy as PNG
                    </button>
                  </div>
                )}
              </div>

              <div className={`w-px h-4 ${ui.divider}`} />
              <button
                onClick={downloadSVG}
                className={`text-xs font-mono px-2.5 py-1 border rounded-[3px] transition-all flex items-center gap-1 ${ui.downloadBtn}`}
                title="Download SVG Diagram"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                SVG
              </button>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
            <div className={`px-4 py-2 border rounded-full text-xs font-mono flex items-center gap-2 shadow-lg transition-all duration-300 ${
              toast.type === "error" ? "border-rose-500/30 text-rose-400 bg-rose-950/90" : "border-emerald-500/30 text-emerald-400 bg-emerald-950/90"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"}`} />
              {toast.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
