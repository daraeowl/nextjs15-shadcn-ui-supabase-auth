import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Check if a specific userId is provided in request body
        const body = await req.json().catch(() => ({}));
        const requestedUserId = body.userId;

        let userId: string;

        // If no specific userId is provided, get it from the authentication token
        if (!requestedUserId) {
            // Extract token from cookies
            const authCookie = req.cookies.get('sb-access-token')?.value;

            if (!authCookie) {
                console.error('Sync powers failed: Missing auth token in cookies');
                return NextResponse.json({ error: 'Unauthorized - missing token' }, { status: 401 });
            }

            // Create a Supabase client
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    global: {
                        headers: {
                            Authorization: `Bearer ${authCookie}`
                        }
                    }
                }
            );

            // Verify the user with getUser
            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError || !userData.user) {
                console.error('Sync powers failed: Invalid token', userError);
                return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
            }

            userId = userData.user.id;
        } else {
            userId = requestedUserId;
            console.log(`Using provided userId: ${userId} for power sync`);
        }

        // Create a Supabase client without auth header for admin operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        console.log(`Syncing powers for user ${userId}`);

        // Find all powers in the special_powers table
        const { data: allPowers, error: powersError } = await supabase
            .from('special_powers')
            .select('*');

        if (powersError) {
            console.error('Error fetching power templates:', powersError);
            return NextResponse.json({ error: 'Failed to fetch power templates' }, { status: 500 });
        }

        console.log(`Found ${allPowers?.length || 0} power templates`);

        // Find auto-clicker power
        const autoClickerPower = allPowers?.find(p =>
            p.effect_type === 'auto_click' ||
            p.name?.toLowerCase().includes('auto') ||
            p.name?.toLowerCase().includes('clicker')
        );

        if (!autoClickerPower) {
            console.error('No auto-clicker power template found');
            return NextResponse.json({ error: 'Auto-clicker power template not found' }, { status: 404 });
        }

        // For the problematic user, ensure all standard power IDs (1, 2, 3, 6) are activated
        const fixedPowerIds = userId === '90b28bfc-4b92-4cd5-b183-2040a705e410'
            ? [1, 2, 3, 6, autoClickerPower.id]
            : [autoClickerPower.id];

        console.log(`Special handling for user ${userId}: Checking power IDs: ${fixedPowerIds.join(', ')}`);

        // Result object to track what happened
        const result = {
            created: [] as string[],
            activated: [] as boolean[],
            powerDetails: [] as Record<string, unknown>[]
        };

        // Process each power ID
        for (const powerId of fixedPowerIds) {
            // Check if the user already has this power
            const { data: existingPower, error: existingError } = await supabase
                .from('user_powers')
                .select('*')
                .eq('user_id', userId)
                .eq('power_id', powerId)
                .maybeSingle();

            if (existingError) {
                console.error(`Error checking for existing power ${powerId}:`, existingError);
                continue;
            }

            // If user already has the power, ensure it's active
            if (existingPower) {
                console.log(`User already has power ${powerId}:`, existingPower);

                // If not active, activate it
                if (!existingPower.is_active) {
                    const { error: updateError } = await supabase
                        .from('user_powers')
                        .update({
                            is_active: true,
                            upgrade_confirmed: true
                        })
                        .eq('id', existingPower.id);

                    if (updateError) {
                        console.error(`Error activating existing power ${powerId}:`, updateError);
                        continue;
                    }

                    result.activated.push(powerId);
                    console.log(`Activated existing power ${powerId}`);
                } else {
                    console.log(`Power ${powerId} is already active`);
                }

                result.powerDetails.push(existingPower);
            }
            // Otherwise, create and activate the power for the user
            else {
                console.log(`Creating new power ${powerId} for user`);

                const { data: newPower, error: createError } = await supabase
                    .from('user_powers')
                    .insert({
                        user_id: userId,
                        power_id: powerId,
                        is_active: true,
                        level: 1,
                        expires_at: null,
                        upgrade_confirmed: true
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error(`Error creating new power ${powerId}:`, createError);
                    continue;
                }

                result.created.push(powerId);
                result.powerDetails.push(newPower);
                console.log(`Created and activated new power ${powerId}:`, newPower);
            }
        }

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Unhandled error in /api/sync-powers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 