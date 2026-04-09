/**
 * BGM Manager — handles background music playback, crossfading, and looping.
 *
 * Uses Phaser's sound manager for playback of preloaded audio assets.
 * Provides smooth crossfading between tracks (e.g. stage → boss transition).
 */

import Phaser from 'phaser';

export type BGMTrack = 'title' | 'stage1' | 'stage2' | 'boss' | null;

const TRACK_KEYS: Record<Exclude<BGMTrack, null>, string> = {
  title:  'bgm-title',
  stage1: 'bgm-stage1',
  stage2: 'bgm-stage2',
  boss:   'bgm-boss',
};

const DEFAULT_VOLUME = 0.45;
const FADE_MS = 800;

class BGMManager {
  private scene: Phaser.Scene | null = null;
  private current: Phaser.Sound.BaseSound | null = null;
  private currentTrack: BGMTrack = null;
  private volume = DEFAULT_VOLUME;

  /** Bind to a scene so we can access its sound manager. Call once per scene. */
  bind(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Play a track. If the same track is already playing, do nothing.
   * If a different track is playing, crossfade to the new one.
   * Pass `null` to stop all music.
   */
  play(track: BGMTrack, fadeMs = FADE_MS): void {
    if (!this.scene) return;

    // Already playing this track — no-op
    if (track === this.currentTrack && this.current) return;

    // Fade out current track
    if (this.current) {
      const old = this.current;
      if (this.scene.tweens && 'volume' in old) {
        this.scene.tweens.add({
          targets: old,
          volume: 0,
          duration: fadeMs,
          onComplete: () => {
            old.stop();
            old.destroy();
          },
        });
      } else {
        old.stop();
        old.destroy();
      }
      this.current = null;
      this.currentTrack = null;
    }

    if (!track) return;

    const key = TRACK_KEYS[track];
    if (!this.scene.cache.audio.exists(key)) {
      // Track not loaded — silently skip (e.g. assets missing)
      return;
    }

    const music = this.scene.sound.add(key, {
      loop: true,
      volume: 0,
    });
    music.play();

    // Fade in
    this.scene.tweens.add({
      targets: music,
      volume: this.volume,
      duration: fadeMs,
    });

    this.current = music;
    this.currentTrack = track;
  }

  /** Stop music with optional fade. */
  stop(fadeMs = FADE_MS): void {
    this.play(null, fadeMs);
  }

  /** Set BGM volume (0-1). Affects current and future tracks. */
  setVolume(v: number): void {
    this.volume = Phaser.Math.Clamp(v, 0, 1);
    if (this.current && 'volume' in this.current) {
      (this.current as Phaser.Sound.WebAudioSound).setVolume(this.volume);
    }
  }

  /** Get current volume. */
  getVolume(): number {
    return this.volume;
  }

  /** Whether any track is currently playing. */
  get isPlaying(): boolean {
    return this.current !== null && this.current.isPlaying;
  }

  /** The currently active track name. */
  get activeTrack(): BGMTrack {
    return this.currentTrack;
  }
}

/** Singleton BGM manager — import and use across all scenes. */
export const bgm = new BGMManager();
