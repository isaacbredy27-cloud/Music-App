import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, normaliseTrack, getAccessCode, setAccessCode } from "./api.js";
import CreatePanel from "./components/CreatePanel.jsx";
import Library from "./components/Library.jsx";
import Player from "./components/Player.jsx";

const STORE_KEY = "waveform.tasks.v1";
const IN_PROGRESS = new Set(["PENDING", "TEXT_SUCCESS", "FIRST_SUCCESS"]);
const FAILED = {
  CREATE_TASK_FAILED: "Suno couldn't create the task.",
  GENERATE_AUDIO_FAILED: "Suno failed to generate audio.",
  CALLBACK_EXCEPTION: "Generation ran into a callback error.",
  SENSITIVE_WORD_ERROR: "Your prompt contains words Suno doesn't allow.",
};
const POLL_MS = 6000;
const TIMEOUT_MS = 15 * 60 * 1000;

function loadTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [credits, setCredits] = useState(null);
  const [current, setCurrent] = useState(null); // track id
  const [needsCode, setNeedsCode] = useState(false);
  const [codeInput, setCodeInput] = useState(getAccessCode());
  const [toast, setToast] = useState(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

  const notify = useCallback((msg, kind = "error") => {
    setToast({ msg, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleError = useCallback(
    (err) => {
      if (err?.needsAccessCode) setNeedsCode(true);
      else notify(err?.message || "Something went wrong");
    },
    [notify]
  );

  const refreshCredits = useCallback(() => {
    api.credits().then(setCredits).catch((e) => e?.needsAccessCode && setNeedsCode(true));
  }, []);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  const updateTask = (taskId, patch) =>
    setTasks((prev) => prev.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)));

  // Poll every in-progress task.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const pending = tasksRef.current.filter((t) => IN_PROGRESS.has(t.status));
      for (const task of pending) {
        if (stopped) return;
        if (Date.now() - task.createdAt > TIMEOUT_MS) {
          updateTask(task.taskId, { status: "TIMEOUT", error: "Timed out waiting for Suno." });
          continue;
        }
        try {
          const info = await api.status(task.taskId);
          const status = info?.status || "PENDING";
          const raw = info?.response?.sunoData || [];
          const tracks = raw.map((t) => normaliseTrack(t, task.taskId));
          const patch = { status };
          if (tracks.length) patch.tracks = tracks;
          if (FAILED[status]) {
            patch.error = info?.errorMessage || FAILED[status];
            if (tracks.some((t) => t.audio)) patch.status = "SUCCESS";
          }
          updateTask(task.taskId, patch);
          if (status === "SUCCESS") refreshCredits();
        } catch (e) {
          if (e?.needsAccessCode) setNeedsCode(true);
        }
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [refreshCredits]);

  const onGenerate = async (body) => {
    try {
      const data = await api.generate(body);
      const task = {
        taskId: data.taskId,
        createdAt: Date.now(),
        status: "PENDING",
        request: body,
        tracks: [],
      };
      setTasks((prev) => [task, ...prev]);
      notify("Generating your song — this usually takes 1–3 minutes.", "ok");
      return true;
    } catch (e) {
      handleError(e);
      return false;
    }
  };

  const allTracks = useMemo(
    () => tasks.flatMap((t) => (t.tracks || []).filter((tr) => tr.audio || tr.stream)),
    [tasks]
  );
  const currentTrack = allTracks.find((t) => t.id === current) || null;

  const removeTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    if (currentTrack?.taskId === taskId) setCurrent(null);
  };

  const step = (dir) => {
    if (!allTracks.length) return;
    const i = allTracks.findIndex((t) => t.id === current);
    const next = allTracks[(i + dir + allTracks.length) % allTracks.length];
    setCurrent(next.id);
  };

  const saveCode = (e) => {
    e.preventDefault();
    setAccessCode(codeInput.trim());
    setNeedsCode(false);
    refreshCredits();
  };

  return (
    <div className={`app ${currentTrack ? "has-player" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <span>Waveform</span>
        </div>
        <div className="topbar-right">
          {credits !== null && (
            <button className="credits" onClick={refreshCredits} title="Refresh credits">
              <span className="dot" /> {Number(credits).toLocaleString()} credits
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="hero">
          <h1>Turn an idea into a song.</h1>
          <p>Describe a vibe, pick a genre, or write your own lyrics. Each request creates two takes.</p>
        </section>

        <div className="grid">
          <CreatePanel onGenerate={onGenerate} onError={handleError} />
          <Library
            tasks={tasks}
            currentId={current}
            onPlay={(id) => setCurrent(id)}
            onRemove={removeTask}
          />
        </div>
      </main>

      {currentTrack && (
        <Player
          track={currentTrack}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={() => setCurrent(null)}
        />
      )}

      {needsCode && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveCode}>
            <h2>Enter access code</h2>
            <p>This studio is private. Ask the owner for the access code.</p>
            <input
              autoFocus
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Access code"
            />
            <button className="btn primary" type="submit">Unlock</button>
          </form>
        </div>
      )}

      {toast && (
        <div key={toast.id} className={`toast ${toast.kind}`} role="status">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
