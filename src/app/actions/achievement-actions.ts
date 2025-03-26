'use server'

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { Achievement, SpecialPower, UserAchievement } from '@/types/achievement';
import { UserPower } from '@/types/power';

/**
 * Get all achievements from the database
 */
export async function getAllAchievements(): Promise<Achievement[]> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('achievements')
            .select('*')
            .order('threshold', { ascending: true });

        if (error) {
            console.error('Error fetching achievements:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getAllAchievements:', error);
        return [];
    }
}

/**
 * Get all user achievements for a user
 */
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_achievements')
            .select('*, achievement:achievement_id(*)')
            .eq('user_id', userId)
            .order('unlocked_at', { ascending: false });

        if (error) {
            console.error('Error fetching user achievements:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getUserAchievements:', error);
        return [];
    }
}

/**
 * Get all pending achievement notifications for a user
 */
export async function getPendingAchievementNotifications(userId: string): Promise<UserAchievement[]> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('user_achievements')
            .select('*, achievement:achievement_id(*)')
            .eq('user_id', userId)
            .eq('notified', false)
            .order('unlocked_at', { ascending: false });

        if (error) {
            console.error('Error fetching pending achievement notifications:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getPendingAchievementNotifications:', error);
        return [];
    }
}

/**
 * Mark achievement notification as seen
 */
export async function markAchievementNotified(userId: string, achievementId: number): Promise<boolean> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('user_achievements')
            .update({ notified: true })
            .eq('user_id', userId)
            .eq('achievement_id', achievementId);

        if (error) {
            console.error('Error marking achievement as notified:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in markAchievementNotified:', error);
        return false;
    }
}

/**
 * Check and unlock achievements based on click count
 */
export async function checkClickAchievements(userId: string, clickCount: number): Promise<UserAchievement[]> {
    try {
        const supabase = await createClient();

        // Get all click-based achievements that the user doesn't have yet
        const { data: achievements, error: achievementsError } = await supabase
            .from('achievements')
            .select('*')
            .eq('type', 'clicks')
            .lte('threshold', clickCount)
            .order('threshold', { ascending: true });

        if (achievementsError) {
            console.error('Error fetching click achievements:', achievementsError);
            return [];
        }

        if (!achievements.length) {
            return [];
        }

        // Get user's existing achievements
        const { data: existingAchievements, error: existingError } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId);

        if (existingError) {
            console.error('Error fetching existing achievements:', existingError);
            return [];
        }

        // Find achievements to unlock
        const existingIds = existingAchievements?.map(a => a.achievement_id) || [];
        const achievementsToUnlock = achievements.filter(a => !existingIds.includes(a.id));

        if (!achievementsToUnlock.length) {
            return [];
        }

        // Create records for newly unlocked achievements
        const newUserAchievements = achievementsToUnlock.map(achievement => ({
            user_id: userId,
            achievement_id: achievement.id,
            notified: false
        }));

        // Insert new achievements
        const { data: insertedAchievements, error: insertError } = await supabase
            .from('user_achievements')
            .insert(newUserAchievements)
            .select('*, achievement:achievement_id(*)');

        if (insertError) {
            console.error('Error inserting new achievements:', insertError);
            return [];
        }

        // Grant special powers from achievements
        if (insertedAchievements) {
            await grantSpecialPowersFromAchievements(userId, insertedAchievements);
        }

        revalidatePath('/');
        return insertedAchievements || [];
    } catch (error) {
        console.error('Error in checkClickAchievements:', error);
        return [];
    }
}

/**
 * Check and unlock rank-based achievements
 */
export async function checkRankAchievements(userId: string, rank: number): Promise<UserAchievement[]> {
    try {
        const supabase = await createClient();

        // Get all rank-based achievements that apply to the user's rank
        const { data: achievements, error: achievementsError } = await supabase
            .from('achievements')
            .select('*')
            .eq('type', 'rank')
            .lte('threshold', rank)
            .order('threshold', { ascending: true });

        if (achievementsError) {
            console.error('Error fetching rank achievements:', achievementsError);
            return [];
        }

        if (!achievements.length) {
            return [];
        }

        // Get user's existing achievements
        const { data: existingAchievements, error: existingError } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId);

        if (existingError) {
            console.error('Error fetching existing achievements:', existingError);
            return [];
        }

        // Find achievements to unlock
        const existingIds = existingAchievements?.map(a => a.achievement_id) || [];
        const achievementsToUnlock = achievements.filter(a => !existingIds.includes(a.id));

        if (!achievementsToUnlock.length) {
            return [];
        }

        // Create records for newly unlocked achievements
        const newUserAchievements = achievementsToUnlock.map(achievement => ({
            user_id: userId,
            achievement_id: achievement.id,
            notified: false
        }));

        // Insert new achievements
        const { data: insertedAchievements, error: insertError } = await supabase
            .from('user_achievements')
            .insert(newUserAchievements)
            .select('*, achievement:achievement_id(*)');

        if (insertError) {
            console.error('Error inserting new rank achievements:', insertError);
            return [];
        }

        // Grant special powers from achievements
        if (insertedAchievements) {
            await grantSpecialPowersFromAchievements(userId, insertedAchievements);
        }

        revalidatePath('/');
        return insertedAchievements || [];
    } catch (error) {
        console.error('Error in checkRankAchievements:', error);
        return [];
    }
}

