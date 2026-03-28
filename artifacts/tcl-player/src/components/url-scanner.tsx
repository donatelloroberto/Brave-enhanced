import { useState } from "react";
import { useDetectVideos } from "@workspace/api-client-react";
import { usePlayerStore } from "@/store/use-player-store";
import { Search, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function UrlScanner({ className }: { className?: string }) {
  const [url, setUrl] = useState("");
  const { setDetectedVideos } = usePlayerStore();
  const { toast } = useToast();
  
  const detectMutation = useDetectVideos({
    mutation: {
      onSuccess: (data) => {
        setDetectedVideos(data.videos);
        if (data.videos.length > 0) {
          toast({
            title: "Scan Complete",
            description: `Found ${data.videos.length} video sources.`,
          });
        } else {
          toast({
            title: "No Videos Found",
            description: "Could not detect any streaming sources on this page.",
            variant: "destructive",
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Scan Failed",
          description: error.error?.error || "Could not reach the provided URL.",
          variant: "destructive",
        });
      }
    }
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    // Add protocol if missing
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    detectMutation.mutate({ data: { url: targetUrl } });
  };

  return (
    <form 
      onSubmit={handleScan} 
      className={cn("flex items-center gap-2 p-4 bg-background/80 backdrop-blur-md border-b border-white/5", className)}
    >
      <div className="relative flex-1 group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <LinkIcon className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste webpage URL to scan..."
          className="w-full bg-secondary/50 border border-white/10 text-foreground text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block pl-10 p-3 transition-all duration-300 placeholder:text-muted-foreground outline-none"
        />
        <div className="absolute inset-0 -z-10 bg-primary/0 group-focus-within:bg-primary/5 blur-xl transition-all duration-500 rounded-xl" />
      </div>
      
      <button
        type="submit"
        disabled={detectMutation.isPending || !url.trim()}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:shadow-[0_0_25px_rgba(0,212,255,0.5)] disabled:opacity-50 disabled:shadow-none transition-all duration-300 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary"
      >
        {detectMutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Search className="h-5 w-5" />
        )}
        <span>Scan</span>
      </button>
    </form>
  );
}
