export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type AchievementType = 'clicks' | 'rank' | 'click_speed';
export type PowerEffectType = 'multiplier' | 'auto_click' | 'permanent';

export interface Achievement {
    id: number;
    name: string;
    description: string;
    icon: string;
    rarity: AchievementRarity;
    threshold: number;
    type: AchievementType;
    reward_type: string;
    reward_value: number | null;
}

export interface UserAchievement {
    id: number;
    user_id: string;
    achievement_id: number;
    unlocked_at: string;
    notified: boolean;
    achievement?: Achievement;
}

export interface SpecialPower {
    id: number;
    name: string;
    description: string;
    effect_type: PowerEffectType;
    effect_value: number;
    duration: number | null;
    icon: string;
    rarity: AchievementRarity;
}

export interface UserPower {
    id: number;
    user_id: string;
    power_id: number;
    acquired_at: string;
    expires_at: string | null;
    is_active: boolean;
    uses_left: number | null;
    power?: SpecialPower;
}

// Achievement animation configuration
export interface AchievementAnimationConfig {
    duration: number;
    className: string;
    sound?: string;
    volume?: number;
}

// Achievement notification configuration
export const ACHIEVEMENT_ANIMATION_CONFIG: Record<AchievementRarity, AchievementAnimationConfig> = {
    common: {
        duration: 3000,
        className: 'achievement-common',
        sound: '/sounds/success.mp3',
        volume: 0.3
    },
    uncommon: {
        duration: 4000,
        className: 'achievement-uncommon',
        sound: '/sounds/success.mp3',
        volume: 0.4
    },
    rare: {
        duration: 5000,
        className: 'achievement-rare',
        sound: '/sounds/success.mp3',
        volume: 0.5
    },
    epic: {
        duration: 6000,
        className: 'achievement-epic',
        sound: '/sounds/success.mp3',
        volume: 0.6
    },
    legendary: {
        duration: 7000,
        className: 'achievement-legendary',
        sound: '/sounds/success.mp3',
        volume: 0.7
    }
}; 