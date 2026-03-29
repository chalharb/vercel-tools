import Link from "next/link";
import { ArrowRightIcon, GitMergeIcon, LayoutListIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const tools = [
  {
    category: "Redirects",
    items: [
      {
        title: "Redirect Manager",
        description: "View, search, and manage all redirects configured on your Vercel project.",
        href: "/redirects/manage",
        icon: LayoutListIcon,
        status: "available" as const,
      },
      {
        title: "Redirect Migration Tool",
        description:
          "Upload, optimize, and import redirects from other platforms or any redirect CSV into Vercel.",
        href: "/redirects/migrate",
        icon: GitMergeIcon,
        status: "available" as const,
      }
    ],
  },
];

export default function Home() {
  return (
    <main className="container mx-auto py-12 px-4">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Vercel Tools</h1>
        <p className="mt-2 text-muted-foreground">
          A collection of utilities for managing your Vercel projects.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {tools.map((section) => (
          <section key={section.category}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {section.category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((tool) => {
                const Icon = tool.icon;
                const isAvailable = tool.status === "available";

                const card = (
                  <Card
                    className={
                      isAvailable
                        ? "group transition-colors hover:border-foreground/30"
                        : "opacity-60"
                    }
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          <CardTitle className="text-base">{tool.title}</CardTitle>
                        </div>
                        {!isAvailable && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Coming soon
                          </Badge>
                        )}
                        {isAvailable && (
                          <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </CardContent>
                  </Card>
                );

                return isAvailable ? (
                  <Link key={tool.title} href={tool.href} className="block">
                    {card}
                  </Link>
                ) : (
                  <div key={tool.title}>{card}</div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
