"use client"

import * as React from "react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VolumeSliderProps {
    className?: string
    value?: number
    defaultValue?: number
    onValueChange?: (value: number) => void
    showIcon?: boolean
    size?: "sm" | "md" | "lg"
    showMuteButton?: boolean
    step?: number
    min?: number
    max?: number
}

export function VolumeSlider({
    className,
    value,
    defaultValue = 50,
    onValueChange,
    showIcon = true,
    size = "md",
    showMuteButton = true,
    step = 1,
    min = 0,
    max = 100,
    ...props
}: VolumeSliderProps & Omit<React.ComponentProps<typeof Slider>, "value" | "defaultValue" | "onValueChange">) {
    const [volume, setVolume] = React.useState<number>(value !== undefined ? value : defaultValue)
    const [previousVolume, setPreviousVolume] = React.useState<number>(volume)
    const [isMuted, setIsMuted] = React.useState<boolean>(volume === 0)

    React.useEffect(() => {
        if (value !== undefined) {
            setVolume(value)
            setIsMuted(value === 0)
        }
    }, [value])

    const handleValueChange = (values: number[]) => {
        const newVolume = values[0]
        setVolume(newVolume)
        setIsMuted(newVolume === 0)

        if (onValueChange) {
            onValueChange(newVolume)
        }
    }

    const toggleMute = () => {
        if (isMuted) {
            // Unmute - restore previous volume
            const newVolume = previousVolume > 0 ? previousVolume : defaultValue
            setVolume(newVolume)
            setIsMuted(false)
            if (onValueChange) {
                onValueChange(newVolume)
            }
        } else {
            // Mute - store current volume for later
            setPreviousVolume(volume)
            setVolume(0)
            setIsMuted(true)
            if (onValueChange) {
                onValueChange(0)
            }
        }
    }

    // Determine which volume icon to show based on volume level
    const VolumeIcon = React.useMemo(() => {
        if (isMuted || volume === 0) return VolumeX
        if (volume < 33) return Volume
        if (volume < 67) return Volume1
        return Volume2
    }, [volume, isMuted])

    // Size variants
    const sizeClasses = {
        sm: "max-w-24",
        md: "max-w-40",
        lg: "max-w-60",
    }

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 20,
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {showMuteButton && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="h-8 w-8 rounded-full"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                >
                    <VolumeIcon size={iconSizes[size]} />
                </Button>
            )}

            {showIcon && !showMuteButton && (
                <VolumeIcon size={iconSizes[size]} className="mr-1.5" />
            )}

            <div className={cn("flex-grow", sizeClasses[size])}>
                <Slider
                    value={[volume]}
                    min={min}
                    max={max}
                    step={step}
                    onValueChange={handleValueChange}
                    {...props}
                />
            </div>
        </div>
    )
} 