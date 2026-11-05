import { useState } from "react";

const STAGE = {
  PENDING: { label: "Queued", pct: 12 },
  TEXT_SUCCESS: { label: "Writing lyrics", pct: 40 },
  FIRST_SUCCESS: { label: "First take ready", pct: 75 },
};

export const fmtTime = (s) => {
  if (!s || !Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

function describe(req = {}) {
  return req.title || req.prompt || req.style || "Untitled idea";
}

export default function Library({ tasks, currentId, onPlay, onRemove }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q
    ? tasks.filter((t) =>
        [describe(t.request), t.request?.style, ...(t.tracks || []).map((tr) => `${tr.title} ${tr.tags}`)]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : tasks;

  return (
    <section className="panel library">
      <div className="library-head">
        <h2>Your library</h2>
        {tasks.length > 0 && (
          <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs" />
        )}
      </div>

      {tasks.length === 0 && (
        <div className="empty">
          <div className="empty-art">
            <span /><span /><span /><span /><span />
          </div>
          <p>No songs yet. Create your first track and it will show up here.</p>
        </div>
      )}

      <ul className="tasks">
        {visible.map((task) => {
          const stage = STAGE[task.status];
          const playable = (task.tracks || []).filter((t) => t.audio || t.stream);
          return (
            <li key={task.taskId} className="task">
              <div className="task-head">
                <div className="task-title" title={describe(task.request)}>{describe(task.request)}</div>
                <div className="task-meta">
                  {new Date(task.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {" · "}{task.request?.model || "V6"}
                  {task.request?.instrumental ? " · Instrumental" : ""}
                </div>
                <button className="icon-btn" title="Remove from library" onClick={() => onRemove(task.taskId)}>✕</button>
              </div>

              {stage && (
                <div className="progress">
                  <div className="progress-bar"><div style={{ width: `${stage.pct}%` }} /></div>
                  <span><span className="spinner" /> {stage.label}…</span>
                </div>
              )}
              {task.error && !playable.length && <div className="task-error">{task.error}</div>}

              {playable.length > 0 && (
                <div className="tracks">
                  {playable.map((tr) => {
                    const active = tr.id === currentId;
                    const ready = !!tr.audio;
                    return (
                      <div key={tr.id} className={`track ${active ? "active" : ""}`}>
                        <button className="cover" onClick={() => onPlay(tr.id)} aria-label={`Play ${tr.title}`}>
                          {tr.image ? <img src={tr.image} alt="" loading="lazy" /> : <div className="cover-fallback">♪</div>}
                          <span className="play-overlay">{active ? "❚❚" : "▶"}</span>
                        </button>
                        <div className="track-info">
                          <div className="track-title">{tr.title}</div>
                          <div className="track-tags">{tr.tags}</div>
                          <div className="track-foot">
                            <span>{ready ? fmtTime(tr.duration) : "Streaming preview"}</span>
                            {ready && (
                              <a className="dl" href={tr.audio} target="_blank" rel="noreferrer" download>
                                ↓ MP3
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {tasks.length > 0 && <p className="hint">Suno keeps generated files for 14 days — download the ones you love.</p>}
    </section>
  );
}
