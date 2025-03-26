'use client';

import React, { useEffect } from 'react';
import { useAchievements } from '@/hooks/use-achievements';
import { AchievementToastManager } from './achievement-toast';

/**
 * This component manages the display of achievement notifications
 * It automatically displays toasts for new achievements as they are unlocked
 */
export function AchievementNotificationManager() {
    const { pendingAchievements, markAchievementAsSeen } = useAchievements();

    // Mark the achievement as seen when it's dismissed
    const handleAchievementClose = (achievementId: number) => {
        markAchievementAsSeen(achievementId);
    };

    // For debugging
    useEffect(() => {
        if (pendingAchievements.length > 0) {
            console.log('Pending achievements:', pendingAchievements);
        }
    }, [pendingAchievements]);

    // Don't render anything if there are no pending achievements
    if (pendingAchievements.length === 0) {
        return null;
    }

    return (
        <AchievementToastManager
            achievements={pendingAchievements}
            onClose={handleAchievementClose}
        />
    );
} 