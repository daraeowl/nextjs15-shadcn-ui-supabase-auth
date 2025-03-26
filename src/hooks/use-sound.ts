'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface SoundOptions {
    volume?: number;
    enabled?: boolean;
}

// Sound effect paths
const SOUND_EFFECTS = {
    click: '/sounds/click.mp3',
    achievement: '/sounds/achievement.mp3',
    error: '/sounds/error.mp3',
    powerUp: '/sounds/power-up.mp3'
};

export type SoundEffectType = keyof typeof SOUND_EFFECTS;

export function useSound(options: SoundOptions = {}) {
    const { volume: initialVolume = 50, enabled: initialEnabled = true } = options;

    // State for volume and mute settings
    const [volume, setVolume] = useState<number>(initialVolume);
    const [enabled, setEnabled] = useState<boolean>(initialEnabled);

    // Refs to store audio elements
    const soundsRef = useRef<Record<SoundEffectType, HTMLAudioElement | null>>({
        click: null,
        achievement: null,
        error: null,
        powerUp: null
    });

    // Initialize audio elements (client-side only)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Create audio elements for each sound
        Object.entries(SOUND_EFFECTS).forEach(([key, path]) => {
            try {
                const audio = new Audio(path);
                audio.volume = volume / 100;
                soundsRef.current[key as SoundEffectType] = audio;
            } catch (error) {
                console.error(`Failed to load sound effect: ${key}`, error);
            }
        });

        // Store reference to current audio elements for cleanup
        const currentSounds = { ...soundsRef.current };

        // Cleanup
        return () => {
            Object.values(currentSounds).forEach(audio => {
                if (audio) {
                    audio.pause();
                    audio.src = '';
                }
            });
        };
    }, [volume]);

    // Update volume for all sounds when it changes
    useEffect(() => {
        if (typeof window === 'undefined') return;

        Object.values(soundsRef.current).forEach(audio => {
            if (audio) {
                audio.volume = volume / 100;
            }
        });
    }, [volume]);

    // Function to play a sound effect
    const play = useCallback((type: SoundEffectType) => {
        if (!enabled || typeof window === 'undefined') return;

        const sound = soundsRef.current[type];

        if (sound) {
            // Clone and play to allow overlapping sounds
            const clone = sound.cloneNode() as HTMLAudioElement;
            clone.volume = volume / 100;

            clone.play().catch(err => {
                console.error(`Failed to play sound effect: ${type}`, err);
            });
        }
    }, [enabled, volume]);

    // Toggle sound on/off
    const toggleSound = useCallback(() => {
        setEnabled(prev => !prev);
    }, []);

    return {
        volume,
        setVolume,
        enabled,
        setEnabled,
        toggleSound,
        play
    };
} 