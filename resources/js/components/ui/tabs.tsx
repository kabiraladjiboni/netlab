import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-3', className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn('inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-night-900/60 p-1 scrollbar-thin', className)}
            {...props}
        />
    );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
                'focus-visible:outline-2 focus-visible:outline-signal data-[state=active]:bg-night-700 data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                className,
            )}
            {...props}
        />
    );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
