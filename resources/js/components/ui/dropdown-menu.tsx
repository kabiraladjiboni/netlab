import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as React from 'react';
import { cn } from '@/lib/utils';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                sideOffset={sideOffset}
                align={align}
                collisionPadding={12}
                className={cn(
                    'z-50 min-w-56 overflow-hidden rounded-xl border border-line bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-[var(--shadow-color)]',
                    'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    className,
                )}
                {...props}
            />
        </DropdownMenuPrimitive.Portal>
    );
}

function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
    return (
        <DropdownMenuPrimitive.Item
            className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-night-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
    return <DropdownMenuPrimitive.Label className={cn('px-2.5 py-2 text-sm', className)} {...props} />;
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return <DropdownMenuPrimitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-line', className)} {...props} />;
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger };
