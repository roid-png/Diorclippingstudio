import { createFileRoute } from "@tanstack/react-router";
import { AuthFormCard } from "@/features/auth/components/AuthFormCard";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/_auth/sign-in")({
  head: () => ({ meta: [{ title: `Masuk ke Studio | ${siteConfig.name}` }] }),
  component: () => <AuthFormCard mode="sign-in" />,
});
