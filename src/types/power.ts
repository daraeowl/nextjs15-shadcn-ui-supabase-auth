export type PowerRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type PowerEffectType = 'multiplier' | 'auto_click' | 'permanent';
export type PowerCategory = 'buff' | 'attack' | 'support';

export interface Power {
    id: number;
    name: string;
    description: string;
    effect_type: PowerEffectType;
    effect_value: number;
    duration: number | null;
    icon: string;
    rarity: PowerRarity;
    category: PowerCategory;
    max_level: number;
    requires_confirmation: boolean;
}

export interface UserPower {
    id: number;
    user_id: string;
    power_id: number;
    acquired_at: string;
    expires_at: string | null;
    is_active: boolean;
    uses_left: number | null;
    level: number;
    upgrade_confirmed: boolean;
    power?: Power;
}

// Configuration for power border colors
export const POWER_CATEGORY_COLORS = {
    buff: 'border-blue-500',
    attack: 'border-red-500',
    support: 'border-green-500'
};

// Configuration for power category icons
export const POWER_CATEGORY_ICONS = {
    buff: '⚡', // Lightning bolt for buff
    attack: '🔥', // Fire for attack
    support: '🛡️', // Shield for support
}; 