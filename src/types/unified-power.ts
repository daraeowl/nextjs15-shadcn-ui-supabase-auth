export type PowerRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type PowerEffectType = 'multiplier' | 'auto_click' | 'permanent';
export type PowerCategory = 'buff' | 'attack' | 'support';

// Combined Power interface that includes all fields from both Power and SpecialPower
export interface UnifiedPower {
    id: number;
    name: string;
    description: string;
    effect_type: PowerEffectType;
    effect_value: number;
    duration: number | null;
    icon: string;
    rarity: PowerRarity;
    category: PowerCategory;
    max_level?: number;
    requires_confirmation?: boolean;
}

// Unified UserPower interface that works with both implementations
export interface UnifiedUserPower {
    id: number;
    user_id: string;
    power_id: number;
    acquired_at: string;
    expires_at: string | null;
    is_active: boolean;
    uses_left: number | null;
    level: number;
    upgrade_confirmed?: boolean;
    power?: UnifiedPower;
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

// Function to check if a power is active in the UI
export function isPowerVisuallyActive(power: UnifiedUserPower): boolean {
    // Check if the power is marked as active in the database
    if (power.is_active) return true;

    // Check if the power has a valid expiration date in the future
    if (power.expires_at) {
        const now = new Date();
        const expiry = new Date(power.expires_at);
        if (expiry > now) return true;
    }

    return false;
}

// Function to help fix inconsistencies between UI display and database
export function checkPowerActiveDiscrepancy(powers: UnifiedUserPower[]): UnifiedUserPower[] {
    return powers.filter(power => {
        // Find powers that should be visually active but aren't marked as active in DB
        const shouldBeActive = isPowerVisuallyActive(power);
        return shouldBeActive && !power.is_active;
    });
} 