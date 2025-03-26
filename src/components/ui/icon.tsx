'use client';

import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { HTMLAttributes } from 'react';
import { X, MousePointer } from 'lucide-react';

interface IconProps extends HTMLAttributes<HTMLSpanElement> {
    name: string;
    color?: string;
    size?: number;
}

export function Icon({ name, color, size = 24, className, ...props }: IconProps) {
    if (name === 'x') {
        return (
            <span className={cn('flex items-center justify-center', className)} {...props}>
                <X color={color} size={size} />
            </span>
        );
    }

    if (name === 'mouse-pointer' || name === 'mouse-pointer-click') {
        return (
            <span className={cn('flex items-center justify-center', className)} {...props}>
                <MousePointer color={color} size={size} />
            </span>
        );
    }

    const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as React.ComponentType<{ color?: string; size?: number }>;

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in Lucide icons`);
        return <span className={cn('flex h-6 w-6 items-center justify-center', className)} {...props} />;
    }

    return (
        <span
            className={cn('flex items-center justify-center', className)}
            {...props}
        >
            <IconComponent color={color} size={size} />
        </span>
    );
} 