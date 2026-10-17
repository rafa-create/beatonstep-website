// Relais OAuth dédié à l'espace privé Voyage, sans interface BeatOnStep.
// Le domaine de rappel enregistré auprès de Strava reste beatonstep.app.
const REDIRECT="https://voyage.site-ready.workers.dev/api/public/strava-retour";
export function voyageStravaBridge(request,url){
  if(request.method!=="GET")return new Response("Méthode non autorisée",{status:405});
  const state=url.searchParams.get("state")||"";
  const code=url.searchParams.get("code")||"";
  const error=url.searchParams.get("error")||"";
  if(!/^[a-f0-9]{64}$/.test(state))return new Response("Lien expiré.",{status:400});
  if(!code&&!error)return new Response("Réponse Strava incomplète.",{status:400});
  if(code && (code.length>1024 || !/^[A-Za-z0-9_-]+$/.test(code)))
    return new Response("Code invalide.",{status:400});
  if(error && !/^[a-z_]{1,80}$/.test(error))return new Response("Erreur invalide.",{status:400});
  const destination=new URL(REDIRECT);
  destination.searchParams.set("state",state);
  if(code)destination.searchParams.set("code",code);
  if(error)destination.searchParams.set("error",error);
  const scope=url.searchParams.get("scope")||"";
  if(scope.length<150)destination.searchParams.set("scope",scope);
  return new Response(null,{status:302,headers:{
    Location:destination.href,"Cache-Control":"no-store",
    "Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex,nofollow"
  }});
}
