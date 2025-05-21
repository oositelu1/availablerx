import * as React from "react"
import { cn } from "@/lib/utils"

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {}

const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative space-y-4", className)}
        {...props}
      />
    )
  }
)
Timeline.displayName = "Timeline"

interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative pb-8 last:pb-0", className)}
        {...props}
      />
    )
  }
)
TimelineItem.displayName = "TimelineItem"

interface TimelineIconProps extends React.HTMLAttributes<HTMLSpanElement> {}

const TimelineIcon = React.forwardRef<HTMLSpanElement, TimelineIconProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border border-muted bg-background",
          className
        )}
        {...props}
      />
    )
  }
)
TimelineIcon.displayName = "TimelineIcon"

interface TimelineConnectorProps extends React.HTMLAttributes<HTMLSpanElement> {}

const TimelineConnector = React.forwardRef<HTMLSpanElement, TimelineConnectorProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "absolute left-4 top-8 -bottom-8 w-[1px] bg-muted-foreground/20",
          className
        )}
        {...props}
      />
    )
  }
)
TimelineConnector.displayName = "TimelineConnector"

interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("ml-12", className)}
        {...props}
      />
    )
  }
)
TimelineContent.displayName = "TimelineContent"

export {
  Timeline,
  TimelineItem,
  TimelineIcon,
  TimelineConnector,
  TimelineContent,
}