/**
 * Grant special powers to a user based on unlocked achievements
 */
async function grantSpecialPowersFromAchievements(userId: string, achievements: UserAchievement[]): Promise<void> {
    try {
        // Find achievements that grant powers
        const achievementsWithPowers = achievements
            .filter(ua => ua.achievement?.reward_type === 'power' && ua.achievement?.reward_value !== null);

        if (!achievementsWithPowers.length) {
            return;
        }

        const supabase = await createClient();

        // Get the corresponding powers
        const powerIds = achievementsWithPowers.map(ua => ua.achievement?.reward_value).filter(Boolean);
        const { data: powers, error: powersError } = await supabase
            .from('special_powers')
            .select('*')
            .in('id', powerIds);

        if (powersError) {
            console.error('Error fetching powers:', powersError);
            return;
        }

        if (!powers.length) {
            return;
        }

        // Prepare user powers with expiration if needed
        const now = new Date();
        const userPowers = powers.map((power: SpecialPower) => {
            const expiresAt = power.duration
                ? new Date(now.getTime() + power.duration * 1000).toISOString()
                : null;

            return {
                user_id: userId,
                power_id: power.id,
                acquired_at: now.toISOString(),
                expires_at: expiresAt,
                is_active: true,
                uses_left: null
            };
        });

        // Insert powers
        const { error: insertError } = await supabase
            .from('user_powers')
            .insert(userPowers);

        if (insertError) {
            console.error('Error inserting user powers:', insertError);
        }
    } catch (error) {
        console.error('Error in grantSpecialPowersFromAchievements:', error);
    }
}

/**
 * Get all active special powers for a user
 */
export async function getActiveUserPowers(userId: string): Promise<UserPower[]> {
    try {
        const supabase = await createClient();
        const now = new Date().toISOString();

        console.log(`Fetching active powers for user ${userId}`);

        // First, get all powers marked as active in the database
        const { data, error } = await supabase
            .from('user_powers')
            .select('*, power:power_id(*)')
            .eq('user_id', userId)
            .eq('is_active', true)
            .or(`expires_at.gt.${now},expires_at.is.null`);

        if (error) {
            console.error('Error fetching active user powers:', error);
            return [];
        }

        console.log(`Found ${data?.length || 0} active powers for user ${userId}`);

        // If no active powers are found, check for any non-expired powers that should be active
        if (!data || data.length === 0) {
            console.log('No active powers found, checking for non-expired powers that should be active');

            // Look for any powers that are not marked as active but have valid expiration dates
            const { data: nonExpiredPowers, error: nonExpiredError } = await supabase
                .from('user_powers')
                .select('*, power:power_id(*)')
                .eq('user_id', userId)
                .eq('is_active', false)
                .or(`expires_at.gt.${now},expires_at.is.null`);

            if (nonExpiredError) {
                console.error('Error fetching non-expired powers:', nonExpiredError);
                return [];
            }

            // If we found non-expired powers, update them to be active
            if (nonExpiredPowers && nonExpiredPowers.length > 0) {
                console.log(`Found ${nonExpiredPowers.length} non-expired powers that should be active, updating...`);

                // Update each power to be active
                const updatePromises = nonExpiredPowers.map(power =>
                    supabase
                        .from('user_powers')
                        .update({
                            is_active: true,
                            level: power.level ?? 1,
                            upgrade_confirmed: power.upgrade_confirmed ?? false
                        })
                        .eq('id', power.id)
                        .eq('user_id', userId)
                );

                // Wait for all updates to complete
                await Promise.all(updatePromises);

                // Fetch the updated powers
                const { data: updatedPowers, error: updatedError } = await supabase
                    .from('user_powers')
                    .select('*, power:power_id(*)')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .or(`expires_at.gt.${now},expires_at.is.null`);

                if (updatedError) {
                    console.error('Error fetching updated powers:', updatedError);
                    // Return the non-expired powers with default values for level and upgrade_confirmed
                    return nonExpiredPowers.map(p => ({
                        ...p,
                        level: p.level ?? 1,
                        upgrade_confirmed: p.upgrade_confirmed ?? false
                    }));
                }

                return updatedPowers?.map(p => ({
                    ...p,
                    level: p.level ?? 1,
                    upgrade_confirmed: p.upgrade_confirmed ?? false
                })) || [];
            }
        }

        // Ensure all powers have level and upgrade_confirmed fields
        return (data || []).map(p => ({
            ...p,
            level: p.level ?? 1,
            upgrade_confirmed: p.upgrade_confirmed ?? false
        }));
    } catch (error) {
        console.error('Error in getActiveUserPowers:', error);
        return [];
    }
} 