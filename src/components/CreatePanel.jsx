import { useState } from "react";
import { api, sleep } from "../api.js";

const MODELS = [
  { id: "V6", label: "V6 — Best quality" },
  { id: "V6_WILD", label: "V6 Wild — Bold & experimental" },
  { id: "V6_MINI", label: "V6 Mini — Fast" },
];

const GENRES = [
  "Pop", "Hip-hop", "R&B", "Lo-fi", "EDM", "House", "Rock", "Indie", "Afrobeats",
  "Reggaeton", "Country", "Jazz", "Classical", "Cinematic", "Metal", "K-pop",
];

const IDEAS = [
  "An upbeat summer anthem about road trips with friends",
  "A heartbreak ballad sung under city lights at 2am",
  "A chill lo-fi beat for studying on a rainy afternoon",
  "An epic orchestral theme for a hero's final battle",
  "A feel-good birthday song for my best friend Sam",
];

export default function CreatePanel({ onGenerate, onError }) {
  const [mode, setMode] = useState("simple");
  const [busy, setBusy] = useState(false);

  // shared
  const [model, setModel] = useState("V6");
  const [instrumental, setInstrumental] = useState(false);
  const [style, setStyle] = useState("");

  // simple
  const [prompt, setPrompt] = useState("");

  // custom
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState("");
  const [duration, setDuration] = useState(120);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [styleWeight, setStyleWeight] = useState(0.5);
  const [weirdness, setWeirdness] = useState(0.5);
  const [variety, setVariety] = useState(1);
  const [touched, setTouched] = useState({});

  // AI lyrics helper
  const [lyricIdea, setLyricIdea] = useState("");
  const [lyricBusy, setLyricBusy] = useState(false);

  const toggleGenre = (g) => {
    const parts = style.split(",").map((s) => s.trim()).filter(Boolean);
    const has = parts.some((p) => p.toLowerCase() === g.toLowerCase());
    const next = has ? parts.filter((p) => p.toLowerCase() !== g.toLowerCase()) : [...parts, g];
    setStyle(next.join(", "));
  };
  const activeGenres = new Set(style.split(",").map((s) => s.trim().toLowerCase()));

  const canSubmit =
    mode === "simple"
      ? !!style.trim()
      : !!(style.trim() || (!instrumental && lyrics.trim()) || negativeTags.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    const body =
      mode === "simple"
        ? { customMode: false, instrumental, model, prompt, style }
        : {
            customMode: true,
            instrumental,
            model,
            title,
            style,
            lyrics: instrumental ? "" : lyrics,
            negativeTags,
            vocalGender: instrumental ? "" : vocalGender,
            duration,
            ...(touched.styleWeight && { styleWeight }),
            ...(touched.weirdness && { weirdnessConstraint: weirdness }),
            ...(touched.variety && { variety }),
          };
    await onGenerate(body);
    setBusy(false);
  };

  const writeLyrics = async () => {
    const idea = (lyricIdea || title || style).trim();
    if (!idea) return onError(new Error("Tell the lyric writer what the song is about."));
    setLyricBusy(true);
    try {
      const { taskId } = await api.lyrics(idea.slice(0, 200));
      const started = Date.now();
      while (Date.now() - started < 3 * 60 * 1000) {
        await sleep(4000);
        const info = await api.lyricsStatus(taskId);
        const items = info?.response?.data || [];
        const done = items.find((d) => d.status === "complete" && d.text);
        if (done) {
          setLyrics(done.text);
          if (!title && done.title) setTitle(done.title.slice(0, 80));
          return;
        }
        if (info?.status && /FAILED|ERROR|EXCEPTION/.test(info.status)) {
          throw new Error(info.errorMessage || "Lyric generation failed.");
        }
      }
      throw new Error("Lyric generation timed out.");
    } catch (e) {
      onError(e);
    } finally {
      setLyricBusy(false);
    }
  };

  return (
    <form className="panel create" onSubmit={submit}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "simple"} className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>
          Simple
        </button>
        <button type="button" role="tab" aria-selected={mode === "custom"} className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>
          Custom
        </button>
      </div>

      {mode === "simple" ? (
        <>
          <label className="field">
            <span>Describe your song</span>
            <textarea
              rows={4}
              maxLength={3000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. An upbeat summer anthem about road trips with friends"
            />
          </label>
          <div className="ideas">
            {IDEAS.map((i) => (
              <button type="button" key={i} className="chip ghost" onClick={() => setPrompt(i)}>
                {i}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Title <em>optional</em></span>
            <input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Midnight Drive" />
          </label>

          {!instrumental && (
            <div className="field">
              <span>Lyrics</span>
              <textarea
                rows={8}
                maxLength={5000}
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={"[Verse]\nNeon lights on an empty street\n...\n\n[Chorus]\n..."}
              />
              <div className="lyric-helper">
                <input
                  maxLength={200}
                  value={lyricIdea}
                  onChange={(e) => setLyricIdea(e.target.value)}
                  placeholder="Song idea for the AI lyric writer"
                />
                <button type="button" className="btn small" onClick={writeLyrics} disabled={lyricBusy}>
                  {lyricBusy ? <><span className="spinner" /> Writing…</> : "✨ Write lyrics"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <label className="field">
        <span>Style / genre {mode === "simple" && <em>required</em>}</span>
        <input
          maxLength={1000}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g. dreamy synth-pop, female vocals, 110 bpm"
        />
      </label>
      <div className="chips">
        {GENRES.map((g) => (
          <button type="button" key={g} className={`chip ${activeGenres.has(g.toLowerCase()) ? "on" : ""}`} onClick={() => toggleGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <>
          <label className="field">
            <span>Exclude styles <em>optional</em></span>
            <input maxLength={1000} value={negativeTags} onChange={(e) => setNegativeTags(e.target.value)} placeholder="e.g. heavy metal, autotune" />
          </label>

          <div className="row">
            {!instrumental && (
              <div className="field">
                <span>Voice</span>
                <div className="segmented">
                  {[["", "Any"], ["f", "Female"], ["m", "Male"]].map(([v, l]) => (
                    <button type="button" key={l} className={vocalGender === v ? "on" : ""} onClick={() => setVocalGender(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="field grow">
              <span>Length · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span>
              <input type="range" min={10} max={360} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
          </div>

          <button type="button" className="link" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "▾" : "▸"} Advanced controls
          </button>
          {showAdvanced && (
            <div className="advanced">
              <Slider label="Style adherence" value={styleWeight} onChange={(v) => { setStyleWeight(v); setTouched((t) => ({ ...t, styleWeight: true })); }} />
              <Slider label="Weirdness" value={weirdness} onChange={(v) => { setWeirdness(v); setTouched((t) => ({ ...t, weirdness: true })); }} />
              <label className="field">
                <span>Variety · {["Off", "Normal", "High", "Extra", "Max"][variety]}</span>
                <input type="range" min={0} max={4} step={1} value={variety} onChange={(e) => { setVariety(Number(e.target.value)); setTouched((t) => ({ ...t, variety: true })); }} />
              </label>
            </div>
          )}
        </>
      )}

      <div className="row between">
        <label className="switch">
          <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
          <span className="track" />
          Instrumental
        </label>
        <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <button className="btn primary big" type="submit" disabled={!canSubmit || busy}>
        {busy ? <><span className="spinner" /> Sending…</> : "♪ Create song"}
      </button>
      {!canSubmit && (
        <p className="hint">
          {mode === "simple" ? "Pick or type a style to get started." : "Add a style, lyrics or exclude-styles."}
        </p>
      )}
    </form>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label} · {Math.round(value * 100)}%</span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
