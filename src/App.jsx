import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "./App.css";

export default function App() {
  const containerRef = useRef();
  const previewRef = useRef();
  const iframeRef = useRef(null);
  const editorRef = useRef(null);

  const [activeFile, setActiveFile] = useState("html");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedEl, setSelectedEl] = useState(null);

  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem("project");
    return saved
      ? JSON.parse(saved)
      : {
          html: "<h1>Hello VS Code UI</h1>",
          css: "body { background:#111; color:#fff }",
          js: "console.log('JS Loaded');",
        };
  });

  const [logs, setLogs] = useState([]);
  const [srcDoc, setSrcDoc] = useState("");
  const [editorWidth, setEditorWidth] = useState(50);
  const [terminalHeight, setTerminalHeight] = useState(35);

  /* ---------------- SAVE PROJECT ---------------- */
  useEffect(() => {
    localStorage.setItem("project", JSON.stringify(files));
  }, [files]);

  /* ---------------- BUILD PREVIEW + INSPECTOR ---------------- */
  useEffect(() => {
    setLogs([]);

    setSrcDoc(`
      <html>
        <head>
          <style>
            ${files.css}
            .__inspect-hover {
              outline: 2px solid #3b82f6 !important;
              cursor: crosshair !important;
            }
          </style>
        </head>
        <body>
          ${files.html}

          <script>
            const send = (type, message) =>
              parent.postMessage({ type, message }, '*');

            console.log = (...a) => send('log', a.join(' '));
            console.error = (...a) => send('error', a.join(' '));

            let inspectEnabled = false;
            let lastEl = null;

            window.addEventListener("message", (e) => {
              if (e.data.type === "INSPECT_ON") inspectEnabled = true;
              if (e.data.type === "INSPECT_OFF") {
                inspectEnabled = false;
                if (lastEl) lastEl.classList.remove("__inspect-hover");
              }
            });

            document.addEventListener("mousemove", (e) => {
              if (!inspectEnabled) return;
              if (lastEl) lastEl.classList.remove("__inspect-hover");
              lastEl = e.target;
              lastEl.classList.add("__inspect-hover");
            });

            document.addEventListener("click", (e) => {
              if (!inspectEnabled) return;
              e.preventDefault();
              e.stopPropagation();

              const el = e.target;
              send("ELEMENT_SELECTED", {
                tag: el.tagName.toLowerCase(),
                id: el.id || "",
                className: el.className || "",
                styles: el.getAttribute("style") || "—",
              });

              inspectEnabled = false;
              if (lastEl) lastEl.classList.remove("__inspect-hover");
            }, true);

            ${files.js}
          <\/script>
        </body>
      </html>
    `);
  }, [files]);

  /* ---------------- CONSOLE + INSPECT LISTENER ---------------- */
  useEffect(() => {
    const handler = (e) => {
      if (e.data.type === "log" || e.data.type === "error") {
        setLogs((p) => [...p, e.data.message]);
      }

      if (e.data.type === "ELEMENT_SELECTED") {
        setSelectedEl(e.data.message);
        setInspectMode(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  /* ---------------- SEND INSPECT TO IFRAME ---------------- */
  const toggleInspect = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.contentWindow.postMessage(
      { type: inspectMode ? "INSPECT_OFF" : "INSPECT_ON" },
      "*"
    );

    setInspectMode((p) => !p);
  };

  /* ---------------- DRAG EDITOR ---------------- */
  const startEditorResize = (e) => {
    const startX = e.clientX;
    const start = editorWidth;

    const move = (ev) => {
      const delta = ev.clientX - startX;
      const newWidth =
        ((start / 100) * window.innerWidth + delta) /
        window.innerWidth *
        100;
      setEditorWidth(Math.min(70, Math.max(25, newWidth)));
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", () =>
      document.removeEventListener("mousemove", move),
      { once: true }
    );
  };

  /* ---------------- DRAG TERMINAL ---------------- */
  const startTerminalResize = (e) => {
    const startY = e.clientY;
    const start = terminalHeight;

    const move = (ev) => {
      const delta = startY - ev.clientY;
      setTerminalHeight(
        Math.min(
          60,
          Math.max(
            20,
            start + (delta / containerRef.current.clientHeight) * 100
          )
        )
      );
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", () =>
      document.removeEventListener("mousemove", move),
      { once: true }
    );
  };

  /* ---------------- FULLSCREEN ---------------- */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="app" ref={containerRef}>
      {/* FILE TABS */}
      <div className="tabs">
        {["html", "css", "js"].map((f) => (
          <button
            key={f}
            className={activeFile === f ? "active" : ""}
            onClick={() => setActiveFile(f)}
          >
            {f === "html" ? "index.html" : f === "css" ? "style.css" : "app.js"}
          </button>
        ))}
      </div>

      <div className="main">
        {/* EDITOR */}
        <div className="editor-pane" style={{ width: `${editorWidth}%` }}>
          <Editor
            theme="vs-dark"
            language={activeFile === "js" ? "javascript" : activeFile}
            value={files[activeFile]}
            onMount={(e) => (editorRef.current = e)}
            onChange={(v) => setFiles({ ...files, [activeFile]: v || "" })}
            options={{ automaticLayout: true, minimap: { enabled: false } }}
          />
        </div>

        <div className="splitter-x" onMouseDown={startEditorResize} />

        {/* RIGHT */}
        <div className="right-pane">
          <div
            className="preview-pane"
            style={{ height: `${100 - terminalHeight}%` }}
            ref={previewRef}
          >
            <div className="preview-toolbar">
              <button onClick={() => setMobileView(!mobileView)}>📱</button>
              <button onClick={toggleInspect}>
                {inspectMode ? "Disable Pick" : "Pick Element"}
              </button>
              <button onClick={toggleFullscreen}>
                {isFullscreen ? "❌" : "⛶"}
              </button>
            </div>

            <div className={`preview-frame ${mobileView ? "mobile" : ""}`}>
              <iframe ref={iframeRef} sandbox="allow-scripts" srcDoc={srcDoc} />
            </div>
          </div>

          <div className="splitter-y" onMouseDown={startTerminalResize} />

          <div className="console-pane" style={{ height: `${terminalHeight}%` }}>
            <div className="console-header">Terminal</div>
            <div className="console-body">
              {logs.map((l, i) => (
                <div key={i}>>> {l}</div>
              ))}
            </div>
          </div>

          {selectedEl && (
            <div className="inspect-panel">
              <div><b>Tag:</b> {selectedEl.tag}</div>
              <div><b>ID:</b> {selectedEl.id || "—"}</div>
              <div><b>Class:</b> {selectedEl.className || "—"}</div>
              <div><b>Style:</b> {selectedEl.styles}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
