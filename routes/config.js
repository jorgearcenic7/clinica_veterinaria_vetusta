import { Router } from "express";
import { cleanEnvValue, escapeJavaScript, validateSupabaseUrl } from "../lib/utils.js";

const router = Router();

router.get("/api/supabase-config", (_request, response) => {
  const publicSupabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
  const publicSupabaseAnonKey = cleanEnvValue(process.env.SUPABASE_ANON_KEY);

  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    response.status(500).json({
      error:
        "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en las variables de entorno.",
    });
    return;
  }

  try {
    response.json({
      supabaseUrl: validateSupabaseUrl(publicSupabaseUrl),
      supabaseAnonKey: publicSupabaseAnonKey,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

router.get("/analytics.js", (_request, response) => {
  const gaId = cleanEnvValue(
    process.env.NEXT_PUBLIC_GA_ID || process.env.VITE_GA_ID,
  );
  response.type("application/javascript");
  response.set("Cache-Control", "public, max-age=300");

  if (!gaId) {
    response.send("");
    return;
  }

  response.send(`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${escapeJavaScript(gaId)}');
(function(){
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}';
  document.head.appendChild(script);
})();
`);
});

export default router;
