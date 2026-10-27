import { createFileRoute, redirect } from "@tanstack/react-router";
import { api as supabase } from "@/lib/express-api";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, 
      { title: "Omshree Medicals – Billing" },
      { name: "description", content: "Sign in to Omshree Medicals billing." },
      { property: "og:title", content: "Omshree Medicals – Billing" },
      { property: "og:description", content: "Sign in to Omshree Medicals billing." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
});
