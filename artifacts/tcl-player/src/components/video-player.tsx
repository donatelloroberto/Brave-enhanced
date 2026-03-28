import { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import { usePlayerStore } from "@/store/use-player-store";
import { formatTime, cn } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Subtitles, Rewind, FastForward, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function VideoPlayer() {
  const { currentVideo, isSidebarOpen, toggleSidebar } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Init Video Source
  useEffect(() => {
    if (!videoRef.current || !currentVideo) return;
    
    setIsWaiting(true);
    setIsPlaying(false);
    setProgress(0);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentVideo.type === "hls" && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        enableWorker: true,
      });
      hlsRef.current = hls;
      
      hls.loadSource(currentVideo.url);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsWaiting(false);
        videoRef.current?.play().catch(e => console.warn("Auto-play prevented", e));
      });
      
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else {
      // Native fallback (MP4, WebM, or native HLS on Safari)
      videoRef.current.src = currentVideo.url;
      videoRef.current.load();
      videoRef.current.play().catch(e => console.warn("Auto-play prevented", e));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentVideo?.url, currentVideo?.type]);

  // Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsWaiting(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsWaiting(true);
    const handlePlaying = () => setIsWaiting(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      
      if (!currentVideo) return;

      switch(e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowright":
          e.preventDefault();
          handleSeekDelta(10);
          break;
        case "arrowleft":
          e.preventDefault();
          handleSeekDelta(-10);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentVideo]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Idle controls hiding
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      handleMouseMove();
    }
  }, [isPlaying, handleMouseMove]);


  // Actions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (Number(e.target.value) / 100) * duration;
    if (videoRef.current) videoRef.current.currentTime = newTime;
    setProgress(Number(e.target.value));
  };

  const handleSeekDelta = (delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += delta;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      if (isMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error("Error attempting to enable full-screen mode:", err.message));
    } else {
      document.exitFullscreen();
    }
  };

  if (!currentVideo) {
    return (
      <div className="flex-1 h-full relative bg-black flex flex-col items-center justify-center text-center z-0 overflow-hidden">
        {/* Background Graphic */}
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/tv-glow-bg.png`} 
            alt="Standby" 
            className="w-full h-full object-cover opacity-40 mix-blend-screen"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
        
        <div className="relative z-10 space-y-6 max-w-lg px-6">
          <div className="w-24 h-24 mx-auto bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 tv-glow">
            <MonitorPlay className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-white drop-shadow-lg">
            Ready to Stream
          </h1>
          <p className="text-lg text-muted-foreground/80 font-light">
            Scan a webpage using the URL bar to discover videos, or pick one from your saved playlist to start watching.
          </p>
        </div>
      </div>
    );
  }

  // Iframe support
  if (currentVideo.type === "iframe") {
    return (
      <div className="flex-1 h-full bg-black relative flex flex-col">
        <div className="absolute top-4 left-4 z-50">
          <button 
            onClick={toggleSidebar}
            className="p-2 bg-black/50 hover:bg-primary/80 text-white rounded-lg backdrop-blur-md transition-all"
          >
            {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
        </div>
        <iframe 
          src={currentVideo.url} 
          className="w-full h-full border-none flex-1"
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 h-full bg-black relative group flex flex-col focus:outline-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {isWaiting && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Loader2 className="h-16 w-16 text-primary animate-spin drop-shadow-xl" />
        </div>
      )}

      {/* Top Bar - Title & Sidebar Toggle */}
      <div className={cn(
        "absolute top-0 inset-x-0 p-6 pt-8 bg-gradient-to-b from-black/80 to-transparent flex items-start justify-between z-20 transition-all duration-500",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleSidebar}
            className="p-2 bg-white/5 hover:bg-primary text-white rounded-lg backdrop-blur-md transition-all hover:shadow-[0_0_15px_rgba(0,212,255,0.5)]"
          >
            {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
          <div>
            <h2 className="text-xl font-display font-semibold text-white text-shadow-sm line-clamp-1">
              {currentVideo.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase font-bold tracking-wider">
                {currentVideo.type}
              </span>
              <span className="text-sm text-white/60">
                {currentVideo.sourceHost}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={cn(
        "absolute bottom-0 inset-x-0 px-6 py-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-20 transition-all duration-500 flex flex-col gap-4",
        showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-4 w-full">
          <span className="text-xs font-medium font-mono text-white/80 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative flex items-center h-4 group/slider cursor-pointer">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              className="player-slider relative z-10"
            />
            {/* Filled track overlay */}
            <div 
              className="absolute left-0 h-1.5 bg-primary rounded-l-full pointer-events-none shadow-[0_0_10px_rgba(0,212,255,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium font-mono text-white/50 w-12">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(0,212,255,0.6)]"
            >
              {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-1" />}
            </button>
            
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <button onClick={() => handleSeekDelta(-10)} className="text-white/70 hover:text-white transition-colors" title="Rewind 10s">
                <Rewind className="h-6 w-6" />
              </button>
              <button onClick={() => handleSeekDelta(10)} className="text-white/70 hover:text-white transition-colors" title="Forward 10s">
                <FastForward className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 border-l border-white/10 pl-6 group/vol">
              <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300 ease-out flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="player-slider w-20"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="text-white/70 hover:text-white transition-colors" title="Subtitles (Mock)">
              <Subtitles className="h-5 w-5" />
            </button>
            <button className="text-white/70 hover:text-white transition-colors" title="Settings (Mock)">
              <Settings className="h-5 w-5" />
            </button>
            <button onClick={toggleFullscreen} className="text-white/70 hover:text-white transition-colors" title="Fullscreen">
              {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
