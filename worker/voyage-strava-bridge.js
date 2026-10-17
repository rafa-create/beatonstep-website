// Retour OAuth discret pour Voyage : aucune interface BeatOnStep ni jeton OAuth stocké ici.
// Le domaine beatonstep.app reste le domaine de rappel Strava autorisé.
const DESTINATION="https://voyage.site-ready.workers.dev/api/public/strava-retour";
export function voyageStravaBridge(request,url=new URL(request.url)){
  if(request.method!=="GET")return new Response("Method Not Allowed",{status:405});
  const state=url.searchParams.get("state")||"";
  if(!/^[a-f0-9]{64}$/.test(state))return new Response("Lien de connexion expiré ou invalide.",{status:400});
  const code=url.searchParams.get("code")||"";
  const error=url.searchParams.get("error")||"";
  if(!(/^[A-Za-z0-9_-]{1,1024}$/.test(code)||/^[a-z_]{1,64}$/.test(error))){
    return new Response("Réponse Strava invalide.",{status:400});
  }
  const target=new URL(DESTINATION);
  target.searchParams.set("state",state);
  if(code)target.searchParams.set("code",code);
  if(error)target.searchParams.set("error",error);
  const scope=url.searchParams.get("scope")||"";
  if(scope.length<=256)target.searchParams.set("scope",scope);
  return new Response(null,{status:302,headers:{
    Location:target.href,
    "Cache-Control":"no-store",
    "Referrer-Policy":"no-referrer",
    "X-Robots-Tag":"noindex, nofollow"
  }});
}
