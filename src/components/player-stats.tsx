"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSupabase } from "@/lib/supabase/provider";

interface Power {
    id: number;
    power_id: number;
    name: string;
    description: string | null;
    effect_type: string;
    level: number;
}

interface PlayerStatsProps {
    clickCount?: number;
    rank?: number;
    username?: string;
    loading?: boolean;
    onClickButton?: () => void;
    clickValue?: number;
    hasBonus?: boolean;
    userId?: string;
}

export default function PlayerStats({
    clickCount = 0,
    rank = 0,
    username = "",
    loading = false,
    onClickButton,
    clickValue = 1,
    hasBonus = false,
    userId,
}: PlayerStatsProps) {
    const [nextRankPoints, setNextRankPoints] = useState(1000);
    const [progress, setProgress] = useState(0);
    const [powers, setPowers] = useState<Power[]>([]);
    const [loadingPowers, setLoadingPowers] = useState(false);
    const [needsSync, setNeedsSync] = useState(false);
    const supabase = useSupabase();

    // Calculate next rank threshold
    useEffect(() => {
        if (rank > 0) {
            const nextRankThreshold = Math.ceil(1000 * Math.pow(1.5, rank));
            setNextRankPoints(nextRankThreshold);

            // Calculate progress percentage
            const prevRankThreshold = rank > 1 ? Math.ceil(1000 * Math.pow(1.5, rank - 1)) : 0;
            const pointsInCurrentRank = clickCount - prevRankThreshold;
            const pointsNeededForNextRank = nextRankThreshold - prevRankThreshold;
            const progressPercentage = Math.min(100, Math.round((pointsInCurrentRank / pointsNeededForNextRank) * 100));
            setProgress(progressPercentage);
        }
    }, [clickCount, rank]);

    // Fetch active powers using RPC
    const fetchActivePowers = useCallback(async () => {
        if (!userId) return;

        try {
            setLoadingPowers(true);
            const { data, error } = await supabase.rpc('get_active_powers', {
                user_id_param: userId
            });

            if (error) {
                console.error('Error fetching active powers:', error);
                return;
            }

            console.log('Fetched active powers:', data);
            setPowers(data || []);
        } catch (error) {
            console.error('Error fetching active powers:', error);
        } finally {
            setLoadingPowers(false);
        }
    }, [userId, supabase]);

    // Sync powers between database and memory
    const syncPowers = async () => {
        if (!userId) return;

        try {
            toast.loading('Syncing powers...');
            const result = await fetch('/api/sync-powers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            const data = await result.json();

            if (data.success) {
                toast.success('Powers synchronized successfully!');
                setNeedsSync(false);
                fetchActivePowers();
            } else {
                toast.error('Failed to sync powers');
            }
        } catch (error) {
            console.error('Error syncing powers:', error);
            toast.error('Failed to sync powers');
        }
    };

    // Fetch active powers on component mount and every 10 seconds
    useEffect(() => {
        if (userId) {
            fetchActivePowers();

            // Refresh powers every 10 seconds
            const interval = setInterval(() => {
                fetchActivePowers();
            }, 10000);

            return () => clearInterval(interval);
        }
    }, [userId, fetchActivePowers]);

    return (
        <div className="space-y-4">
            {/* Player info */}
            <div className="flex flex-col space-y-2">
                {loading ? (
                    <>
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </>
                ) : (
                    <>
                        <h3 className="font-semibold text-2xl">{username || "Player"}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Rank {rank}</span>
                            {hasBonus && (
                                <Badge variant="outline" className="bg-gradient-to-r from-orange-100 to-amber-100 text-amber-700 border-amber-200">
                                    +{clickValue - 1} bonus/click
                                </Badge>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Click stats */}
            <div className="space-y-2">
                {loading ? (
                    <Skeleton className="h-8 w-full" />
                ) : (
                    <div className="flex justify-between items-baseline">
                        <div className="text-3xl font-bold">{clickCount.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">
                            Next rank: {nextRankPoints.toLocaleString()}
                        </div>
                    </div>
                )}
                {/* Simple progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>

            {/* Active powers */}
            {userId && (
                <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center">
                        <h4 className="font-medium">Active Powers</h4>
                        {needsSync && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={syncPowers}
                                className="h-7 rounded-full px-3 text-xs"
                            >
                                Sync Powers
                            </Button>
                        )}
                    </div>
                    {loadingPowers ? (
                        <div className="space-y-1 mt-2">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                        </div>
                    ) : powers.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {powers.map((power) => (
                                <Badge key={power.id} variant="secondary" className="py-1">
                                    {power.name} Lvl {power.level}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground mt-2">No active powers</div>
                    )}
                </div>
            )}

            <Button
                className="w-full"
                size="lg"
                onClick={onClickButton}
                disabled={loading}
            >
                Click to Earn ({clickValue} point{clickValue !== 1 ? 's' : ''})
            </Button>
        </div>
    );
} 