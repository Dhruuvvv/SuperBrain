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
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

  const regenDropdownRef = useRef(null);
  const copyDropdownRef = useRef(null);
  const downloadDropdownRef = useRef(null);

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
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target)) {
        setShowDownloadDropdown(false);
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

  // Convert SVG to PNG Blob helper (with high-res scaleFactor support)
  const svgToPngBlob = (svgElement, scaleFactor = 3) => {
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
        clonedSvg.setAttribute("width", width * scaleFactor);
        clonedSvg.setAttribute("height", height * scaleFactor);

        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width * scaleFactor;
          canvas.height = height * scaleFactor;
          const ctx = canvas.getContext("2d");
          
          // Draw background matching active theme
          ctx.fillStyle = theme === "light" ? "#FAF9F5" : (theme === "neon" ? "#050505" : "#0A0B0E");
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

    // Count total leaves across all branches
    const totalLeaves = mindMap.branches.reduce((acc, b) => {
      if (Array.isArray(b.subBranches) && b.subBranches.length > 0) {
        return acc + b.subBranches.reduce((s, sb) => s + (sb.points?.length || 1), 0);
      }
      return acc + (b.points?.length || 1);
    }, 0);

    const branchCount = mindMap.branches?.length || 1;

    // Factor in both branch count AND total leaf count
    const verticalFactor = Math.max(0.2, 0.85 - totalLeaves * 0.012);
    const horizontalFactor = Math.max(0.2, 1.1 - branchCount * 0.05);
    const computedZoom = Math.min(verticalFactor, horizontalFactor);

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

  // Download PNG (High-resolution 3x density export)
  const downloadPNG = async () => {
    const svgEl = document.getElementById("superbrain-mindmap-svg");
    if (!svgEl) return;
    
    showToast("Generating high-res PNG...");
    try {
      const blob = await svgToPngBlob(svgEl, 3); // 3x density for print-ready 300dpi sharp quality
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `${(mindMap.title || "superbrain-mindmap").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      showToast("PNG downloaded successfully");
    } catch (err) {
      console.error("Failed to download PNG:", err);
      showToast("Failed to download PNG", "error");
    }
  };

  // Download PDF (Vector landscape layout via native printing)
  const downloadPDF = () => {
    const svgEl = document.getElementById("superbrain-mindmap-svg");
    if (!svgEl) return;

    // Clone SVG to modify properties for print layout
    const clonedSvg = svgEl.cloneNode(true);
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const gEl = svgEl.querySelector("#mindmap-container-g");
    if (gEl) {
      const bbox = gEl.getBBox();
      const padding = 100;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      // Reset transform on cloned group
      const clonedG = clonedSvg.querySelector("#mindmap-container-g");
      if (clonedG) {
        clonedG.setAttribute("transform", "translate(0, 0) scale(1)");
      }

      clonedSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
      clonedSvg.setAttribute("width", "100%");
      clonedSvg.setAttribute("height", "100%");
    }

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Pop-up blocked. Please allow pop-ups to export PDF.", "error");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${mindMap.title || "SuperBrain Mind Map"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
            body {
              margin: 0;
              padding: 0;
              background: ${theme === "light" ? "#FAF9F5" : (theme === "neon" ? "#050505" : "#0A0B0E")};
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100vw;
              height: 100vh;
              overflow: hidden;
            }
            svg {
              width: 100%;
              height: 100%;
              max-width: 100%;
              max-height: 100%;
            }
            @media print {
              body {
                background: ${theme === "light" ? "#FAF9F5" : (theme === "neon" ? "#050505" : "#0A0B0E")};
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: landscape;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          ${svgString}
          <script>
            // Wait for fonts and styles to resolve, print, then close window
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  const countLeaves = (branchesList) => {
    if (!Array.isArray(branchesList)) return 0;
    return branchesList.reduce((acc, b) => {
      if (Array.isArray(b.subBranches) && b.subBranches.length > 0) {
        return acc + b.subBranches.reduce((s, sb) => s + (sb.points?.length || 1), 0);
      }
      return acc + (b.points?.length || 1);
    }, 0);
  };

  const totalLeafCount = mindMap ? countLeaves(mindMap.branches) : 10;
  const DX_BRANCH = 280;
  const DX_LEAF = Math.min(320, 200 + Math.max(0, totalLeafCount - 10) * 3); // scales with content
  const VERTICAL_SPACING_LEAF = Math.max(60, Math.min(85, 800 / Math.max(totalLeafCount, 10))); // shrinks as leaves grow

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

    // Helper to count leaves supporting both new subBranches schema and legacy points schema
    const countLeaves = (branchesArr) => branchesArr.reduce((acc, b) => {
      if (Array.isArray(b.subBranches) && b.subBranches.length > 0) {
        return acc + b.subBranches.reduce((subAcc, sb) => subAcc + (sb.points ? sb.points.length : 1), 0);
      }
      return acc + (b.points ? b.points.length : 1);
    }, 0);

    const rightTotalLeaves = countLeaves(rightBranches);
    const leftTotalLeaves = countLeaves(leftBranches);

    // Dynamic vertical gaps based on leaf node sizes and increased spacing
    const rightHeight = Math.max(rightBranches.length * 160, rightTotalLeaves * VERTICAL_SPACING_LEAF);
    const leftHeight = Math.max(leftBranches.length * 160, leftTotalLeaves * VERTICAL_SPACING_LEAF);

    const rightNodes = [];
    const leftNodes = [];
    const paths = [];

    // High-end ultra-minimal aesthetic colors based on the theme
    const getBranchColors = () => {
      if (theme === "neon") {
        // Aesthetic Minimal (purely monochromatic with subtle contrast)
        return Array(6).fill({
          border: "#3f3f46", text: "#f4f4f5", bg: "rgba(63, 63, 70, 0.08)", line: "#27272a", neon: "rgba(63, 63, 70, 0.4)"
        });
      } else if (theme === "light") {
        // Soft Structuralism (muted stone and clay tones)
        return [
          { border: "#a8a29e", text: "#44403c", bg: "rgba(168, 162, 158, 0.08)", line: "#78716c", neon: "none" },
          { border: "#9ca3af", text: "#374151", bg: "rgba(156, 163, 175, 0.08)", line: "#4b5563", neon: "none" },
          { border: "#b45309", text: "#78350f", bg: "rgba(180, 83, 9, 0.05)", line: "#92400e", neon: "none" },
          { border: "#737373", text: "#404040", bg: "rgba(115, 115, 115, 0.08)", line: "#525252", neon: "none" },
          { border: "#a8a29e", text: "#44403c", bg: "rgba(168, 162, 158, 0.08)", line: "#78716c", neon: "none" },
          { border: "#9ca3af", text: "#374151", bg: "rgba(156, 163, 175, 0.08)", line: "#4b5563", neon: "none" },
        ];
      } else {
        // Ethereal Obsidian (vivid cyber-nature colors)
        return [
          { border: "#10B981", text: "#E6F4EA", bg: "rgba(16, 185, 129, 0.04)", line: "#059669", neon: "rgba(16, 185, 129, 0.2)" },
          { border: "#6366F1", text: "#EEF2FF", bg: "rgba(99, 102, 241, 0.04)", line: "#4F46E5", neon: "rgba(99, 102, 241, 0.2)" },
          { border: "#F59E0B", text: "#FEF3C7", bg: "rgba(245, 158, 11, 0.04)", line: "#D97706", neon: "rgba(245, 158, 11, 0.2)" },
          { border: "#06B6D4", text: "#ECFEFF", bg: "rgba(6, 182, 212, 0.04)", line: "#0891B2", neon: "rgba(6, 182, 212, 0.2)" },
          { border: "#A855F7", text: "#FAF5FF", bg: "rgba(168, 85, 247, 0.04)", line: "#9333EA", neon: "rgba(168, 85, 247, 0.2)" },
          { border: "#F43F5E", text: "#FFF1F2", bg: "rgba(244, 63, 94, 0.04)", line: "#E11D48", neon: "rgba(244, 63, 94, 0.2)" }
        ];
      }
    };
    
    const branchColors = getBranchColors();

    // --- Lay out RIGHT Branches ---
    let currentRightY = -rightHeight / 2 + 50;
    rightBranches.forEach((branch, idx) => {
      const color = branchColors[idx % branchColors.length];
      let hasSubBranches = Array.isArray(branch.subBranches) && branch.subBranches.length > 0;
      let leafCount = 0;

      if (hasSubBranches) {
        leafCount = branch.subBranches.reduce((acc, sb) => acc + (sb.points ? sb.points.length : 1), 0);
      } else {
        leafCount = branch.points ? branch.points.length : 0;
      }

      const branchHeight = Math.max(140, leafCount * VERTICAL_SPACING_LEAF);
      const branchX = DX_BRANCH;
      const branchY = currentRightY + branchHeight / 2;

      rightNodes.push({
        type: "branch",
        name: branch.name,
        x: branchX,
        y: branchY,
        color
      });

      // Connection Root -> Branch
      const pathD = `M 0 0 C ${DX_BRANCH / 2} 0, ${DX_BRANCH / 2} ${branchY}, ${branchX} ${branchY}`;
      paths.push({ d: pathD, color: color.line, neon: color.neon, isBranch: true });

      let currentLeafY = branchY - ((leafCount - 1) * VERTICAL_SPACING_LEAF) / 2;

      if (hasSubBranches) {
        branch.subBranches.forEach(sub => {
          const subPointsCount = sub.points ? sub.points.length : 1;
          const subBranchHeight = Math.max(40, subPointsCount * VERTICAL_SPACING_LEAF);
          const subBranchY = currentLeafY + (subBranchHeight / 2) - (VERTICAL_SPACING_LEAF / 2);
          
          const subX = branchX + 220; // DX for subbranch
          
          rightNodes.push({
            type: "subBranch",
            name: sub.name || "Details",
            x: subX,
            y: subBranchY,
            color,
            parentY: branchY
          });

          // Connection Branch -> SubBranch
          const subPathD = `M ${branchX} ${branchY} C ${branchX + 110} ${branchY}, ${branchX + 110} ${subBranchY}, ${subX} ${subBranchY}`;
          paths.push({ d: subPathD, color: color.line, neon: color.neon, isBranch: false });

          // Leaves for this subBranch
          (sub.points || []).forEach(point => {
             const leafX = subX + DX_LEAF;
             const leafY = currentLeafY;
             rightNodes.push({
               type: "leaf",
               name: point,
               x: leafX,
               y: leafY,
               color,
               parentY: subBranchY
             });
             // Connection SubBranch -> Leaf
             const leafPathD = `M ${subX} ${subBranchY} C ${subX + DX_LEAF / 2} ${subBranchY}, ${subX + DX_LEAF / 2} ${leafY}, ${leafX} ${leafY}`;
             paths.push({ d: leafPathD, color: color.line, neon: color.neon, isBranch: false });
             
             currentLeafY += VERTICAL_SPACING_LEAF;
          });
        });
      } else {
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
      }

      currentRightY += branchHeight + 40;
    });

    // --- Lay out LEFT Branches ---
    let currentLeftY = -leftHeight / 2 + 50;
    leftBranches.forEach((branch, idx) => {
      const color = branchColors[(branchColors.length - 1 - idx) % branchColors.length];
      let hasSubBranches = Array.isArray(branch.subBranches) && branch.subBranches.length > 0;
      let leafCount = 0;

      if (hasSubBranches) {
        leafCount = branch.subBranches.reduce((acc, sb) => acc + (sb.points ? sb.points.length : 1), 0);
      } else {
        leafCount = branch.points ? branch.points.length : 0;
      }
      
      const branchHeight = Math.max(140, leafCount * VERTICAL_SPACING_LEAF);
      const branchX = -DX_BRANCH;
      const branchY = currentLeftY + branchHeight / 2;

      leftNodes.push({
        type: "branch",
        name: branch.name,
        x: branchX,
        y: branchY,
        color
      });

      // Connection Root -> Branch
      const pathD = `M 0 0 C ${-DX_BRANCH / 2} 0, ${-DX_BRANCH / 2} ${branchY}, ${branchX} ${branchY}`;
      paths.push({ d: pathD, color: color.line, neon: color.neon, isBranch: true });

      let currentLeafY = branchY - ((leafCount - 1) * VERTICAL_SPACING_LEAF) / 2;

      if (hasSubBranches) {
        branch.subBranches.forEach(sub => {
          const subPointsCount = sub.points ? sub.points.length : 1;
          const subBranchHeight = Math.max(40, subPointsCount * VERTICAL_SPACING_LEAF);
          const subBranchY = currentLeafY + (subBranchHeight / 2) - (VERTICAL_SPACING_LEAF / 2);
          
          const subX = branchX - 220; // DX for subbranch
          
          leftNodes.push({
            type: "subBranch",
            name: sub.name || "Details",
            x: subX,
            y: subBranchY,
            color,
            parentY: branchY
          });

          // Connection Branch -> SubBranch
          const subPathD = `M ${branchX} ${branchY} C ${branchX - 110} ${branchY}, ${branchX - 110} ${subBranchY}, ${subX} ${subBranchY}`;
          paths.push({ d: subPathD, color: color.line, neon: color.neon, isBranch: false });

          // Leaves for this subBranch
          (sub.points || []).forEach(point => {
             const leafX = subX - DX_LEAF;
             const leafY = currentLeafY;
             leftNodes.push({
               type: "leaf",
               name: point,
               x: leafX,
               y: leafY,
               color,
               parentY: subBranchY
             });
             // Connection SubBranch -> Leaf
             const leafPathD = `M ${subX} ${subBranchY} C ${subX - DX_LEAF / 2} ${subBranchY}, ${subX - DX_LEAF / 2} ${leafY}, ${leafX} ${leafY}`;
             paths.push({ d: leafPathD, color: color.line, neon: color.neon, isBranch: false });
             
             currentLeafY += VERTICAL_SPACING_LEAF;
          });
        });
      } else {
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
      }

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

          {/* Radial Mesh Gradients for background orbs */}
          {theme !== "light" && (
            <>
              <radialGradient id="orb-left" cx="20%" cy="40%" r="60%">
                <stop offset="0%" stopColor={theme === "neon" ? "#27272a" : "#10b981"} stopOpacity={theme === "neon" ? "0.08" : "0.12"} />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="orb-right" cx="80%" cy="60%" r="60%">
                <stop offset="0%" stopColor={theme === "neon" ? "#18181b" : "#6366f1"} stopOpacity={theme === "neon" ? "0.05" : "0.10"} />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </>
          )}

          {/* Gradients for Right Branches */}
          {rightBranches.map((branch, idx) => {
            const color = branchColors[idx % branchColors.length];
            const startColor = theme === "light" ? "#2C2C2A" : (theme === "neon" ? "#3f3f46" : "#6366F1");
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
            const startColor = theme === "light" ? "#2C2C2A" : (theme === "neon" ? "#3f3f46" : "#6366F1");
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
          <React.Fragment key={i}>
            {/* Base line */}
            <path d={p.d} style={getPathStyle(p)} />
            
            {/* Animated Flow Light Beam (Neon & Dark themes only) */}
            {theme !== "light" && (
              <path
                d={p.d}
                style={{
                  stroke: p.gradientId ? `url(#${p.gradientId})` : p.color,
                  strokeWidth: p.isBranch ? 3.5 : 2,
                  fill: "none",
                  strokeDasharray: p.isBranch ? "30, 150" : "15, 60",
                  strokeDashoffset: 0,
                  animation: `mindmap-flow ${p.isBranch ? "4s" : "2.5s"} linear infinite`,
                  opacity: 0.85,
                  filter: theme === "neon" ? "url(#neon-glow-filter)" : "none"
                }}
              />
            )}
          </React.Fragment>
        ))}

        {/* 2. Left & Right Branch and Leaf Nodes */}
        {[...rightNodes, ...leftNodes].map((node, i) => {
          const isLeft = node.x < 0;

          if (node.type === "branch") {
            const nameLines = wrapText(node.name, 20);
            const width = 220;
            const height = Math.max(60, nameLines.length * 20 + 26);
            const rx = node.x - width / 2;
            const ry = node.y - height / 2;

            // Compute exact inline styles based on Theme to avoid external CSS dependencies
            const rectStyle = {
              fill: theme === "light" ? "#ffffff" : (theme === "neon" ? "#000000" : "#141414"),
              stroke: node.color.border,
              strokeWidth: theme === "neon" ? "2.5px" : "2px",
              rx: "12px",
              ry: "12px",
              filter: theme === "neon" ? "url(#neon-glow-filter)" : "none"
            };

            const textStyle = {
              fill: theme === "neon" ? node.color.text : (theme === "light" ? "#1e293b" : "#e5e5e5"),
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: "700",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              textAnchor: "middle",
              pointerEvents: "none",
              userSelect: "none",
              textRendering: "geometricPrecision"
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
                      dy={idx === 0 ? `-${(nameLines.length - 1) * 9.5 - 5}px` : "19px"}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          } else if (node.type === "subBranch") {
            const nameLines = wrapText(node.name, 22);
            const width = 160;
            const height = Math.max(40, nameLines.length * 17 + 20);
            const rx = isLeft ? node.x - width : node.x;
            const ry = node.y - height / 2;

            const rectStyle = {
              fill: theme === "light" ? "#FDFBF7" : (theme === "neon" ? "#050505" : "#0F1115"),
              stroke: node.color.border,
              strokeWidth: "1px",
              rx: "8px",
              ry: "8px",
            };

            const textStyle = {
              fill: theme === "light" ? "#2C2C2A" : (theme === "neon" ? "#A3A3A3" : "#A1A1AA"),
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textAnchor: "middle",
              pointerEvents: "none",
              userSelect: "none",
              textRendering: "geometricPrecision"
            };

            const textX = rx + width / 2;

            return (
              <g key={`subbranch-${i}`} className="node-group" style={{ cursor: "pointer" }}>
                <rect x={rx} y={ry} width={width} height={height} style={rectStyle} />
                <text x={textX} y={node.y} style={textStyle}>
                  {nameLines.map((line, idx) => (
                    <tspan key={idx} x={textX} dy={idx === 0 ? `-${(nameLines.length - 1) * 8.5 - 4}px` : "17px"}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          } else {
            // Leaf points
            const leafLines = wrapText(node.name, 32);
            const width = 280;
            const height = Math.max(48, leafLines.length * 18 + 22);
            // Left branch leaf should expand to the left, Right branch leaf to the right.
            const rx = isLeft ? node.x - width : node.x;
            const ry = node.y - height / 2;

            const rectStyle = {
              fill: theme === "light" ? "#FFFFFF" : (theme === "neon" ? "#0A0A0A" : "#0A0B0E"),
              stroke: theme === "light" ? "#E8E6E1" : (theme === "neon" ? "#1A1A1A" : "#1E2028"),
              strokeWidth: "1px",
              rx: "8px",
              ry: "8px",
              boxShadow: theme === "light" ? "0 2px 4px rgba(0,0,0,0.02)" : "none"
            };

            const textStyle = {
              fill: theme === "light" ? "#44403C" : (theme === "neon" ? "#D4D4D8" : "#E4E4E7"),
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: "500",
              textAnchor: "start",
              pointerEvents: "none",
              userSelect: "none",
              textRendering: "geometricPrecision"
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
                      dy={idx === 0 ? `-${(leafLines.length - 1) * 9 - 4}px` : "18px"}
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
            const rootLines = wrapText(mindMap.title, 18);
            const rootWidth = 320;
            const rootHeight = Math.max(68, rootLines.length * 24 + 26);
            const rootRx = -rootWidth / 2;
            const rootRy = -rootHeight / 2;
            return (
              <rect
                x={rootRx - 10}
                y={rootRy - 10}
                width={rootWidth + 20}
                height={rootHeight + 20}
                fill="none"
                stroke={theme === "neon" ? "#3f3f46" : "#71717a"}
                strokeWidth="1.5"
                opacity="0.3"
                style={{
                  rx: `${(rootHeight + 20) / 2}px`,
                  ry: `${(rootHeight + 20) / 2}px`,
                  filter: theme === "neon" ? "none" : "url(#neon-glow-filter)"
                }}
              />
            );
          })()}
          {(() => {
            const rootLines = wrapText(mindMap.title, 18);
            const rootWidth = 320;
            const rootHeight = Math.max(68, rootLines.length * 24 + 26);
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
                    fill: theme === "light" ? "#2C2C2A" : (theme === "neon" ? "#0A0A0A" : "#181A20"),
                    stroke: theme === "light" ? "#D1CFCA" : (theme === "neon" ? "#262626" : "#3F3F46"),
                    strokeWidth: "2px",
                    rx: `${rootHeight / 2}px`,
                    ry: `${rootHeight / 2}px`,
                    filter: theme === "neon" ? "none" : "none"
                  }}
                />
                <text
                  x="0"
                  y="0"
                  style={{
                    fill: "#ffffff",
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: "25px",
                    fontStyle: "italic",
                    fontWeight: "normal",
                    letterSpacing: "-0.01em",
                    textAnchor: "middle",
                    pointerEvents: "none",
                    userSelect: "none",
                    textRendering: "geometricPrecision"
                  }}
                >
                  {rootLines.map((line, idx) => (
                    <tspan
                      key={idx}
                      x="0"
                      dy={idx === 0 ? `${-((rootLines.length - 1) * 12 - 6)}px` : "24px"}
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
    if (theme === "light") return "bg-[#F5F3ED]";
    if (theme === "neon") return "bg-[#050505]";
    return "bg-[#0A0B0E]";
  };

  const getThemeUI = () => {
    if (theme === "light") {
      // Soft Structuralism
      return {
        cardBg: "bg-[#FDFBF7] border-[#E8E6E1] text-[#2C2C2A]",
        headerBg: "bg-[#F5F3ED] border-b border-[#E8E6E1]",
        headerText: "text-[#2C2C2A]",
        headerSub: "text-[#8B8985]",
        selectBg: "bg-[#FDFBF7] border-[#E8E6E1] text-[#2C2C2A]",
        closeBtn: "text-[#8B8985] hover:text-[#2C2C2A] border-[#E8E6E1] hover:border-[#D1CFCA] bg-[#F5F3ED]/50",
        loadingText: "text-[#2C2C2A]",
        loadingSub: "text-[#8B8985]",
        emptyBg: "bg-[#F5F3ED]/80 border-[#E8E6E1]",
        emptyText: "text-[#2C2C2A]",
        emptySub: "text-[#8B8985]",
        controlBg: "bg-[#FDFBF7]/95 border-[#E8E6E1] shadow-xl shadow-black/5",
        controlBtn: "text-[#8B8985] hover:text-[#2C2C2A] hover:bg-[#F5F3ED]",
        divider: "bg-[#E8E6E1]",
        downloadBtn: "text-[#2C2C2A] hover:text-black hover:bg-[#E8E6E1]/50 border-[#E8E6E1]",
        dropdownBg: "bg-[#FDFBF7] border-[#E8E6E1] shadow-2xl text-[#2C2C2A]",
        dropdownHover: "hover:bg-[#F5F3ED] text-[#2C2C2A] hover:text-black",
        toastBg: "bg-[#FDFBF7] border-[#E8E6E1] text-[#2C2C2A] shadow-xl shadow-black/5"
      };
    } else if (theme === "neon") {
      // Aesthetic Minimal
      return {
        cardBg: "bg-[#050505] border-[#1A1A1A] text-[#FAFAFA]",
        headerBg: "bg-[#0A0A0A] border-b border-[#1A1A1A]",
        headerText: "text-[#FAFAFA]",
        headerSub: "text-[#737373]",
        selectBg: "bg-[#050505] border-[#1A1A1A] text-[#FAFAFA]",
        closeBtn: "text-[#737373] hover:text-[#FAFAFA] border-[#1A1A1A] hover:border-[#333] bg-[#0A0A0A]/60",
        loadingText: "text-[#FAFAFA]",
        loadingSub: "text-[#737373]",
        emptyBg: "bg-[#0A0A0A]/80 border-[#1A1A1A]",
        emptyText: "text-[#FAFAFA]",
        emptySub: "text-[#737373]",
        controlBg: "bg-[#0A0A0A]/95 border-[#1A1A1A] shadow-2xl shadow-black",
        controlBtn: "text-[#737373] hover:text-[#FAFAFA] hover:bg-[#1A1A1A]",
        divider: "bg-[#1A1A1A]",
        downloadBtn: "text-[#FAFAFA] hover:text-white hover:bg-[#1A1A1A] border-[#333]",
        dropdownBg: "bg-[#050505] border-[#1A1A1A] shadow-2xl text-[#FAFAFA]",
        dropdownHover: "hover:bg-[#1A1A1A] text-[#FAFAFA] hover:text-white",
        toastBg: "bg-[#050505] border-[#1A1A1A] text-[#FAFAFA] shadow-2xl shadow-black"
      };
    } else {
      // Ethereal Obsidian
      return {
        cardBg: "bg-[#0A0B0E] border-[#1E2028] text-[#E4E4E7]",
        headerBg: "bg-[#0F1115] border-b border-[#1E2028]",
        headerText: "text-[#E4E4E7]",
        headerSub: "text-[#71717A]",
        selectBg: "bg-[#0A0B0E] border-[#1E2028] text-[#E4E4E7]",
        closeBtn: "text-[#71717A] hover:text-[#E4E4E7] border-[#1E2028] hover:border-[#3F3F46] bg-[#0F1115]/60",
        loadingText: "text-[#E4E4E7]",
        loadingSub: "text-[#71717A]",
        emptyBg: "bg-[#0F1115]/80 border-[#1E2028]",
        emptyText: "text-[#E4E4E7]",
        emptySub: "text-[#71717A]",
        controlBg: "bg-[#0F1115]/95 border-[#1E2028] shadow-2xl",
        controlBtn: "text-[#71717A] hover:text-[#E4E4E7] hover:bg-[#1E2028]",
        divider: "bg-[#1E2028]",
        downloadBtn: "text-[#E4E4E7] hover:text-white hover:bg-[#1E2028] border-[#3F3F46]",
        dropdownBg: "bg-[#0A0B0E] border-[#1E2028] shadow-2xl text-[#E4E4E7]",
        dropdownHover: "hover:bg-[#1E2028] text-[#E4E4E7] hover:text-white",
        toastBg: "bg-[#0A0B0E] border-[#1E2028] text-[#E4E4E7] shadow-2xl"
      };
    }
  };

  const ui = getThemeUI();

  const getOuterBezelStyle = () => {
    if (theme === "light") {
      return "bg-[#FAF9F5]/70 border-[#E8E6E1]/80";
    } else if (theme === "neon") {
      return "bg-[#0A0A0A]/70 border-[#1A1A1A]/80";
    } else {
      return "bg-[#0D0E12]/70 border-[#1E2028]/80";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 md:p-8 animate-fade-in">
      {/* Outer Shell (Double-Bezel) */}
      <div className={`relative w-full h-full max-w-7xl p-1.5 border rounded-[2rem] shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] backdrop-blur-xl ${getOuterBezelStyle()}`}>
        
        {/* Inner Core (Concentric rounded corner) */}
        <div className={`relative w-full h-full rounded-[calc(2rem-0.375rem)] border overflow-hidden flex flex-col transition-all duration-300 ${ui.cardBg}`}>
          
          {/* Film Grain Texture overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.012] bg-[url('data:image/svg+xml;utf8,<svg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22><filter id=%22noise%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/></svg>')] bg-repeat" />
          
          {/* Header Controls */}
          <header className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 relative z-10 transition-all duration-300 ${ui.headerBg}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 10a6 6 0 00-6-6H4v16h8a6 6 0 006-6zM14 10h4m-4 4h4" />
                </svg>
              </div>
              <div>
                <h2 className={`font-heading italic font-normal text-xl tracking-[-0.03em] transition-all duration-300 ${ui.headerText}`}>AI Concept Mind Map</h2>
                <p className={`text-[9px] font-mono uppercase tracking-[0.2em] transition-all duration-300 ${ui.headerSub}`}>{reelData?.reel_metadata?.title || "Reel Visualizer"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Selector */}
              {mindMap && (
                <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full transition-all duration-300 ${ui.selectBg}`}>
                  <span className="text-[10px] font-mono text-neutral-500 select-none">THEME:</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    aria-label="Select Mind Map Theme"
                    className="bg-transparent border-none text-xs font-mono focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="dark" className={theme === "light" ? "bg-white text-[#2C2C2A]" : "bg-[#0c0c0e] text-[#E4E4E7]"}>Ethereal Obsidian</option>
                    <option value="neon" className={theme === "light" ? "bg-white text-[#2C2C2A]" : "bg-[#050505] text-[#FAFAFA]"}>Aesthetic Minimal</option>
                    <option value="light" className={theme === "light" ? "bg-[#FDFBF7] text-[#2C2C2A]" : "bg-[#0c0c0e] text-[#E4E4E7]"}>Soft Structuralism</option>
                  </select>
                </div>
              )}

              {/* Regenerate Dropdown */}
              {mindMap && (
                <div className="relative" ref={regenDropdownRef}>
                  <button
                    onClick={() => setShowRegenDropdown(!showRegenDropdown)}
                    disabled={generating}
                    className={`flex items-center justify-center size-9 border rounded-full transition-all duration-300 hover:scale-105 active:scale-[0.95] ${
                      generating ? "opacity-50 cursor-not-allowed" : ""
                    } ${ui.selectBg}`}
                    title="Regenerate Mind Map"
                  >
                    <svg
                      className={`w-4 h-4 text-emerald-400 ${generating ? "animate-spin" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>

                  {showRegenDropdown && (
                    <div className={`absolute right-0 mt-2 w-48 border rounded-2xl shadow-xl z-50 flex flex-col p-1.5 transition-all ${ui.dropdownBg}`}>
                      <button
                        onClick={() => handleRegenerate("concise")}
                        className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                      >
                        <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16" />
                        </svg>
                        Concise
                      </button>
                      <button
                        onClick={() => handleRegenerate("moderate")}
                        className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                      >
                        <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                        </svg>
                        Moderate
                      </button>
                      <button
                        onClick={() => handleRegenerate("detailed")}
                        className={`flex items-center px-3 py-2 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                      >
                        <svg className="w-3.5 h-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
                className={`size-9 border rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-[0.95] ${ui.closeBtn}`}
                title="Close Mind Map"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-4 z-10">
                <div className="relative size-24 mx-auto mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping opacity-75" />
                  <div className="absolute inset-2 rounded-full border border-emerald-500/30 animate-pulse" />
                  <div className="relative size-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <svg className="size-8 text-emerald-400 animate-pulse duration-[1.8s]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2.5a3.5 3.5 0 0 1 3.5 3.5v.5h.5a3.5 3.5 0 0 1 3.5 3.5v.5h.5a3.5 3.5 0 0 1 3.5 3.5c0 1.93-1.57 3.5-3.5 3.5h-.5v.5a3.5 3.5 0 0 1-3.5 3.5h-.5a3.5 3.5 0 0 1-3.5-3.5v-.5h-.5A3.5 3.5 0 0 1 2.5 14a3.5 3.5 0 0 1 3.5-3.5v-.5h.5A3.5 3.5 0 0 1 9.5 2.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                    </svg>
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <p className={`text-3xl font-medium font-heading italic transition-all duration-300 ${ui.loadingText}`}>Structuring mind map takeaways...</p>
                  <p className={`text-xs font-mono uppercase tracking-[0.3em] transition-all duration-300 ${ui.loadingSub}`}>Running semantic decomposition</p>
                </div>
              </div>
            ) : error ? (
              /* Error State */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center z-10">
                <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 p-8 rounded-2xl shadow-xl">
                  <p className="text-rose-500 font-mono text-xs mb-4">Error: {error}</p>
                  <button
                    onClick={() => handleGenerate("moderate")}
                    className="text-xs font-mono bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-full"
                  >
                    Retry Generation
                  </button>
                </div>
              </div>
            ) : !mindMap ? (
              /* Not Yet Generated Empty State */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                {/* Double Bezel Empty Card */}
                <div className="relative p-1.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-[2rem] max-w-lg w-full transition-all duration-300">
                  <div className={`rounded-[calc(2rem-0.375rem)] border p-10 space-y-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] dark:shadow-none ${ui.emptyBg}`}>
                    {/* Glowing Brain Icon Halo */}
                    <div className="relative size-16 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-emerald-500/10 animate-ping opacity-60" />
                      <div className="absolute inset-2 rounded-full border border-emerald-500/20 animate-pulse" />
                      <div className="relative size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <svg className="size-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2.5a3.5 3.5 0 0 1 3.5 3.5v.5h.5a3.5 3.5 0 0 1 3.5 3.5v.5h.5a3.5 3.5 0 0 1 3.5 3.5c0 1.93-1.57 3.5-3.5 3.5h-.5v.5a3.5 3.5 0 0 1-3.5 3.5h-.5a3.5 3.5 0 0 1-3.5-3.5v-.5h-.5A3.5 3.5 0 0 1 2.5 14a3.5 3.5 0 0 1 3.5-3.5v-.5h.5A3.5 3.5 0 0 1 9.5 2.5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                        </svg>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <h3 className={`font-heading italic font-normal text-3xl md:text-4xl text-[#111111] dark:text-[#F2F2F0] tracking-[-0.03em]`}>
                        No Mind Map Found
                      </h3>
                      <p className="text-sm font-body text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                        Transform this post's key takeaways and insights into an interactive, beautifully structured conceptual visual map.
                      </p>
                    </div>

                    <button
                      onClick={() => handleGenerate("moderate")}
                      className="group relative w-full rounded-full bg-[#111111] dark:bg-[#F2F2F0] text-[#FAFAF8] dark:text-[#111111] h-12 pl-6 pr-1.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.02] active:scale-[0.97] shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_12px_rgba(255,255,255,0.15)] border-none flex items-center justify-between"
                    >
                      <span className="text-sm font-heading italic font-normal tracking-wide relative z-10">
                        Generate Mind Map Instantly
                      </span>
                      <div className="inline-flex items-center justify-center size-9 rounded-full bg-white/10 dark:bg-black/10 text-current transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-45">
                        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      </div>
                    </button>
                  </div>
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
                    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                    
                    @keyframes mindmap-flow {
                      to {
                        stroke-dashoffset: -180;
                      }
                    }

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
                  fill={theme === "light" ? "#FAF9F5" : (theme === "neon" ? "#020202" : "#0A0B0D")}
                />
                
                {/* Glowing Mesh Orbs in the background */}
                {theme !== "light" && (
                  <>
                    <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#orb-left)" pointerEvents="none" />
                    <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#orb-right)" pointerEvents="none" />
                  </>
                )}
                
                <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#mindmap-grid)" />

                {/* Responsive container transformed by state */}
                <g id="mindmap-container-g" transform={`translate(${containerRef.current ? containerRef.current.clientWidth / 2 + pan.x : pan.x}, ${containerRef.current ? containerRef.current.clientHeight / 2 + pan.y : pan.y}) scale(${zoom})`}>
                  {renderMindMapContent()}
                </g>
              </svg>
            )}

            {/* Floating Controls at bottom-right (Double-Bezel Glass Pill) */}
            {mindMap && (
              <div className={`absolute bottom-6 right-6 p-1.5 rounded-full border transition-all duration-300 z-10 backdrop-blur-md ${
                theme === "light" ? "bg-[#FAF9F5]/70 border-[#E8E6E1]/80" : (theme === "neon" ? "bg-[#0A0A0A]/70 border-[#1A1A1A]/80" : "bg-[#0D0E12]/70 border-[#1E2028]/80")
              }`}>
                <div className={`flex items-center gap-1.5 p-1 rounded-full border ${ui.controlBg}`}>
                  <button
                    onClick={zoomOut}
                    className={`size-8 rounded-full flex items-center justify-center transition-colors ${ui.controlBtn}`}
                    title="Zoom Out"
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    onClick={zoomIn}
                    className={`size-8 rounded-full flex items-center justify-center transition-colors ${ui.controlBtn}`}
                    title="Zoom In"
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className={`w-px h-4 ${ui.divider}`} />
                  <button
                    onClick={fitView}
                    className={`text-[10px] font-mono tracking-wider px-3.5 py-1.5 rounded-full transition-colors ${ui.controlBtn}`}
                    title="Fit to Screen"
                  >
                    FIT
                  </button>
                  <button
                    onClick={resetView}
                    className={`text-[10px] font-mono tracking-wider px-3.5 py-1.5 rounded-full transition-colors ${ui.controlBtn}`}
                    title="Reset Scale"
                  >
                    RESET
                  </button>
                  <div className={`w-px h-4 ${ui.divider}`} />
                  
                  {/* Copy Dropdown Menu */}
                  <div className="relative" ref={copyDropdownRef}>
                    <button
                      onClick={() => {
                        setShowCopyDropdown(!showCopyDropdown);
                        setShowDownloadDropdown(false);
                      }}
                      className={`text-[10px] font-mono tracking-wider px-3.5 py-1.5 border rounded-full transition-all flex items-center gap-1.5 ${ui.controlBtn}`}
                      title="Copy Options"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="11" height="11" rx="1.5" ry="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      COPY
                    </button>
  
                    {showCopyDropdown && (
                      <div className={`absolute right-0 bottom-full mb-3 w-48 border rounded-2xl shadow-2xl z-50 flex flex-col p-1.5 transition-all ${ui.dropdownBg}`}>
                        <button
                          onClick={() => {
                            handleCopySVG();
                            setShowCopyDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2.5 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                        >
                          <svg className="size-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                          </svg>
                          Copy SVG
                        </button>
                        <button
                          onClick={() => {
                            handleCopyPNG();
                            setShowCopyDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2.5 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                        >
                          <svg className="size-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="8.5" cy="8.5" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Copy PNG
                        </button>
                      </div>
                    )}
                  </div>
  
                  {/* Download Dropdown Menu */}
                  <div className="relative" ref={downloadDropdownRef}>
                    <button
                      onClick={() => {
                        setShowDownloadDropdown(!showDownloadDropdown);
                        setShowCopyDropdown(false);
                      }}
                      className={`text-[10px] font-mono tracking-wider px-3.5 py-1.5 border rounded-full transition-all flex items-center gap-1.5 ${ui.controlBtn}`}
                      title="Download Options"
                    >
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      DOWNLOAD
                    </button>
  
                    {showDownloadDropdown && (
                      <div className={`absolute right-0 bottom-full mb-3 w-48 border rounded-2xl shadow-2xl z-50 flex flex-col p-1.5 transition-all ${ui.dropdownBg}`}>
                        <button
                          onClick={() => {
                            downloadPNG();
                            setShowDownloadDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2.5 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                        >
                          <svg className="size-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="8.5" cy="8.5" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="21 15 16 10 5 21" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Download PNG
                        </button>
                        <button
                          onClick={() => {
                            downloadPDF();
                            setShowDownloadDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2.5 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                        >
                          <svg className="size-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="10 9 9 9 8 9" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Export PDF
                        </button>
                        <button
                          onClick={() => {
                            downloadSVG();
                            setShowDownloadDropdown(false);
                          }}
                          className={`flex items-center px-3 py-2.5 text-left text-xs font-mono rounded-xl transition-colors w-full ${ui.dropdownHover}`}
                        >
                          <svg className="size-3.5 mr-2 opacity-80" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                          </svg>
                          Download SVG
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
    </div>
  );
}
