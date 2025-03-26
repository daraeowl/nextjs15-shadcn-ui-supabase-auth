import { useState } from 'react';
import { UnifiedUserPower } from '@/types/unified-power';
import { toast } from 'sonner';

export function usePowers(userId: string) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Function to activate a power
    const activatePower = async (powerId: number) => {
        try {
            setLoading(true);
            setError(null);

            console.log(`Activating power ID ${powerId} for user ${userId}`);

            const response = await fetch('/api/powers/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ powerId }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('Error activating power:', result);
                throw new Error(result.error || result.details || 'Failed to activate power');
            }

            // Check if the activation was actually verified
            if (result.verified === false) {
                console.warn('Power activation not verified in API response');
                toast.warning('Power activation may not have completed successfully');
            } else {
                console.log('Power activation successful:', result);
            }

            return result;
        } catch (err) {
            console.error('Error in activatePower function:', err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            toast.error(`Failed to activate power: ${errorMessage}`);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Function to fix powers with active status discrepancies
    const fixActiveStatusDiscrepancy = async (powers: UnifiedUserPower[]) => {
        try {
            setLoading(true);
            setError(null);

            // Filter powers that should be visually active but aren't marked as active in DB
            const powersToFix = powers.filter(power => {
                // Check expiration to see if power should be visually active
                if (power.expires_at) {
                    const now = new Date();
                    const expiry = new Date(power.expires_at);
                    return expiry > now && !power.is_active;
                }
                return false;
            });

            if (powersToFix.length === 0) {
                console.log('No powers need fixing');
                return { success: true, fixed: 0 };
            }

            console.log(`Fixing ${powersToFix.length} powers with active status discrepancy`);

            // Use the activate endpoint to fix each power
            const results = await Promise.all(
                powersToFix.map(power => activatePower(power.power_id))
            );

            const successCount = results.filter(r => r.success).length;

            if (successCount === powersToFix.length) {
                toast.success(`Fixed ${successCount} power${successCount !== 1 ? 's' : ''}`);
            } else {
                toast.info(`Fixed ${successCount} of ${powersToFix.length} powers`);
            }

            return { success: true, fixed: successCount, total: powersToFix.length };
        } catch (err) {
            console.error('Error fixing power status:', err);
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            toast.error(`Failed to fix powers: ${errorMessage}`);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        activatePower,
        fixActiveStatusDiscrepancy
    };
} 