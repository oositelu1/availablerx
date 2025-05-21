import * as React from "react"
import { cn } from "@/lib/utils"

interface TimelineIconProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Timeline = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-4", className)}
    {...props}
  />
))
Timeline.displayName = "Timeline"

export const TimelineItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex gap-4", className)}
    {...props}
  />
))
TimelineItem.displayName = "TimelineItem"

export const TimelineIcon = React.forwardRef<
  HTMLDivElement,
  TimelineIconProps
>(({ active, className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
      active 
        ? "border-primary bg-primary/10 text-primary" 
        : "border-muted bg-muted/30 text-muted-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
TimelineIcon.displayName = "TimelineIcon"

export const TimelineConnector = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("absolute left-4 top-8 bottom-0 w-0.5 bg-border", className)}
    {...props}
  />
))
TimelineConnector.displayName = "TimelineConnector"

export const TimelineContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 pb-8", className)}
    {...props}
  />
))
TimelineContent.displayName = "TimelineContent"

export const TimelineTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("font-medium", className)}
    {...props}
  />
))
TimelineTitle.displayName = "TimelineTitle"

export const TimelineTime = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
TimelineTime.displayName = "TimelineTime"

export const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm", className)}
    {...props}
  />
))
TimelineDescription.displayName = "TimelineDescription"