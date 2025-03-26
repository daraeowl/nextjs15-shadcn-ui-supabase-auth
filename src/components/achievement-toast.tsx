'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Achievement, AchievementRarity, ACHIEVEMENT_ANIMATION_CONFIG } from '@/types/achievement';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { useSound } from '@/hooks/use-sound';

// Singleton audio manager to prevent multiple sounds playing simultaneously
const AudioManager = {
    audioElement: null as HTMLAudioElement | null,
    lastPlayTime: 0,
    minPlayInterval: 500, // Minimum time between plays in ms

    play(soundUrl: string, volume: number = 0.5, enabled: boolean = true) {
        if (!enabled) return; // Don't play sound if globally disabled

        const now = Date.now();

        // Prevent rapid-fire sound playing
        if (now - this.lastPlayTime < this.minPlayInterval) {
            return;
        }

        if (!this.audioElement) {
            this.audioElement = new Audio(soundUrl);
        } else {
            // Reset and update source if needed
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            if (this.audioElement.src !== new URL(soundUrl, window.location.origin).href) {
                this.audioElement.src = soundUrl;
            }
        }

        this.audioElement.volume = volume;
        this.lastPlayTime = now;

        this.audioElement.play().catch(error => {
            console.log('Audio could not be played:', error);
        });
    },

    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
    }
};

interface AchievementToastProps {
    achievement: Achievement;
    onClose?: () => void;
    className?: string;
}

export function AchievementToast({ achievement, onClose, className }: AchievementToastProps) {
    const [isVisible, setIsVisible] = useState(true);
    const hasMounted = useRef(false);

    // Get global sound settings
    const { volume, enabled: soundEnabled } = useSound();

    // Get animation config based on achievement rarity
    const config = ACHIEVEMENT_ANIMATION_CONFIG[achievement.rarity as AchievementRarity];

    useEffect(() => {
        // Skip audio on initial mount to avoid autoplay restrictions
        if (!hasMounted.current) {
            hasMounted.current = true;
            return;
        }

        // Use the volume from the config if available
        // Play sound effect if available and sounds are enabled
        if (config?.sound && soundEnabled) {
            // Use the config volume as base, or 0.5 if not specified
            // Then adjust it further based on the user's global volume setting
            const configVolume = config.volume ?? 0.5;

            // Calculate final volume by multiplying config volume with user setting
            const finalVolume = configVolume * (volume / 100);

            // Pass both the final volume and the soundEnabled flag
            AudioManager.play(config.sound, finalVolume, soundEnabled);
        }

        // Auto-hide after duration
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onClose) {
                setTimeout(onClose, 300); // Allow for fade out animation
            }
        }, config?.duration || 5000);

        return () => {
            clearTimeout(timer);
        };
    }, [achievement, config, onClose, soundEnabled, volume]);

    // Define CSS classes based on rarity
    const getRarityClasses = (rarity: AchievementRarity) => {
        switch (rarity) {
            case 'common':
                return 'bg-green-50 border-green-200 text-green-700';
            case 'uncommon':
                return 'bg-blue-50 border-blue-200 text-blue-700';
            case 'rare':
                return 'bg-purple-50 border-purple-200 text-purple-700';
            case 'epic':
                return 'bg-orange-50 border-orange-200 text-orange-700';
            case 'legendary':
                return 'bg-yellow-50 border-yellow-200 text-yellow-700';
            default:
                return 'bg-slate-50 border-slate-200 text-slate-700';
        }
    };

    // Define animation classes based on rarity
    const getAnimationClasses = (rarity: AchievementRarity) => {
        switch (rarity) {
            case 'common':
                return 'animate-fade-in';
            case 'uncommon':
                return 'animate-slide-in-right';
            case 'rare':
                return 'animate-bounce-in';
            case 'epic':
                return 'animate-scale-in';
            case 'legendary':
                return 'animate-glow';
            default:
                return 'animate-fade-in';
        }
    };

    return (
        <div
            className={cn(
                'fixed top-5 right-5 z-50 max-w-md rounded-lg border shadow-lg transform transition-all duration-300',
                getRarityClasses(achievement.rarity as AchievementRarity),
                getAnimationClasses(achievement.rarity as AchievementRarity),
                config?.className,
                !isVisible && 'opacity-0 translate-x-full',
                className
            )}
        >
            <div className="flex items-center p-4">
                <div className="mr-4">
                    <Icon
                        name={achievement.icon}
                        className={cn(
                            'h-8 w-8',
                            achievement.rarity === 'legendary' && 'animate-pulse text-yellow-500',
                            achievement.rarity === 'epic' && 'animate-bounce text-orange-500',
                            achievement.rarity === 'rare' && 'animate-spin-slow text-purple-500',
                            achievement.rarity === 'uncommon' && 'text-blue-500',
                            achievement.rarity === 'common' && 'text-green-500'
                        )}
                    />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold">{achievement.name}</h3>
                    <p className="text-sm">{achievement.description}</p>
                </div>
                <button
                    className="ml-2 text-gray-400 hover:text-gray-600"
                    onClick={() => {
                        setIsVisible(false);
                        // Don't try to play sound when closing
                        if (onClose) {
                            setTimeout(onClose, 300);
                        }
                    }}
                >
                    <Icon name="x" className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}

// Component to manage multiple achievement toasts
export function AchievementToastManager({
    achievements,
    onClose
}: {
    achievements: Achievement[],
    onClose: (id: number) => void
}) {
    return (
        <>
            {achievements.map((achievement, index) => (
                <AchievementToast
                    key={achievement.id}
                    achievement={achievement}
                    onClose={() => onClose(achievement.id)}
                    className={`top-${5 + index * 20}px`}
                />
            ))}
        </>
    );
} 