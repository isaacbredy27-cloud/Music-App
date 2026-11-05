import { useEffect, useRef, useState } from "react";
import { fmtTime } from "./Library.jsx";

export default function Player({ track, onPrev, onNext, onClose }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const src = track.audio || track.stream;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = src;
    setTime(0);
    a.play().catch(() => setPlaying(false));
    // Only reload when switching tracks, so a stream -> final MP3 upgrade doesn't restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration)) a.currentTime = Number(e.target.value);
  };

  const total = Number.isFinite(dur) && dur > 0 ? dur : track.duration || 0;

  return (
    <div className="player">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={onNext}
      />
      {lyricsOpen && track.lyrics && (
        <div className="lyrics-sheet">
          <pre>{track.lyrics}</pre>
        </div>
      )}
      <div className="player-inner">
        <div className="now">
          {track.image ? <img src={track.image} alt="" /> : <div className="cover-fallback sm">♪</div>}
          <div className="now-text">
            <div className="track-title">{track.title}</div>
            <div className="track-tags">{track.tags}</div>
          </div>
        </div>
        <div className="controls">
          <div className="buttons">
            <button className="icon-btn" onClick={onPrev} aria-label="Previous">⏮</button>
            <button className="play-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? "❚❚" : "▶"}
            </button>
            <button className="icon-btn" onClick={onNext} aria-label="Next">⏭</button>
          </div>
          <div className="scrub">
            <span>{fmtTime(time)}</span>
            <input type="range" min={0} max={total || 0} step={0.1} value={Math.min(time, total || 0)} onChange={seek} />
            <span>{fmtTime(total)}</span>
          </div>
        </div>
        <div className="extras">
          {track.lyrics && (
            <button className={`icon-btn text ${lyricsOpen ? "on" : ""}`} onClick={() => setLyricsOpen((o) => !o)}>
              Lyrics
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close player">✕</button>
        </div>
      </div>
    </div>
  );
}
