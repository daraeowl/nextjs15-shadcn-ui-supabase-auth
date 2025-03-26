'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/lib/supabase/provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAchievements } from '@/hooks/use-achievements';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserPower as UserPowerType } from '@/types/power';

interface Power {
    id: number;
    power_id: number;
    name: string;
    description: string | null;
    icon?: string;
    effect_type: string;
    level: number;
    expires_at?: string | null;
}

interface ActivePowersProps {
    userId?: string;
    powers?: Power[];
}

export default function ActivePowers({ userId, powers: propPowers }: ActivePowersProps) {
    const supabase = useSupabase();
    const [activePowers, setActivePowers] = useState<Power[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState<Date | null>(null);

    // Get powers from useAchievements if not provided via props
    const { activePowers: hookPowers } = useAchievements();

    // Function to get current user ID if not provided
    const getCurrentUserId = useCallback(async (): Promise<string | undefined> => {
        if (userId) return userId;

        const { data } = await supabase.auth.getUser();
        return data.user?.id;
    }, [userId, supabase]);

    // Get the rarity color
    const getRarityBgColor = (rarity: string) => {
        switch (rarity?.toLowerCase()) {
            case 'common':
                return 'bg-gray-100 hover:bg-gray-200';
            case 'uncommon':
                return 'bg-green-100 hover:bg-green-200';
            case 'rare':
                return 'bg-blue-100 hover:bg-blue-200';
            case 'epic':
                return 'bg-purple-100 hover:bg-purple-200';
            case 'legendary':
                return 'bg-yellow-100 hover:bg-yellow-200';
            default:
                return 'bg-indigo-100 hover:bg-indigo-200';
        }
    };

    // Format time remaining for powers with expiration
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

    // Fetch active powers using RPC
    const fetchActivePowers = useCallback(async () => {
        try {
            setLoading(true);

            const currentUserId = await getCurrentUserId();
            if (!currentUserId) {
                console.error('No user ID available to fetch powers');
                return;
            }

            console.log(`Fetching active powers for user ${currentUserId}`);

            // Use RPC method to fetch active powers
            const { data, error } = await supabase.rpc('get_active_powers', {
                user_id_param: currentUserId
            });

            if (error) {
                console.error('Error fetching active powers:', error);
                toast.error('Failed to load active powers');
                return;
            }

            console.log('RPC get_active_powers result:', data);
            setActivePowers(data || []);
            setLastFetch(new Date());
        } catch (error) {
            console.error('Error in fetchActivePowers:', error);
            toast.error('Failed to load active powers');
        } finally {
            setLoading(false);
        }
    }, [supabase, getCurrentUserId]);

    // Manually refresh powers
    const refreshPowers = () => {
        fetchActivePowers();
        toast.success('Refreshing active powers...');
    };

    // Convert hook powers to the correct format
    const convertHookPowersToPowers = useCallback((): Power[] => {
        if (!hookPowers?.length) return [];

        return hookPowers.map((hp: UserPowerType) => ({
            id: hp.id,
            power_id: hp.power_id,
            name: hp.power?.name || `Power ${hp.power_id}`,
            description: hp.power?.description || null,
            icon: hp.power?.icon,
            effect_type: hp.power?.effect_type || 'unknown',
            level: hp.level,
            expires_at: hp.expires_at
        }));
    }, [hookPowers]);

    // Use effect with proper dependencies
    useEffect(() => {
        if (propPowers?.length) {
            console.log('Using powers from props:', propPowers);
            setActivePowers(propPowers);
            setLoading(false);
            setLastFetch(new Date());
        } else if (hookPowers?.length) {
            console.log('Using powers from useAchievements hook:', hookPowers);
            const convertedPowers = convertHookPowersToPowers();
            setActivePowers(convertedPowers);
            setLoading(false);
            setLastFetch(new Date());
        } else if (userId) {
            console.log(`ActivePowers component mounted with userId: ${userId}, fetching powers directly`);
            fetchActivePowers();
        }
    }, [userId, propPowers, hookPowers, convertHookPowersToPowers, fetchActivePowers]);

    // Set up periodic refresh only if not using props or hook powers
    useEffect(() => {
        if (!propPowers?.length && !hookPowers?.length && userId) {
            // Set up an interval to refresh powers every 10 seconds
            const interval = setInterval(fetchActivePowers, 10000);
            return () => clearInterval(interval);
        }
    }, [userId, propPowers, hookPowers, fetchActivePowers]);

    // Display powers (from whatever source they came from)
    const displayPowers = activePowers.length ? activePowers : [];

    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                {lastFetch && (
                    <div className="text-xs text-gray-500">
                        Last updated: {lastFetch.toLocaleTimeString()}
                    </div>
                )}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshPowers}
                    className="text-xs"
                >
                    Refresh
                </Button>
            </div>

            {loading ? (
                <div className="text-center text-sm text-gray-500 py-2">
                    Loading active powers...
                </div>
            ) : displayPowers.length === 0 ? (
                <div className="text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-md py-2">
                    No active powers
                </div>
            ) : (
                <TooltipProvider>
                    <div className="flex flex-wrap gap-2">
                        {displayPowers.map((power) => (
                            <Tooltip key={power.id}>
                                <TooltipTrigger>
                                    <Badge
                                        variant="outline"
                                        className={`${getRarityBgColor(power.effect_type)} px-3 py-1 cursor-default transition-colors`}
                                    >
                                        <span className="mr-1.5">{power.icon || '⚡'}</span>
                                        <span className="font-medium">{power.name}</span>
                                        {power.level > 1 && (
                                            <span className="ml-1 text-xs bg-blue-200 text-blue-800 rounded-full px-1">Lv{power.level}</span>
                                        )}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs bg-white shadow-lg rounded-lg p-3 border border-gray-200">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-semibold">{power.name}</h4>
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">Level {power.level}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            {power.description || `Provides ${power.effect_type} bonus`}
                                        </p>
                                        {power.expires_at && (
                                            <div className="text-xs text-gray-500 flex items-center">
                                                <span className="mr-1">⏱️</span>
                                                {formatTimeRemaining(power.expires_at)}
                                            </div>
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            )}
        </div>
    );
} 