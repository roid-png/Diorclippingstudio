import { createFileRoute } from "@tanstack/react-router";
import { AuthFormCard } from "@/features/auth/components/AuthFormCard";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/_auth/sign-up")({
  head: () => ({ meta: [{ title: `Daftar Akun Baru (50 Kuota) | ${siteConfig.name}` }] }),
  component: () => <AuthFormCard mode="sign-up" />,
});
