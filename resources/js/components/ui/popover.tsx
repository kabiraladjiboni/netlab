import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';
import { cn } from '@/lib/utils';

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({ className, align = 'center', sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                align={align}
                sideOffset={sideOffset}
                collisionPadding={12}
                className={cn(
                    'z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-popover p-4 text-popover-foreground shadow-2xl shadow-[var(--shadow-color)] outline-none',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    className,
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}

export { Popover, PopoverContent, PopoverTrigger };
