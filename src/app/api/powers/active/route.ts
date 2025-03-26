import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    try {
        // Extract token from cookies
        const authCookie = req.cookies.get('sb-access-token')?.value;

        if (!authCookie) {
            console.error('Get active powers failed: Missing auth token in cookies');
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
            console.error('Get active powers failed: Invalid token', userError);
            return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }

        const userId = userData.user.id;
        console.log(`Fetching active powers for user ${userId}`);

        let activePowers = [];

        // Method 1: Try the get_active_powers RPC first (most reliable)
        try {
            const { data: rpcPowers, error: rpcError } = await supabase.rpc('get_active_powers', {
                user_id_param: userId
            });

            if (rpcError) {
                console.error('Error fetching active powers via RPC:', rpcError);
            } else if (rpcPowers && rpcPowers.length > 0) {
                console.log(`Found ${rpcPowers.length} active powers via RPC`, rpcPowers);
                activePowers = rpcPowers;

                // Ensure all powers from RPC are marked as active in the user_powers table
                for (const power of rpcPowers) {
                    const { data: existingPower } = await supabase
                        .from('user_powers')
                        .select('*')
                        .eq('user_id', userId)
                        .eq('power_id', power.power_id)
                        .maybeSingle();

                    if (!existingPower) {
                        // Create a user_powers record if it doesn't exist
                        await supabase
                            .from('user_powers')
                            .insert({
                                user_id: userId,
                                power_id: power.power_id,
                                is_active: true,
                                level: 1
                            });
                    } else if (!existingPower.is_active) {
                        // Update existing power to be active
                        await supabase
                            .from('user_powers')
                            .update({ is_active: true })
                            .eq('id', existingPower.id);
                    }
                }
            }
        } catch (error) {
            console.error('Exception in Method 1:', error);
        }

        // Method 2: Try direct query if no powers found yet
        if (activePowers.length === 0) {
            try {
                const { data: directPowers, error: directError } = await supabase
                    .from('user_powers')
                    .select(`
                        *,
                        power:power_id(*)
                    `)
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (directError) {
                    console.error('Error fetching active powers directly:', directError);
                } else if (directPowers && directPowers.length > 0) {
                    console.log(`Found ${directPowers.length} active powers via direct query`, directPowers);
                    activePowers = directPowers;
                }
            } catch (error) {
                console.error('Exception in Method 2:', error);
            }
        }

        // Method 3: Try special_powers relation if still no powers
        if (activePowers.length === 0) {
            try {
                const { data: specialPowers, error: specialError } = await supabase
                    .from('user_powers')
                    .select(`
                        *,
                        power:special_powers(*)
                    `)
                    .eq('user_id', userId)
                    .eq('is_active', true);

                if (specialError) {
                    console.error('Error fetching active powers via special_powers:', specialError);
                } else if (specialPowers && specialPowers.length > 0) {
                    console.log(`Found ${specialPowers.length} active powers via special_powers`, specialPowers);
                    activePowers = specialPowers;
                }
            } catch (error) {
                console.error('Exception in Method 3:', error);
            }
        }

        // Method 4: Check if any powers exist at all, not just active ones
        if (activePowers.length === 0) {
            try {
                const { data: allPowers, error: allError } = await supabase
                    .from('user_powers')
                    .select('*')
                    .eq('user_id', userId);

                if (allError) {
                    console.error('Error fetching all powers:', allError);
                } else if (allPowers && allPowers.length > 0) {
                    console.log(`Found ${allPowers.length} total powers, checking for potentially active ones`);

                    // Check each power to see if it should be active based on its expiry
                    const potentiallyActive = allPowers.filter(p =>
                        !p.expires_at || new Date(p.expires_at) > new Date()
                    );

                    if (potentiallyActive.length > 0) {
                        console.log(`Found ${potentiallyActive.length} potentially active powers`);

                        // Get power details for each potentially active power
                        const enhancedPowers = [];
                        for (const power of potentiallyActive) {
                            const { data: powerDetails } = await supabase
                                .from('special_powers')
                                .select('*')
                                .eq('id', power.power_id)
                                .single();

                            if (powerDetails) {
                                enhancedPowers.push({
                                    ...power,
                                    power: powerDetails
                                });

                                // Update power to be active
                                await supabase
                                    .from('user_powers')
                                    .update({ is_active: true })
                                    .eq('id', power.id);
                            }
                        }

                        if (enhancedPowers.length > 0) {
                            console.log(`Enhanced ${enhancedPowers.length} powers with details`);
                            activePowers = enhancedPowers;
                        }
                    }
                }
            } catch (error) {
                console.error('Exception in Method 4:', error);
            }
        }

        return NextResponse.json({
            success: true,
            powers: activePowers,
            count: activePowers.length
        });

    } catch (error) {
        console.error('Unhandled error in /api/powers/active:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 