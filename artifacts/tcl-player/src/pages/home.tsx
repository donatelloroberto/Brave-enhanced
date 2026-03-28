import { UrlScanner } from "@/components/url-scanner";
import { PlaylistSidebar } from "@/components/playlist-sidebar";
import { VideoPlayer } from "@/components/video-player";

export default function Home() {
  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <PlaylistSidebar />
        
        <main className="flex-1 flex flex-col relative z-10 min-w-0">
          <UrlScanner className="z-30 relative" />
          <VideoPlayer />
        </main>
      </div>
    </div>
  );
}
