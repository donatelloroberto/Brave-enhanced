import { useState } from "react";
import { usePlayerStore } from "@/store/use-player-store";
import { useGetPlaylist, useAddToPlaylist, useRemoveFromPlaylist } from "@workspace/api-client-react";
import type { VideoSource, PlaylistEntry } from "@workspace/api-client-react";
import { cn, formatTime } from "@/lib/utils";
import { Play, BookmarkPlus, Trash2, MonitorPlay, ListVideo, Library, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function PlaylistSidebar() {
  const { detectedVideos, currentVideo, setCurrentVideo, isSidebarOpen } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<'detected' | 'saved'>('detected');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: playlistData, isLoading: isLoadingPlaylist } = useGetPlaylist();
  
  const addMutation = useAddToPlaylist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/playlist"] });
        toast({ title: "Saved to playlist" });
      }
    }
  });

  const removeMutation = useRemoveFromPlaylist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/playlist"] });
        toast({ title: "Removed from playlist" });
      }
    }
  });

  const handlePlay = (video: VideoSource | PlaylistEntry) => {
    setCurrentVideo(video);
  };

  const handleSave = (video: VideoSource, e: React.MouseEvent) => {
    e.stopPropagation();
    addMutation.mutate({
      data: {
        url: video.url,
        type: video.type,
        title: video.title,
        quality: video.quality,
        duration: video.duration,
        thumbnail: video.thumbnail,
        sourceHost: video.sourceHost,
      }
    });
  };

  const handleRemove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeMutation.mutate({ id });
  };

  return (
    <AnimatePresence initial={false}>
      {isSidebarOpen && (
        <motion.div 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="h-full border-r border-white/5 bg-card flex flex-col z-20 shrink-0 overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 pb-2">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2 text-foreground mb-6">
              <MonitorPlay className="h-6 w-6 text-primary" />
              BrowseHere
            </h2>
            
            {/* Tabs */}
            <div className="flex bg-secondary/50 rounded-lg p-1 backdrop-blur-sm border border-white/5">
              <button
                onClick={() => setActiveTab('detected')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-300",
                  activeTab === 'detected' 
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,212,255,0.3)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <ListVideo className="h-4 w-4" />
                Detected
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all duration-300",
                  activeTab === 'saved' 
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,212,255,0.3)]" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Library className="h-4 w-4" />
                Saved ({playlistData?.count || 0})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {activeTab === 'detected' && (
              detectedVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-4">
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center border border-white/5">
                    <Search className="h-8 w-8 text-primary/50" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">No videos detected</p>
                    <p className="text-sm">Scan a webpage URL to find streaming sources.</p>
                  </div>
                </div>
              ) : (
                detectedVideos.map((video, idx) => {
                  const isPlaying = currentVideo?.url === video.url;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={idx}
                      onClick={() => handlePlay(video)}
                      className={cn(
                        "group relative p-3 rounded-xl border cursor-pointer transition-all duration-300 overflow-hidden",
                        isPlaying 
                          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,212,255,0.15)]" 
                          : "bg-secondary/30 border-white/5 hover:bg-secondary/60 hover:border-white/10 hover:-translate-y-0.5 hover:shadow-lg"
                      )}
                    >
                      <div className="flex gap-3 relative z-10">
                        <div className="w-24 h-16 shrink-0 bg-background rounded-lg overflow-hidden relative border border-white/5 flex items-center justify-center">
                          {video.thumbnail ? (
                            <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <MonitorPlay className="h-6 w-6 text-muted-foreground/50" />
                          )}
                          <div className={cn(
                            "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
                            isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                            {isPlaying ? (
                              <div className="flex gap-1">
                                <span className="w-1 h-3 bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-4 bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 h-2 bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <Play className="h-6 w-6 text-white fill-white" />
                            )}
                          </div>
                          {video.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-white/90">
                              {formatTime(video.duration)}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className={cn(
                            "font-medium text-sm line-clamp-2 transition-colors",
                            isPlaying ? "text-primary" : "text-foreground group-hover:text-primary/90"
                          )}>
                            {video.title || "Unknown Video Stream"}
                          </h4>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-2 items-center">
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/70">
                                {video.type}
                              </span>
                              {video.quality && (
                                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                                  {video.quality}
                                </span>
                              )}
                            </div>
                            
                            <button 
                              onClick={(e) => handleSave(video, e)}
                              className="p-1.5 rounded-md text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                              title="Save to Playlist"
                            >
                              <BookmarkPlus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )
            )}

            {activeTab === 'saved' && (
              isLoadingPlaylist ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !playlistData?.entries?.length ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-4">
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center border border-white/5">
                    <Library className="h-8 w-8 text-primary/50" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground mb-1">Your playlist is empty</p>
                    <p className="text-sm">Save videos you want to watch later.</p>
                  </div>
                </div>
              ) : (
                playlistData.entries.map((entry, idx) => {
                  const isPlaying = currentVideo?.id === entry.id;
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      key={entry.id}
                      onClick={() => handlePlay(entry)}
                      className={cn(
                        "group relative p-3 rounded-xl border cursor-pointer transition-all duration-300",
                        isPlaying 
                          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,212,255,0.15)]" 
                          : "bg-secondary/30 border-white/5 hover:bg-secondary/60 hover:border-white/10 hover:shadow-lg"
                      )}
                    >
                      <div className="flex gap-3 relative z-10">
                        <div className="w-20 h-20 shrink-0 bg-background rounded-lg overflow-hidden relative border border-white/5">
                           {entry.thumbnail ? (
                            <img src={entry.thumbnail} alt={entry.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <MonitorPlay className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                          <div className={cn(
                            "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
                            isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}>
                             <Play className="h-6 w-6 text-white fill-white" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <h4 className={cn(
                            "font-medium text-sm line-clamp-2 transition-colors",
                            isPlaying ? "text-primary" : "text-foreground group-hover:text-primary/90"
                          )}>
                            {entry.title}
                          </h4>
                          
                          <div className="flex flex-col gap-1.5 mt-2">
                            <span className="text-xs text-muted-foreground truncate w-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0"/>
                              {entry.sourceHost}
                            </span>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                {entry.type}
                              </span>
                              
                              <button 
                                onClick={(e) => handleRemove(entry.id, e)}
                                disabled={removeMutation.isPending}
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors disabled:opacity-50"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
