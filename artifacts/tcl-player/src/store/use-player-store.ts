import { create } from "zustand";
import type { VideoSource, PlaylistEntry } from "@workspace/api-client-react";

type PlayableVideo = VideoSource | PlaylistEntry;

interface PlayerState {
  currentVideo: PlayableVideo | null;
  detectedVideos: VideoSource[];
  isSidebarOpen: boolean;
  
  setCurrentVideo: (video: PlayableVideo | null) => void;
  setDetectedVideos: (videos: VideoSource[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentVideo: null,
  detectedVideos: [],
  isSidebarOpen: true,

  setCurrentVideo: (video) => set({ currentVideo: video }),
  setDetectedVideos: (videos) => set({ detectedVideos: videos }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
