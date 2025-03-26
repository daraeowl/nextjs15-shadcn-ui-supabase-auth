import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Extract token from cookies
        const authCookie = req.cookies.get('sb-access-token')?.value;

        if (!authCookie) {
            console.error('Activate power failed: Missing auth token in cookies');
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
            console.error('Activate power failed: Invalid token', userError);
            return NextResponse.json({ error: 'Unauthorized - invalid token' }, { status: 401 });
        }

        const userId = userData.user.id;
        const body = await req.json();
        const { powerId } = body;

        if (!powerId) {
            console.error('Activate power failed: Missing powerId in request body');
            return NextResponse.json({ error: 'Power ID is required' }, { status: 400 });
        }

        console.log(`Activating power ${powerId} for user ${userId}`);

        // First get current status of the power
        const { data: powerData, error: powerError } = await supabase
            .from('user_powers')
            .select('id, power_id, is_active')
            .eq('user_id', userId)
            .eq('power_id', powerId)
            .single();

        if (powerError) {
            console.error('Activate power failed: Error checking power status', powerError);
        } else {
            console.log('Current power status:', powerData);
        }

        // Call the function to activate the power
        // This RPC function should have proper RLS policies in place
        const { data, error } = await supabase.rpc('activate_user_power', {
            p_user_id: userId,
            p_power_id: powerId
        });

        if (error) {
            console.error('Error activating power:', error);
            return NextResponse.json({
                error: 'Failed to activate power',
                details: error.message
            }, { status: 500 });
        }

        // Double-check the power was actually activated
        const { data: verifyData, error: verifyError } = await supabase
            .from('user_powers')
            .select('id, power_id, is_active')
            .eq('user_id', userId)
            .eq('power_id', powerId)
            .single();

        if (verifyError) {
            console.error('Error verifying power activation:', verifyError);
        } else {
            console.log('Power status after activation:', verifyData);

            // If the power isn't active after calling the RPC, force update it
            if (!verifyData.is_active) {
                console.log('Power not marked as active after RPC call. Forcing update...');

                const { error: updateError } = await supabase
                    .from('user_powers')
                    .update({ is_active: true })
                    .eq('user_id', userId)
                    .eq('power_id', powerId);

                if (updateError) {
                    console.error('Error force updating power status:', updateError);
                } else {
                    console.log('Power status force updated to active');
                }
            }
        }

        return NextResponse.json({
            success: true,
            activated: data,
            verified: verifyData ? verifyData.is_active : null
        });

    } catch (error) {
        console.error('Unhandled error in /api/powers/activate:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 