"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator } from "lucide-react";
import { useTheme } from "@/providers/theme-provider";

export function Riskcalc() {
  const { theme } = useTheme();
  const [size, setSize] = useState({ width: 260, height: 500 });
  // Open in bottom left: x = 0, y = window.innerHeight - height - 20 (move 20px higher)
  const getInitialY = () => {
    if (typeof window !== 'undefined') {
      return Math.max(0, window.innerHeight - 500 - 170);
    }
    return 0;
  };
  const [position, setPosition] = useState({ x: 12, y: getInitialY() });
  const dragRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const resizing = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });
  const resizeStart = React.useRef({ x: 0, y: 0, width: 400, height: 500 });
  const [open, setOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("MNQ");
  const [risk, setRisk] = useState(250);
  // CFD logic removed

  // Drag handlers
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true;
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.current) return;
    setPosition((pos) => ({
      x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - offset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - offset.current.y)),
    }));
  }

  function onMouseUp() {
    dragging.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  // Resize handlers
  function onResizeMove(e: MouseEvent) {
    if (!resizing.current) return;
    setSize(() => ({
      width: Math.max(
        320,
        Math.min(window.innerWidth, resizeStart.current.width + (e.clientX - resizeStart.current.x))
      ),
      height: Math.max(
        320,
        Math.min(window.innerHeight, resizeStart.current.height + (e.clientY - resizeStart.current.y))
      ),
    }));
  }

  function onResizeUp() {
    resizing.current = false;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeUp);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Calculator className="h-[1.2rem] w-[1.2rem] transition-all" />
            <span className="sr-only">Open Risk Calculator</span>
          </Button>
        </DialogTrigger>
      </Dialog>


      {open && createPortal(
        <div
          ref={dragRef}
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height,
            background: theme === 'light' ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.98)",
            border: theme === 'light' ? "1.5px solid rgba(0,0,0,0.15)" : "1.5px solid rgba(255,255,255,0.20)",
            borderRadius: 12,
            zIndex: 1000,
            boxShadow: theme === 'light' ? "0 8px 32px 0 rgba(0,0,0,0.15)" : "0 8px 32px 0 rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            userSelect: "none",
          }}
        >
          {/* Popup Header (draggable) */}
          <div
            onMouseDown={onMouseDown}
            style={{
              cursor: "move",
              background: theme === 'light' ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.92)",
              borderTopLeftRadius: "0.5rem",
              borderTopRightRadius: "0.5rem",
              padding: "8px 8px 0 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              userSelect: "none",
              color: theme === 'light' ? "#000" : "#fff",
              borderBottom: "none",
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="ml-2"
            >
              <span className="sr-only">Close</span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 6L14 14M6 14L14 6"
                  stroke={theme === 'light' ? "#000" : "#fff"}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
          </div>

          {/* Hide scrollbars */}
          <style>{`
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .risk-table-scroll::-webkit-scrollbar { display: none; }
            .risk-table-scroll { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>

          {/* Main Content */}
          <div
            style={{
              padding: "16px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              overflow: "auto",
              position: "relative",
              zIndex: 2,
            }}
            className="hide-scrollbar"
          >
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
              <Select
                value={selectedSymbol}
                onValueChange={setSelectedSymbol}
              >
                <SelectTrigger className={`min-w-[160px] ${theme === 'light' ? 'text-black border-black/20 hover:border-black/20 focus:border-black/20' : 'text-white border-white/20 hover:border-white/20 focus:border-white/20'} border focus:ring-0 z-[9999] mx-auto`} style={{ marginBottom: 0 }}>
                  <SelectValue placeholder="Symbol" />
                </SelectTrigger>
                <SelectContent className={`${theme === 'light' ? "bg-white text-black" : "bg-black text-white"} z-[10000]`}>
                  <SelectItem value="NQ" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>NQ</SelectItem>
                  <SelectItem value="ES" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>ES</SelectItem>
                  <SelectItem value="YM" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>YM</SelectItem>
                  <SelectItem value="GC" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>GC</SelectItem>
                  <SelectItem value="MNQ" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>MNQ</SelectItem>
                  <SelectItem value="MES" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>MES</SelectItem>
                  <SelectItem value="MYM" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>MYM</SelectItem>
                  <SelectItem value="MGC" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>MGC</SelectItem>
                  <SelectItem value="6E" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>6E</SelectItem>
                  <SelectItem value="6B" className={theme === 'light' ? "text-black hover:bg-gray-100 focus:bg-gray-200 focus:text-black" : "text-white hover:bg-white/20 focus:bg-white/30 focus:text-white"}>6B</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: Math.max(340, size.width * 0.8),
                }}
              >
                {/* Risk Inputs */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    marginBottom: 16,
                    gap: 8,
                    width: "100%",
                    marginTop: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: theme === 'light' ? "#000" : "#fff", fontWeight: 500 }}>Risk:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={risk}
                      onChange={(e) => {
                        // Only allow numbers
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setRisk(val ? Number(val) : 0);
                      }}
                      style={{
                        width: 80,
                        padding: "4px 8px",
                        borderRadius: 4,
                        border: theme === 'light' ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.15)",
                        background: theme === 'light' ? "rgba(0,0,0,0.05)" : "transparent",
                        color: theme === 'light' ? "#000" : "#fff",
                        fontSize: "1em",
                        outline: "none",
                        textAlign: "center",
                        MozAppearance: "textfield",
                      }}
                    />
                    <span style={{ color: theme === 'light' ? "#000" : "#fff" }}>$</span>
                  </div>

                  {/* CFD input removed */}
                </div>

                {/* Table Header */}
                <div
                  style={{
                    display: "flex",
                    fontWeight: 600,
                    color: "#94bba3",
                    borderBottom: theme === 'light' ? "1px solid #ddd" : "1px solid #333",
                    paddingBottom: 4,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: 1, textAlign: "center" }}>Ticks</div>
                  <div style={{ flex: 1, textAlign: "center" }}>Contracts</div>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    Risk $ <span style={{ fontWeight: 400, fontSize: "0.9em" }}></span>
                  </div>
                  {/* CFD column removed */}
                </div>

                {/* Risk Table */}
                <div style={{ maxHeight: 300, overflowY: "auto" }} className="risk-table-scroll">
                  {Array.from({ length: 200 }, (_, i) => (i + 1) * 5).map((ticks) => {
                    let tickValue = 0.5;
                    switch (selectedSymbol) {
                      case "NQ":
                      case "MNQ":
                        tickValue = selectedSymbol === "NQ" ? 5 : 0.5;
                        break;
                      case "ES":
                      case "MES":
                        tickValue = selectedSymbol === "ES" ? 12.5 : 1.25;
                        break;
                      case "YM":
                      case "MYM":
                        tickValue = selectedSymbol === "YM" ? 5 : 0.5;
                        break;
                      case "GC":
                      case "MGC":
                        tickValue = selectedSymbol === "GC" ? 10 : 1;
                        break;
                      case "6E":
                      case "6B":
                        tickValue = 6.25;
                        break;
                      default:
                        tickValue = 0.5;
                    }
                    const contracts = Math.max(1, Math.round(risk / (ticks * tickValue)));
                    const risked = Math.round(contracts * ticks * tickValue);
                    return (
                      <div
                        key={ticks}
                        style={{
                          display: "flex",
                          color: theme === 'light' ? "#000" : "#fff",
                          padding: "2px 0",
                          borderBottom: theme === 'light' ? "1px solid #eee" : "1px solid #222",
                          fontSize: "1em",
                        }}
                      >
                        <div style={{ flex: 1, textAlign: "center" }}>{ticks}</div>
                        <div style={{ flex: 1, textAlign: "center" }}>{contracts}</div>
                        <div style={{ flex: 1, textAlign: "center" }}>{risked}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Resize handle */}
            <div
              className="resize-handle"
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 18,
                height: 18,
                cursor: "nwse-resize",
                background: "transparent",
                zIndex: 10,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                resizing.current = true;
                resizeStart.current = {
                  x: e.clientX,
                  y: e.clientY,
                  width: size.width,
                  height: size.height,
                };
                document.addEventListener("mousemove", onResizeMove);
                document.addEventListener("mouseup", onResizeUp);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M3 15h12M6 12h9M9 9h6" stroke="#94bba3" strokeWidth="1.5" />
              </svg>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
