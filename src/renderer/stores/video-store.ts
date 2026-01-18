// src/renderer/stores/video-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface VideoFile {
  id: string;
  filename: string;
  filepath: string;
  duration: number;
  size: number;
  format: string;
  resolution?: string;
  fps?: number;
  audioCodec?: string;
  videoCodec?: string;
  createdAt: Date;
  updatedAt: Date;
  thumbnailPath?: string;
}

interface VideoStore {
  videos: VideoFile[];
  selectedVideoId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadVideos: () => Promise<void>;
  importVideos: () => Promise<void>;
  selectVideo: (id: string) => void;
  deleteVideo: (id: string) => Promise<void>;
  getSelectedVideo: () => VideoFile | null;
  clearError: () => void;
}

export const useVideoStore = create<VideoStore>()(
  devtools(
    (set, get) => ({
      videos: [],
      selectedVideoId: null,
      isLoading: false,
      error: null,

      loadVideos: async () => {
        set({ isLoading: true, error: null });

        try {
          const videos = await window.api.video.list();
          set({ videos, isLoading: false });
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      importVideos: async () => {
        set({ isLoading: true, error: null });

        try {
          const importedVideos = await window.api.video.import();

          if (importedVideos && importedVideos.length > 0) {
            set((state) => ({
              videos: [...state.videos, ...importedVideos],
              isLoading: false,
            }));
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      selectVideo: (id: string) => {
        set((state) => ({
          selectedVideoId: state.selectedVideoId === id ? null : id,
        }));
      },

      deleteVideo: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          await window.api.video.delete(id);

          set((state) => ({
            videos: state.videos.filter((v) => v.id !== id),
            selectedVideoId:
              state.selectedVideoId === id ? null : state.selectedVideoId,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: (error as Error).message,
            isLoading: false,
          });
        }
      },

      getSelectedVideo: () => {
        const state = get();
        return (
          state.videos.find((v) => v.id === state.selectedVideoId) || null
        );
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    { name: 'VideoStore' }
  )
);
