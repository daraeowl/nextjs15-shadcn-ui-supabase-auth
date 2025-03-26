'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase/provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPower, POWER_CATEGORY_COLORS, POWER_CATEGORY_ICONS } from '@/types/power';
import ActivePowers from "./active-powers";

export interface PlayerPowersProps {
    onActivatePower?: (powerId: string) => void;
    loading?: boolean;
}

export default function PlayerPowers({ onActivatePower, loading: propLoading }: PlayerPowersProps) {
    const supabase = useSupabase();
    const [userPowers, setUserPowers] = useState<UserPower[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | undefined>(undefined);
    const [activatingPower, setActivatingPower] = useState<string | null>(null);

    // Get user session and ID
    useEffect(() => {
        const getSession = async () => {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
                setUserId(data.user.id);
            }
        };

        getSession();
    }, [supabase]);

    // Get the border color based on power category
    const getCategoryBorderColor = (category: string = 'buff') => {
        return POWER_CATEGORY_COLORS[category as keyof typeof POWER_CATEGORY_COLORS] || 'border-gray-500';
    };

    // Get category icon
    const getCategoryIcon = (category: string = 'buff') => {
        return POWER_CATEGORY_ICONS[category as keyof typeof POWER_CATEGORY_ICONS] || '✨';
    };

    // Get the rarity color
    const getRarityColor = (rarity: string) => {
        switch (rarity.toLowerCase()) {
            case 'common':
                return 'bg-gray-100 text-gray-800';
            case 'uncommon':
                return 'bg-green-100 text-green-800';
            case 'rare':
                return 'bg-blue-100 text-blue-800';
            case 'epic':
                return 'bg-purple-100 text-purple-800';
            case 'legendary':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Format time remaining
    const formatTimeRemaining = (expiresAt: string | null) => {
        if (!expiresAt) return 'Permanent';

        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffMs = expiry.getTime() - now.getTime();

        if (diffMs <= 0) return 'Expired';

        const diffSec = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSec / 3600);
        const minutes = Math.floor((diffSec % 3600) / 60);
        const seconds = diffSec % 60;

        return `${hours}h ${minutes}m ${seconds}s`;
    };

    // Fetch user powers from database
    const fetchUserPowers = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);

            // Fetch user powers with details using RPC
            const { data: userPowersData, error: powersError } = await supabase.rpc('get_user_powers_with_details', {
                user_id_param: userId
            });

            if (powersError) {
                console.error('Error fetching user powers:', powersError);
                throw powersError;
            }

            if (userPowersData) {
                setUserPowers(userPowersData);
            } else {
                setUserPowers([]);
            }
        } catch (error) {
            console.error('Error fetching user powers:', error);
            toast.error('Failed to load powers');
        } finally {
            setLoading(false);
        }
    }, [userId, supabase]);

    // Fetch user powers when userId changes
    useEffect(() => {
        if (userId) {
            fetchUserPowers();
        }
    }, [userId, fetchUserPowers]);

    // Activate a power
    const activatePower = async (powerId: number) => {
        if (!userId) return;

        // If there's an external handler, use that instead
        if (onActivatePower) {
            onActivatePower(powerId.toString());
            return;
        }

        try {
            setActivatingPower(powerId.toString());
            console.log(`Activating power ID ${powerId} for user ${userId}`);

            // Call the stored procedure to activate the power
            const { data, error } = await supabase.rpc('activate_user_power', {
                p_user_id: userId,
                p_power_id: powerId
            });

            if (error) {
                console.error(`Error activating power:`, error);
                throw error;
            }

            if (data) {
                toast.success('Power activated!');
                // Refresh powers list
                fetchUserPowers();
            } else {
                toast.info('Could not activate power');
            }
        } catch (error) {
            console.error('Error activating power:', error);
            toast.error('Failed to activate power');
        } finally {
            setActivatingPower(null);
        }
    };

    // Confirm power upgrade
    const confirmUpgrade = async (powerId: number) => {
        if (!userId) return;

        try {
            const { data, error } = await supabase.rpc('confirm_power_upgrade', {
                p_user_id: userId,
                p_power_id: powerId
            });

            if (error) throw error;

            if (data) {
                toast.success('Upgrade confirmed!');
                // Refresh powers list
                fetchUserPowers();
            } else {
                toast.info('Could not confirm upgrade');
            }
        } catch (error) {
            console.error('Error confirming upgrade:', error);
            toast.error('Failed to confirm upgrade');
        }
    };

    // Upgrade a power
    const upgradePower = async (powerId: number) => {
        if (!userId) return;

        try {
            const { data, error } = await supabase.rpc('upgrade_user_power', {
                p_user_id: userId,
                p_power_id: powerId
            });

            if (error) throw error;

            if (data) {
                toast.success('Power upgraded!');
                // Refresh powers list
                fetchUserPowers();
            } else {
                toast.info('Power requires confirmation first or is already at max level');
            }
        } catch (error) {
            console.error('Error upgrading power:', error);
            toast.error('Failed to upgrade power');
        }
    };

    if (propLoading || loading) {
        return <div className="text-center p-4">Loading powers...</div>;
    }

    if (userPowers.length === 0) {
        return (
            <div className="space-y-4 p-4">
                <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                    No powers available yet
                </div>
                <Button onClick={fetchUserPowers} className="w-full">Refresh Powers</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Your Powers</h2>
                <Button
                    size="sm"
                    className="rounded bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={fetchUserPowers}
                >
                    Refresh Powers
                    <span className="ml-2 bg-blue-800 px-1.5 py-0.5 rounded text-xs">
                        {userPowers.length}
                        {userPowers.filter(p => p.is_active).length > 0 && ` (${userPowers.filter(p => p.is_active).length} active)`}
                    </span>
                </Button>
            </div>

            {/* Powers grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {userPowers.map((userPower) => {
                    const powerData = userPower.power || {
                        id: userPower.power_id,
                        name: `Power ID: ${userPower.power_id}`,
                        category: 'unknown',
                        icon: '🔮',
                        rarity: 'common',
                        description: 'No description available',
                        max_level: 5,
                        effect_type: 'unknown',
                        effect_value: 1,
                        requires_confirmation: false
                    };

                    return (
                        <Card
                            key={userPower.id}
                            className={`p-4 shadow-md transition-all duration-300 hover:shadow-lg border-2 ${getCategoryBorderColor(powerData?.category)}`}
                        >
                            <div className="flex items-start gap-2">
                                <div className="text-2xl">{powerData?.icon || getCategoryIcon(powerData?.category)}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold">{powerData?.name || 'Unknown Power'}</h3>
                                        <Badge className={`${getRarityColor(powerData?.rarity || 'common')}`}>
                                            {powerData?.rarity || 'unknown'}
                                        </Badge>
                                    </div>

                                    <p className="text-sm text-gray-600 mt-1">{powerData?.description || 'No description available'}</p>

                                    <div className="mt-2 flex items-center gap-1 text-sm">
                                        <Badge variant="outline" className="px-2 py-0.5">
                                            {getCategoryIcon(powerData?.category)} {powerData?.category || 'unknown'}
                                        </Badge>
                                        <span className="text-sm">
                                            Level {userPower.level || 1}/{powerData?.max_level || 5}
                                        </span>
                                    </div>

                                    <div className="mt-2 text-sm">
                                        <span className="text-gray-600">Effect: </span>
                                        <span>{powerData?.effect_type || 'unknown'} +{((powerData?.effect_value || 1) * (userPower.level || 1))}</span>
                                    </div>

                                    {userPower.expires_at && (
                                        <div className="mt-1 text-sm">
                                            <span className="text-gray-600">Time left: </span>
                                            <span>{formatTimeRemaining(userPower.expires_at)}</span>
                                        </div>
                                    )}

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {!userPower.is_active && (
                                            <Button
                                                size="sm"
                                                onClick={() => activatePower(userPower.power_id)}
                                                className="bg-blue-500 hover:bg-blue-600"
                                                disabled={activatingPower === userPower.power_id.toString()}
                                            >
                                                {activatingPower === userPower.power_id.toString() ? 'Activating...' : 'Activate'}
                                            </Button>
                                        )}

                                        {(userPower.level || 1) < (powerData?.max_level || 5) && !userPower.upgrade_confirmed && powerData?.requires_confirmation && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => confirmUpgrade(userPower.power_id)}
                                            >
                                                Confirm Upgrade
                                            </Button>
                                        )}

                                        {(userPower.level || 1) < (powerData?.max_level || 5) && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => upgradePower(userPower.power_id)}
                                                className={`${userPower.upgrade_confirmed || !powerData?.requires_confirmation ? 'opacity-100' : 'opacity-50'}`}
                                            >
                                                Upgrade to Lvl {(userPower.level || 1) + 1}
                                            </Button>
                                        )}

                                        {userPower.is_active && (
                                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Add ActivePowers component to display powers and confirmation dialog */}
            <ActivePowers userId={userId} />
        </div>
    );
} 