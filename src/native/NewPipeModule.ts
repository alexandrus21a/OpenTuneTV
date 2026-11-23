import { NativeModules } from 'react-native';
import type { Shelf, Track } from '../types';

/**
 * Typed JS wrapper around the native NewPipeModule (see
 * android/app/src/main/java/com/opentunern/newpipe/NewPipeModule.kt) —
 * the bridge is JSON strings in both directions; parsing lives here so
 * the rest of the app only ever sees typed Shelf/Track data.
 */
const { NewPipeModule } = NativeModules as {
  NewPipeModule: {
    loadShelves(): Promise<string>;
    resolveMixQueue(playlistId: string): Promise<string>;
    searchTracks(query: string): Promise<string>;
    resolveAudioStream(videoId: string): Promise<string | null>;
    resolveCanvas(videoId: string, quality: string): Promise<string | null>;
  };
};

export interface ResolvedAudio {
  streamUrl: string;
  durationSeconds: number;
  mimeType: string;
}

export interface ResolvedCanvas {
  streamUrl: string;
  durationSeconds: number;
}

export async function loadShelves(): Promise<Shelf[]> {
  const json = await NewPipeModule.loadShelves();
  return JSON.parse(json) as Shelf[];
}

export async function resolveMixQueue(playlistId: string): Promise<Track[]> {
  const json = await NewPipeModule.resolveMixQueue(playlistId);
  return JSON.parse(json) as Track[];
}

export async function searchTracks(query: string): Promise<Track[]> {
  const json = await NewPipeModule.searchTracks(query);
  return JSON.parse(json) as Track[];
}

export async function resolveAudioStream(
  videoId: string,
): Promise<ResolvedAudio | null> {
  const json = await NewPipeModule.resolveAudioStream(videoId);
  return json ? (JSON.parse(json) as ResolvedAudio) : null;
}

export async function resolveCanvas(
  videoId: string,
  quality: 'low' | 'high' = 'low',
): Promise<ResolvedCanvas | null> {
  const json = await NewPipeModule.resolveCanvas(videoId, quality);
  return json ? (JSON.parse(json) as ResolvedCanvas) : null;
}
