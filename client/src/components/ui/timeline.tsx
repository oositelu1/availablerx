import * as React from "react";
import { cn } from "@/lib/utils";

interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {}

const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-1", className)}
        {...props}
      />
    );
  }
);
Timeline.displayName = "Timeline";

interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, active = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative pl-6 pb-8 last:pb-0",
          className
        )}
        {...props}
      />
    );
  }
);
TimelineItem.displayName = "TimelineItem";

interface TimelineIconProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

const TimelineIcon = React.forwardRef<HTMLDivElement, TimelineIconProps>(
  ({ className, active = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute left-0 rounded-full border p-1",
          active 
            ? "bg-primary border-primary text-primary-foreground" 
            : "bg-background border-muted-foreground/30",
          className
        )}
        {...props}
      />
    );
  }
);
TimelineIcon.displayName = "TimelineIcon";

interface TimelineConnectorProps extends React.HTMLAttributes<HTMLDivElement> {}

const TimelineConnector = React.forwardRef<HTMLDivElement, TimelineConnectorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute left-2.5 top-7 -ml-px h-full w-0.5 -translate-x-1/2 bg-muted last:hidden",
          className
        )}
        {...props}
      />
    );
  }
);
TimelineConnector.displayName = "TimelineConnector";

interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const TimelineContent = React.forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("pt-1", className)}
        {...props}
      />
    );
  }
);
TimelineContent.displayName = "TimelineContent";

interface TimelineTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const TimelineTitle = React.forwardRef<HTMLHeadingElement, TimelineTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn("font-medium leading-tight", className)}
        {...props}
      />
    );
  }
);
TimelineTitle.displayName = "TimelineTitle";

interface TimelineTimeProps extends React.HTMLAttributes<HTMLTimeElement> {}

const TimelineTime = React.forwardRef<HTMLTimeElement, TimelineTimeProps>(
  ({ className, ...props }, ref) => {
    return (
      <time
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    );
  }
);
TimelineTime.displayName = "TimelineTime";

interface TimelineDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const TimelineDescription = React.forwardRef<HTMLParagraphElement, TimelineDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-muted-foreground", className)}
        {...props}
      />
    );
  }
);
TimelineDescription.displayName = "TimelineDescription";

export {
  Timeline,
  TimelineItem,
  TimelineIcon,
  TimelineConnector,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription
};