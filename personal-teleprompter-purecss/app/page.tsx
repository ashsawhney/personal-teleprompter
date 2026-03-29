'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Camera,
  ChevronsUpDown,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RotateCcw,
  Save,
  ScanLine,
  Settings2,
  SunMedium,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';

const DEFAULT_SCRIPT = `[Intro]
Welcome back.

This teleprompter is designed for direct-to-camera delivery so your eyeline stays natural and confident.

[Cue: Key message]
Paste your script, press play, and adjust the speed until it feels conversational.

Use the focus guide to keep only a few lines visible at a time. Mirror the text if you are using reflective glass in front of the camera.

[Section 2]
Voice-paced scrolling can follow your speech when supported by your browser.

[Outro]
Take a breath, smile lightly, and speak slower than you think you need to.`;

type SavedScript = {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
};

type CuePoint = {
  id: string;
  label: string;
  lineIndex: number;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: {
        transcript: string;
      };
    };
  };
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const STORAGE_KEYS = {
  script: 'teleprompter_script_v2',
  settings: 'teleprompter_settings_v2',
  savedScripts: 'teleprompter_saved_scripts_v2',
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildComparableUnits(script: string) {
  const lines = script.split('\n');
  return lines
    .map((line, index) => ({
      index,
      raw: line,
      normalized: normalizeText(line),
    }))
    .filter((item) => item.normalized.length > 0);
}

function extractCuePoints(script: string): CuePoint[] {
  const lines = script.split('\n');
  const cues: CuePoint[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const cueMatch = trimmed.match(/^\[(.+?)\]$/);
    if (cueMatch) {
      cues.push({
        id: `${index}-${cueMatch[1]}`,
        label: cueMatch[1],
        lineIndex: index,
      });
    }
  });

  return cues;
}

export default function TeleprompterPage() {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');

  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(38);
  const [fontSize, setFontSize] = useState(44);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [textWidth, setTextWidth] = useState(72);
  const [paddingY, setPaddingY] = useState(20);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [focusMode, setFocusMode] = useState(true);
  const [focusHeight, setFocusHeight] = useState(28);
  const [countdown, setCountdown] = useState(0);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [compactPanel, setCompactPanel] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [saveName, setSaveName] = useState('');
  const [statusText, setStatusText] = useState('Ready');
  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [spokenProgressLine, setSpokenProgressLine] = useState(0);

  const cuePoints = useMemo(() => extractCuePoints(script), [script]);
  const comparableUnits = useMemo(() => buildComparableUnits(script), [script]);

  const totalWords = useMemo(() => script.trim().split(/\s+/).filter(Boolean).length, [script]);
  const estimatedMinutes = useMemo(() => Math.max(1, Math.round((totalWords / 130) * 10) / 10), [totalWords]);

  useEffect(() => {
    const available = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(available);
  }, []);

  useEffect(() => {
    try {
      const savedScript = localStorage.getItem(STORAGE_KEYS.script);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.settings);
      const savedLibrary = localStorage.getItem(STORAGE_KEYS.savedScripts);

      if (savedScript) setScript(savedScript);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSpeed(parsed.speed ?? 38);
        setFontSize(parsed.fontSize ?? 44);
        setLineHeight(parsed.lineHeight ?? 1.6);
        setTextWidth(parsed.textWidth ?? 72);
        setPaddingY(parsed.paddingY ?? 20);
        setMirrorH(parsed.mirrorH ?? false);
        setMirrorV(parsed.mirrorV ?? false);
        setFocusMode(parsed.focusMode ?? true);
        setFocusHeight(parsed.focusHeight ?? 28);
        setCountdown(parsed.countdown ?? 0);
        setDarkMode(parsed.darkMode ?? true);
        setCompactPanel(parsed.compactPanel ?? false);
        setShowStats(parsed.showStats ?? true);
        setVoiceMode(parsed.voiceMode ?? false);
      }
      if (savedLibrary) setSavedScripts(JSON.parse(savedLibrary));
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.script, script);
  }, [script]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        speed,
        fontSize,
        lineHeight,
        textWidth,
        paddingY,
        mirrorH,
        mirrorV,
        focusMode,
        focusHeight,
        countdown,
        darkMode,
        compactPanel,
        showStats,
        voiceMode,
      })
    );
  }, [speed, fontSize, lineHeight, textWidth, paddingY, mirrorH, mirrorV, focusMode, focusHeight, countdown, darkMode, compactPanel, showStats, voiceMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.savedScripts, JSON.stringify(savedScripts));
  }, [savedScripts]);

  useEffect(() => {
    const onFullScreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullScreenChange);
  }, []);

  const stopAnimation = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastTsRef.current = null;
  }, []);

  const tick = useCallback(
    (ts: number) => {
      const area = scrollAreaRef.current;
      if (!area) return;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;

      area.scrollTop += (speed * delta) / 1000;

      const maxScroll = area.scrollHeight - area.clientHeight;
      if (area.scrollTop >= maxScroll - 2) {
        setIsPlaying(false);
        setStatusText('Reached end');
        stopAnimation();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    },
    [speed, stopAnimation]
  );

  useEffect(() => {
    if (voiceMode) {
      stopAnimation();
      return;
    }
    if (!isPlaying) {
      stopAnimation();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
    return stopAnimation;
  }, [isPlaying, tick, stopAnimation, voiceMode]);

  useEffect(() => {
    if (countdownLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdownLeft((prev) => {
        if (prev <= 1) {
          setIsPlaying(true);
          setStatusText(voiceMode ? 'Voice-paced active' : 'Playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdownLeft, voiceMode]);

  const resetHideControlsTimer = useCallback(() => {
    if (!showControls) return;
    if (hideControlsTimerRef.current) window.clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = window.setTimeout(() => {
      setCompactPanel(true);
    }, 3000);
  }, [showControls]);

  useEffect(() => {
    resetHideControlsTimer();
    return () => {
      if (hideControlsTimerRef.current) window.clearTimeout(hideControlsTimerRef.current);
    };
  }, [resetHideControlsTimer]);

  const startVoiceRecognition = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setStatusText('Voice pacing not supported in this browser');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let combined = transcriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        combined += ` ${event.results[i][0].transcript}`;
      }
      transcriptRef.current = combined;

      const normalizedTranscript = normalizeText(combined);
      if (!normalizedTranscript) return;

      let bestIndex = 0;
      let bestScore = 0;

      comparableUnits.forEach((unit) => {
        const snippet = unit.normalized;
        if (!snippet) return;
        const sample = snippet.split(' ').slice(0, 8).join(' ');
        if (sample.length < 8) return;

        if (normalizedTranscript.includes(sample)) {
          const score = sample.length;
          if (score > bestScore) {
            bestScore = score;
            bestIndex = unit.index;
          }
        }
      });

      if (bestScore > 0) {
        setSpokenProgressLine(bestIndex);
        const area = scrollAreaRef.current;
        const content = contentRef.current;
        if (area && content) {
          const ratio = comparableUnits.length > 1 ? bestIndex / comparableUnits.length : 0;
          const targetScroll = ratio * (content.scrollHeight - area.clientHeight);
          area.scrollTo({ top: Math.max(0, targetScroll - area.clientHeight * 0.2), behavior: 'smooth' });
          setStatusText('Voice-paced active');
        }
      }
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setStatusText('Voice input error');
    };

    recognition.onend = () => {
      if (voiceMode && isPlaying) {
        try {
          recognition.start();
        } catch {
          setVoiceListening(false);
        }
      } else {
        setVoiceListening(false);
      }
    };

    recognitionRef.current = recognition;
    transcriptRef.current = '';

    try {
      recognition.start();
      setVoiceListening(true);
      setStatusText('Listening for speech');
    } catch {
      setVoiceListening(false);
      setStatusText('Unable to start microphone');
    }
  }, [comparableUnits, isPlaying, voiceMode]);

  const stopVoiceRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceListening(false);
  }, []);

  useEffect(() => {
    if (voiceMode && isPlaying && voiceSupported) startVoiceRecognition();
    else stopVoiceRecognition();

    return () => stopVoiceRecognition();
  }, [voiceMode, isPlaying, voiceSupported, startVoiceRecognition, stopVoiceRecognition]);

  const startPlayback = useCallback(() => {
    if (countdown > 0) {
      setCountdownLeft(countdown);
      setStatusText(`Starting in ${countdown}s`);
      return;
    }
    setIsPlaying(true);
    setStatusText(voiceMode ? 'Voice-paced active' : 'Playing');
  }, [countdown, voiceMode]);

  const pausePlayback = useCallback(() => {
    setCountdownLeft(0);
    setIsPlaying(false);
    setStatusText('Paused');
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying || countdownLeft > 0) pausePlayback();
    else startPlayback();
  }, [countdownLeft, isPlaying, pausePlayback, startPlayback]);

  const resetScroll = useCallback(() => {
    setCountdownLeft(0);
    setIsPlaying(false);
    setSpokenProgressLine(0);
    transcriptRef.current = '';
    const area = scrollAreaRef.current;
    if (area) area.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusText('Reset to top');
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setStatusText('Fullscreen unavailable');
    }
  }, []);

  const handleSaveScript = useCallback(() => {
    const trimmedName = saveName.trim() || `Script ${savedScripts.length + 1}`;
    const entry: SavedScript = {
      id: crypto.randomUUID(),
      name: trimmedName,
      content: script,
      updatedAt: new Date().toISOString(),
    };
    setSavedScripts((prev) => [entry, ...prev]);
    setSaveName('');
    setStatusText(`Saved "${trimmedName}"`);
  }, [saveName, savedScripts.length, script]);

  const loadScript = useCallback((entry: SavedScript) => {
    setScript(entry.content);
    setStatusText(`Loaded "${entry.name}"`);
  }, []);

  const deleteScript = useCallback((id: string) => {
    setSavedScripts((prev) => prev.filter((item) => item.id !== id));
    setStatusText('Saved script deleted');
  }, []);

  const copyScript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(script);
      setStatusText('Script copied');
    } catch {
      setStatusText('Copy failed');
    }
  }, [script]);

  const importFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setScript(text || DEFAULT_SCRIPT);
      setStatusText(`Imported ${file.name}`);
    };
    reader.readAsText(file);
  }, []);

  const jumpToCue = useCallback((cue: CuePoint) => {
    setActiveCueId(cue.id);
    const area = scrollAreaRef.current;
    const content = contentRef.current;
    if (!area || !content) return;

    const lines = Math.max(1, script.split('\n').length);
    const ratio = cue.lineIndex / lines;
    const targetScroll = ratio * (content.scrollHeight - area.clientHeight);
    area.scrollTo({ top: Math.max(0, targetScroll - area.clientHeight * 0.25), behavior: 'smooth' });
    setStatusText(`Jumped to ${cue.label}`);
  }, [script]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (isTyping) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSpeed((prev) => Math.min(prev + 4, 160));
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSpeed((prev) => Math.max(prev - 4, 8));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollAreaRef.current?.scrollBy({ top: 120, behavior: 'smooth' });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollAreaRef.current?.scrollBy({ top: -120, behavior: 'smooth' });
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowControls((prev) => !prev);
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetScroll();
      }
      if (e.key.toLowerCase() === 'm' && voiceSupported) {
        e.preventDefault();
        setVoiceMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetScroll, toggleFullscreen, togglePlayback, voiceSupported]);

  const focusTopHeight = `${(100 - focusHeight) / 2}%`;

  return (
    <main
      className="teleprompter-shell"
      onMouseMove={() => {
        setCompactPanel(false);
        resetHideControlsTimer();
      }}
    >
      <div className="teleprompter-layout">
        {showControls && (
          <aside className={`sidebar ${compactPanel ? 'compact' : ''}`}>
            <div className="sidebar-inner">
              <div className="sidebar-header">
                <div className={`header-copy ${compactPanel ? 'hidden' : ''}`}>
                  <div className="brand">
                    <div className="brand-icon"><Camera size={20} /></div>
                    <div>
                      <h1 className="brand-title">Personal Teleprompter</h1>
                      <p className="brand-subtitle">Pure CSS, Vercel-safe, with voice pacing and cue jumps</p>
                    </div>
                  </div>
                </div>
                <button className="ui-button" onClick={() => setCompactPanel((prev) => !prev)} aria-label="Toggle panel width">
                  {compactPanel ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              </div>

              <div className="sidebar-scroll">
                <section className="section-card">
                  <div className="section-head">
                    {!compactPanel && (
                      <div>
                        <h2 className="section-title">Playback</h2>
                        <p className="section-subtitle">Fast live control while recording</p>
                      </div>
                    )}
                    <Settings2 size={16} />
                  </div>

                  <div className="icon-button-grid">
                    <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback} />
                    <IconButton icon={RotateCcw} label="Reset" onClick={resetScroll} />
                    <IconButton icon={isFullscreen ? Minimize : Maximize} label="Full" onClick={toggleFullscreen} />
                    <IconButton icon={showStats ? EyeOff : Eye} label={showStats ? 'Hide info' : 'Show info'} onClick={() => setShowStats((prev) => !prev)} />
                  </div>

                  {!compactPanel && (
                    <div className="stack" style={{ marginTop: 16 }}>
                      <SliderRow label={`Speed · ${speed}px/s`} min={8} max={160} step={1} value={speed} onChange={setSpeed} />
                      <SliderRow label={`Countdown · ${countdown}s`} min={0} max={10} step={1} value={countdown} onChange={setCountdown} />
                    </div>
                  )}
                </section>

                {!compactPanel && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">Voice pace</h2>
                        <p className="section-subtitle">Scroll based on your spoken script when supported</p>
                      </div>
                      {voiceListening ? <Mic size={16} /> : <MicOff size={16} />}
                    </div>
                    <button
                      className={`ui-button icon ${voiceMode && voiceSupported ? 'active' : ''}`}
                      onClick={() => voiceSupported && setVoiceMode((prev) => !prev)}
                      disabled={!voiceSupported}
                      style={{ width: '100%' }}
                    >
                      {voiceListening ? <Mic size={16} /> : <MicOff size={16} />}
                      <span>{voiceSupported ? `Voice-paced auto-scroll${voiceListening ? ' (live)' : ''}` : 'Voice-paced auto-scroll unavailable'}</span>
                    </button>
                  </section>
                )}

                {!compactPanel && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">Text layout</h2>
                        <p className="section-subtitle">Tune readability to match your lens distance</p>
                      </div>
                      <Type size={16} />
                    </div>
                    <div className="stack">
                      <SliderRow label={`Font size · ${fontSize}px`} min={24} max={88} step={1} value={fontSize} onChange={setFontSize} />
                      <SliderRow label={`Line height · ${lineHeight.toFixed(2)}`} min={1} max={2.3} step={0.05} value={lineHeight} onChange={setLineHeight} />
                      <SliderRow label={`Text width · ${textWidth}%`} min={45} max={100} step={1} value={textWidth} onChange={setTextWidth} />
                      <SliderRow label={`Top/Bottom padding · ${paddingY}vh`} min={8} max={35} step={1} value={paddingY} onChange={setPaddingY} />
                    </div>
                  </section>
                )}

                {!compactPanel && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">Camera assist</h2>
                        <p className="section-subtitle">Optimized for glass rigs and phone setups</p>
                      </div>
                      <ScanLine size={16} />
                    </div>
                    <div className="inline-grid-two">
                      <ToggleButton label="Mirror horizontal" icon={FlipHorizontal} active={mirrorH} onClick={() => setMirrorH((v) => !v)} />
                      <ToggleButton label="Mirror vertical" icon={FlipVertical} active={mirrorV} onClick={() => setMirrorV((v) => !v)} />
                      <ToggleButton label="Focus guide" icon={ChevronsUpDown} active={focusMode} onClick={() => setFocusMode((v) => !v)} />
                      <ToggleButton label="Dark mode" icon={darkMode ? MoonStar : SunMedium} active={darkMode} onClick={() => setDarkMode((v) => !v)} />
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <SliderRow label={`Focus band · ${focusHeight}%`} min={16} max={60} step={1} value={focusHeight} onChange={setFocusHeight} />
                    </div>
                  </section>
                )}

                {!compactPanel && cuePoints.length > 0 && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">Cue points</h2>
                        <p className="section-subtitle">Jump instantly between sections</p>
                      </div>
                      <Bookmark size={16} />
                    </div>
                    <div className="cue-list">
                      {cuePoints.map((cue) => (
                        <button
                          key={cue.id}
                          className={`cue-button ${activeCueId === cue.id ? 'active' : ''}`}
                          onClick={() => jumpToCue(cue)}
                        >
                          {cue.label}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {!compactPanel && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <h2 className="section-title">Script</h2>
                        <p className="section-subtitle">Use [Intro], [Section 2], or [Cue: closing] on their own line</p>
                      </div>
                      <Save size={16} />
                    </div>

                    <textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      className="textarea"
                      placeholder="Paste your script here"
                    />

                    <div className="row wrap" style={{ marginTop: 12 }}>
                      <button className="ui-button copy-accent" onClick={copyScript}>
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Copy size={16} /> Copy</span>
                      </button>
                      <label className="ui-button file-label">
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Upload size={16} /> Import .txt</span>
                        <input
                          type="file"
                          accept=".txt,text/plain"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) importFile(file);
                          }}
                        />
                      </label>
                    </div>

                    <div className="row" style={{ marginTop: 16 }}>
                      <input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        className="input flex-1"
                        placeholder="Save as"
                      />
                      <button className="ui-button save-primary" onClick={handleSaveScript}>Save</button>
                    </div>
                  </section>
                )}

                {!compactPanel && (
                  <section className="section-card">
                    <h2 className="section-title" style={{ marginBottom: 12 }}>Saved scripts</h2>
                    <div className="saved-list">
                      {savedScripts.length === 0 && <p className="muted">No saved scripts yet.</p>}
                      {savedScripts.map((entry) => (
                        <div key={entry.id} className="saved-item">
                          <div className="saved-item-head">
                            <div style={{ minWidth: 0 }}>
                              <button onClick={() => loadScript(entry)} className="saved-name">{entry.name}</button>
                              <div className="saved-time">{new Date(entry.updatedAt).toLocaleString()}</div>
                            </div>
                            <button onClick={() => deleteScript(entry.id)} className="ui-button delete-soft">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </aside>
        )}

        <section className="stage">
          <div className="stage-toolbar-left">
            {!showControls ? (
              <button className="top-toggle" onClick={() => setShowControls(true)}>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><PanelLeftOpen size={16} /> Show controls</span>
              </button>
            ) : (
              <button className="top-toggle" onClick={() => setShowControls(false)}>
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><PanelLeftClose size={16} /> Hide controls</span>
              </button>
            )}
          </div>

          {showStats && (
            <div className="stage-toolbar-right">
              <StatPill label="Words" value={String(totalWords)} />
              <StatPill label="Read time" value={`${estimatedMinutes} min`} />
              <StatPill label="Status" value={countdownLeft > 0 ? `${countdownLeft}s` : statusText} />
              <StatPill label="Speed" value={voiceMode ? 'Voice' : `${speed}px/s`} />
            </div>
          )}

          {countdownLeft > 0 && (
            <div className="countdown-overlay">
              <div className="countdown-card">
                <div className="countdown-icon"><Clock3 size={32} /></div>
                <div className="countdown-label">Starting in</div>
                <div className="countdown-number">{countdownLeft}</div>
              </div>
            </div>
          )}

          <div ref={scrollAreaRef} className="scroll-area">
            <div
              ref={contentRef}
              className="script-wrap"
              style={{
                width: `${textWidth}%`,
                paddingTop: `${paddingY}vh`,
                paddingBottom: `${paddingY}vh`,
                transform: `${mirrorH ? 'scaleX(-1)' : ''} ${mirrorV ? 'scaleY(-1)' : ''}`.trim(),
                transformOrigin: 'center center',
              }}
            >
              <div
                className="script-text"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight,
                }}
              >
                {script || 'Your script will appear here.'}
              </div>
            </div>
          </div>

          {voiceMode && voiceListening && (
            <div className="voice-pill">
              <Mic size={16} />
              Following your voice
            </div>
          )}

          {voiceMode && showStats && (
            <div className="progress-pill">
              Approx line progress: {spokenProgressLine}
            </div>
          )}

          {focusMode && (
            <>
              <div
                className="focus-mask focus-top"
                style={{
                  height: focusTopHeight,
                  background: darkMode
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0.38))'
                    : 'linear-gradient(to bottom, rgba(255,255,255,0.82), rgba(255,255,255,0.42))',
                }}
              />
              <div
                className="focus-mask focus-bottom"
                style={{
                  height: focusTopHeight,
                  background: darkMode
                    ? 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.38))'
                    : 'linear-gradient(to top, rgba(255,255,255,0.82), rgba(255,255,255,0.42))',
                }}
              />
              <div className="focus-window" style={{ height: `${focusHeight}%` }} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type IconButtonProps = {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
};

function IconButton({ icon: Icon, label, onClick }: IconButtonProps) {
  return (
    <button onClick={onClick} className="ui-button icon">
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

type ToggleButtonProps = {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  onClick: () => void;
};

function ToggleButton({ label, icon: Icon, active, onClick }: ToggleButtonProps) {
  return (
    <button onClick={onClick} className={`ui-button icon ${active ? 'active' : ''}`} style={{ justifyContent: 'flex-start' }}>
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

type SliderRowProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
  return (
    <div className="slider-row">
      <div className="slider-label">{label}</div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-pill">
      <div className="stat-pill-label">{label}</div>
      <div className="stat-pill-value">{value}</div>
    </div>
  );
}
