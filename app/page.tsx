'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Type,
  Upload,
  Eye,
  EyeOff,
  MoonStar,
  SunMedium,
  Copy,
  Save,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Clock3,
  ScanLine,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
} from 'lucide-react';

const DEFAULT_SCRIPT = `Welcome back.

This teleprompter is designed for direct-to-camera delivery so your eyeline stays natural and confident.

Paste your script, press play, and adjust the speed until it feels conversational.

Use the focus guide to keep only a few lines visible at a time. Mirror the text if you are using reflective glass in front of the camera.

Keyboard shortcuts:

Space = play or pause
Up / Down = change speed
Left / Right = scroll slightly
F = fullscreen
H = hide controls
R = reset scroll

You can also save multiple scripts locally in your browser.

Take a breath, smile lightly, and speak slower than you think you need to.

Let’s begin.`;

type SavedScript = {
  id: string;
  name: string;
  content: string;
  updatedAt: string;
};

const STORAGE_KEYS = {
  script: 'teleprompter_script_v1',
  settings: 'teleprompter_settings_v1',
  savedScripts: 'teleprompter_saved_scripts_v1',
};

export default function TeleprompterPage() {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

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

  const totalWords = useMemo(() => script.trim().split(/\s+/).filter(Boolean).length, [script]);
  const estimatedMinutes = useMemo(() => Math.max(1, Math.round((totalWords / 130) * 10) / 10), [totalWords]);

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
      })
    );
  }, [speed, fontSize, lineHeight, textWidth, paddingY, mirrorH, mirrorV, focusMode, focusHeight, countdown, darkMode, compactPanel, showStats]);

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

      const pixelsPerSecond = speed;
      area.scrollTop += (pixelsPerSecond * delta) / 1000;

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
    if (!isPlaying) {
      stopAnimation();
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
    return stopAnimation;
  }, [isPlaying, tick, stopAnimation]);

  useEffect(() => {
    if (countdownLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdownLeft((prev) => {
        if (prev <= 1) {
          setIsPlaying(true);
          setStatusText('Playing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdownLeft]);

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

  const startPlayback = useCallback(() => {
    if (countdown > 0) {
      setCountdownLeft(countdown);
      setStatusText(`Starting in ${countdown}s`);
      return;
    }
    setIsPlaying(true);
    setStatusText('Playing');
  }, [countdown]);

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
    const area = scrollAreaRef.current;
    if (area) area.scrollTo({ top: 0, behavior: 'smooth' });
    setStatusText('Reset to top');
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
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
    setStatusText(`Saved “${trimmedName}”`);
  }, [saveName, savedScripts.length, script]);

  const loadScript = useCallback((entry: SavedScript) => {
    setScript(entry.content);
    setStatusText(`Loaded “${entry.name}”`);
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
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetScroll, toggleFullscreen, togglePlayback]);

  const themeClasses = darkMode
    ? 'bg-neutral-950 text-white'
    : 'bg-neutral-100 text-neutral-900';

  const panelClasses = darkMode
    ? 'bg-white/6 border-white/10 backdrop-blur-xl'
    : 'bg-white/80 border-neutral-200 backdrop-blur-xl';

  const textColorClasses = darkMode ? 'text-white/75' : 'text-neutral-700';
  const mutedClasses = darkMode ? 'text-white/55' : 'text-neutral-500';
  const trackClasses = darkMode ? 'bg-white/10' : 'bg-neutral-200';
  const inputClasses = darkMode
    ? 'bg-black/25 border-white/10 text-white placeholder:text-white/30'
    : 'bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400';

  return (
    <main
      className={`min-h-screen w-full transition-colors duration-300 ${themeClasses}`}
      onMouseMove={() => {
        setCompactPanel(false);
        resetHideControlsTimer();
      }}
    >
      <div className="relative flex min-h-screen">
        {showControls && (
          <aside
            className={`z-30 border-r transition-all duration-300 ${panelClasses} ${compactPanel ? 'w-[86px]' : 'w-full max-w-md'} ${darkMode ? 'border-white/10' : 'border-neutral-200'}`}
          >
            <div className="flex h-full flex-col">
              <div className={`flex items-center justify-between border-b px-4 py-4 ${darkMode ? 'border-white/10' : 'border-neutral-200'}`}>
                <div className={`transition-all ${compactPanel ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-emerald-500/15 p-2 text-emerald-400">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold tracking-tight">Personal Teleprompter</h1>
                      <p className={`text-sm ${mutedClasses}`}>Designed for natural eye contact under-camera delivery</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setCompactPanel((prev) => !prev)}
                  className={`rounded-2xl border p-2 ${darkMode ? 'border-white/10 hover:bg-white/10' : 'border-neutral-200 hover:bg-neutral-100'}`}
                  aria-label="Toggle panel width"
                >
                  {compactPanel ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <section className={`rounded-3xl border p-4 ${panelClasses}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      {!compactPanel && (
                        <div>
                          <h2 className="font-medium">Playback</h2>
                          <p className={`text-sm ${mutedClasses}`}>Fast live control while recording</p>
                        </div>
                      )}
                      <Settings2 className="h-4 w-4 shrink-0" />
                    </div>

                    <div className={`grid gap-2 ${compactPanel ? 'grid-cols-1' : 'grid-cols-4'}`}>
                      <IconButton icon={isPlaying ? Pause : Play} label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlayback} />
                      <IconButton icon={RotateCcw} label="Reset" onClick={resetScroll} />
                      <IconButton icon={isFullscreen ? Minimize : Maximize} label="Full" onClick={toggleFullscreen} />
                      <IconButton icon={showStats ? EyeOff : Eye} label={showStats ? 'Hide info' : 'Show info'} onClick={() => setShowStats((prev) => !prev)} />
                    </div>

                    {!compactPanel && (
                      <div className="mt-4 space-y-4">
                        <SliderRow label={`Speed · ${speed}px/s`} min={8} max={160} step={1} value={speed} onChange={setSpeed} trackClasses={trackClasses} />
                        <SliderRow label={`Countdown · ${countdown}s`} min={0} max={10} step={1} value={countdown} onChange={setCountdown} trackClasses={trackClasses} />
                      </div>
                    )}
                  </section>

                  {!compactPanel && (
                    <section className={`rounded-3xl border p-4 ${panelClasses}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="font-medium">Text Layout</h2>
                          <p className={`text-sm ${mutedClasses}`}>Tune readability to match your lens distance</p>
                        </div>
                        <Type className="h-4 w-4" />
                      </div>
                      <div className="space-y-4">
                        <SliderRow label={`Font size · ${fontSize}px`} min={24} max={88} step={1} value={fontSize} onChange={setFontSize} trackClasses={trackClasses} />
                        <SliderRow label={`Line height · ${lineHeight.toFixed(2)}`} min={1} max={2.3} step={0.05} value={lineHeight} onChange={setLineHeight} trackClasses={trackClasses} />
                        <SliderRow label={`Text width · ${textWidth}%`} min={45} max={100} step={1} value={textWidth} onChange={setTextWidth} trackClasses={trackClasses} />
                        <SliderRow label={`Top/Bottom padding · ${paddingY}vh`} min={8} max={35} step={1} value={paddingY} onChange={setPaddingY} trackClasses={trackClasses} />
                      </div>
                    </section>
                  )}

                  {!compactPanel && (
                    <section className={`rounded-3xl border p-4 ${panelClasses}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="font-medium">Camera Assist</h2>
                          <p className={`text-sm ${mutedClasses}`}>Optimized for glass rigs and phone setups</p>
                        </div>
                        <ScanLine className="h-4 w-4" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ToggleButton label="Mirror horizontal" icon={FlipHorizontal} active={mirrorH} onClick={() => setMirrorH((v) => !v)} />
                        <ToggleButton label="Mirror vertical" icon={FlipVertical} active={mirrorV} onClick={() => setMirrorV((v) => !v)} />
                        <ToggleButton label="Focus guide" icon={ChevronsUpDown} active={focusMode} onClick={() => setFocusMode((v) => !v)} />
                        <ToggleButton label="Dark mode" icon={darkMode ? MoonStar : SunMedium} active={darkMode} onClick={() => setDarkMode((v) => !v)} />
                      </div>
                      <div className="mt-4">
                        <SliderRow label={`Focus band · ${focusHeight}%`} min={16} max={60} step={1} value={focusHeight} onChange={setFocusHeight} trackClasses={trackClasses} />
                      </div>
                    </section>
                  )}

                  {!compactPanel && (
                    <section className={`rounded-3xl border p-4 ${panelClasses}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h2 className="font-medium">Script</h2>
                          <p className={`text-sm ${mutedClasses}`}>Paste, edit, import, and save locally</p>
                        </div>
                        <Save className="h-4 w-4" />
                      </div>

                      <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        className={`min-h-[220px] w-full rounded-2xl border p-4 text-sm outline-none transition ${inputClasses}`}
                        placeholder="Paste your script here"
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={copyScript}
                          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/15"
                        >
                          <span className="inline-flex items-center gap-2"><Copy className="h-4 w-4" /> Copy</span>
                        </button>
                        <label className="cursor-pointer rounded-2xl border border-white/10 px-3 py-2 text-sm font-medium hover:bg-white/10">
                          <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> Import .txt</span>
                          <input
                            type="file"
                            accept=".txt,text/plain"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) importFile(file);
                            }}
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <input
                          value={saveName}
                          onChange={(e) => setSaveName(e.target.value)}
                          className={`flex-1 rounded-2xl border px-3 py-2 text-sm outline-none ${inputClasses}`}
                          placeholder="Save as"
                        />
                        <button
                          onClick={handleSaveScript}
                          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
                        >
                          Save
                        </button>
                      </div>
                    </section>
                  )}

                  {!compactPanel && (
                    <section className={`rounded-3xl border p-4 ${panelClasses}`}>
                      <h2 className="font-medium">Saved Scripts</h2>
                      <div className="mt-3 space-y-2">
                        {savedScripts.length === 0 && <p className={`text-sm ${mutedClasses}`}>No saved scripts yet.</p>}
                        {savedScripts.map((entry) => (
                          <div
                            key={entry.id}
                            className={`rounded-2xl border p-3 ${darkMode ? 'border-white/10 bg-black/15' : 'border-neutral-200 bg-white'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <button onClick={() => loadScript(entry)} className="truncate text-left font-medium hover:underline">
                                  {entry.name}
                                </button>
                                <p className={`mt-1 text-xs ${mutedClasses}`}>{new Date(entry.updatedAt).toLocaleString()}</p>
                              </div>
                              <button onClick={() => deleteScript(entry.id)} className="rounded-xl p-2 hover:bg-red-500/10 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        <section className="relative flex-1 overflow-hidden">
          <div className="absolute left-4 top-4 z-30 flex flex-wrap items-center gap-2">
            {!showControls && (
              <button
                onClick={() => setShowControls(true)}
                className={`rounded-2xl border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-black/35 hover:bg-black/50' : 'border-neutral-200 bg-white/80 hover:bg-white'}`}
              >
                <span className="inline-flex items-center gap-2"><PanelLeftOpen className="h-4 w-4" /> Show controls</span>
              </button>
            )}
            {showControls && (
              <button
                onClick={() => setShowControls(false)}
                className={`rounded-2xl border px-3 py-2 text-sm ${darkMode ? 'border-white/10 bg-black/35 hover:bg-black/50' : 'border-neutral-200 bg-white/80 hover:bg-white'}`}
              >
                <span className="inline-flex items-center gap-2"><PanelLeftClose className="h-4 w-4" /> Hide controls</span>
              </button>
            )}
          </div>

          {showStats && (
            <div className="absolute right-4 top-4 z-30 flex flex-wrap items-center gap-2">
              <StatPill label="Words" value={String(totalWords)} darkMode={darkMode} />
              <StatPill label="Read time" value={`${estimatedMinutes} min`} darkMode={darkMode} />
              <StatPill label="Status" value={countdownLeft > 0 ? `${countdownLeft}s` : statusText} darkMode={darkMode} />
              <StatPill label="Speed" value={`${speed}px/s`} darkMode={darkMode} />
            </div>
          )}

          {countdownLeft > 0 && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="rounded-[2rem] border border-white/10 bg-black/60 px-10 py-8 text-center text-white shadow-2xl">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <Clock3 className="h-8 w-8" />
                </div>
                <p className="text-sm uppercase tracking-[0.28em] text-white/50">Starting in</p>
                <p className="mt-2 text-6xl font-semibold tracking-tight">{countdownLeft}</p>
              </div>
            </div>
          )}

          <div
            ref={scrollAreaRef}
            className="relative h-screen overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div
              className="mx-auto"
              style={{
                width: `${textWidth}%`,
                paddingTop: `${paddingY}vh`,
                paddingBottom: `${paddingY}vh`,
                transform: `${mirrorH ? 'scaleX(-1)' : ''} ${mirrorV ? 'scaleY(-1)' : ''}`.trim(),
                transformOrigin: 'center center',
              }}
            >
              <div
                className={`whitespace-pre-wrap break-words text-center font-semibold tracking-tight ${textColorClasses}`}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight,
                }}
              >
                {script || 'Your script will appear here.'}
              </div>
            </div>
          </div>

          {focusMode && (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20"
                style={{
                  height: `${(100 - focusHeight) / 2}%`,
                  background: darkMode
                    ? 'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0.38))'
                    : 'linear-gradient(to bottom, rgba(255,255,255,0.82), rgba(255,255,255,0.42))',
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
                style={{
                  height: `${(100 - focusHeight) / 2}%`,
                  background: darkMode
                    ? 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.38))'
                    : 'linear-gradient(to top, rgba(255,255,255,0.82), rgba(255,255,255,0.42))',
                }}
              />
              <div
                className={`pointer-events-none absolute inset-x-8 top-1/2 z-20 -translate-y-1/2 rounded-[2rem] border ${darkMode ? 'border-white/10' : 'border-neutral-300'}`}
                style={{ height: `${focusHeight}%` }}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type IconButtonProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
};

function IconButton({ icon: Icon, label, onClick }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium transition hover:bg-white/10"
    >
      <span className="flex items-center justify-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </span>
    </button>
  );
}

type ToggleButtonProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
};

function ToggleButton({ label, icon: Icon, active, onClick }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
        active ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-400' : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </span>
    </button>
  );
}

type SliderRowProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: any) => void;
  trackClasses: string;
};

function SliderRow({ label, min, max, step, value, onChange, trackClasses }: SliderRowProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-2 w-full cursor-pointer appearance-none rounded-full ${trackClasses}`}
      />
    </div>
  );
}

function StatPill({ label, value, darkMode }: { label: string; value: string; darkMode: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2 backdrop-blur-xl ${darkMode ? 'border-white/10 bg-black/35 text-white' : 'border-neutral-200 bg-white/85 text-neutral-900'}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] opacity-55">{label}</div>
      <div className="text-sm font-semibold tracking-tight">{value}</div>
    </div>
  );
}
