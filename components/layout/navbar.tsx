"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/blocks/theme/theme-toggle";
import { ToolCase } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

const redirectItems: { title: string; href: string; description: string }[] = [
  {
    title: "Manager",
    href: "/redirects",
    description: "View and manage Vercel redirects",
  },
  {
    title: "Migration Tool",
    href: "/redirects/migrate",
    description: "Bulk import and optimize redirects into Vercel",
  },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-1">
            <ToolCase className="h-5 w-5" />
            <span className="font-semibold tracking-tight">
              Vercel Management Tools
            </span>
          </Link>

          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  active={pathname === "/"}
                  href="/"
                  className={navigationMenuTriggerStyle()}
                >
                  Home
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    pathname.startsWith("/redirects") && "bg-muted/50"
                  )}
                >
                  Redirects
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="w-96">
                    {redirectItems.map((item) => (
                      <ListItem
                        key={item.title}
                        title={item.title}
                        href={item.href}
                        active={pathname === item.href}
                      >
                        {item.description}
                      </ListItem>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ListItem({
  title,
  children,
  href,
  active,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string; active?: boolean }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild active={active}>
        <Link href={href}>
          <div className="flex flex-col gap-1 text-sm">
            <div className="leading-none font-medium">{title}</div>
            <div className="line-clamp-2 text-muted-foreground">{children}</div>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
