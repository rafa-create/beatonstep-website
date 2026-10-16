// Existing Resend configuration, already used for account-password emails.
// One alert per original sporting win. The mobile user never supplies a mail
// recipient, and credentials and full GPS traces never leave the Worker.
export async function processPendingSportWarningEmails(db,env,{now=Date.now(),send=fetch}={}){
  if(!env.RESEND_API_KEY||!env.PASSWORD_RESET_EMAIL_FROM)return 0;
  // Exactly the existing admin-account address. No separate destination secret.
  const admin=await db.prepare(
    'SELECT email FROM admin_users WHERE disabled=0 ORDER BY email LIMIT 1'
  ).first();
  if(!admin?.email)return 0;
  const pending=await db.prepare(`SELECT m.card_id,m.owner_epoch,
    c.distance_cm,c.time_unit,c.sub_value,s.peak_speed_kmh
    FROM sport_card_telemetry_mail_delivery m
    JOIN sport_card_telemetry_reviews tr ON tr.card_id=m.card_id
      AND tr.owner_epoch=m.owner_epoch AND tr.state='warning'
    JOIN sport_world_cards c ON c.id=m.card_id
    LEFT JOIN sport_card_telemetry_speed_details s
      ON s.card_id=m.card_id AND s.owner_epoch=m.owner_epoch
    WHERE m.state IN ('pending','sending') AND m.next_attempt_at<=?
      AND m.attempts<6
    ORDER BY tr.created_at ASC LIMIT 10`).bind(now).all();
  let sent=0;
  for(const item of pending.results||[]){
    // Claim for 2 minutes, with an idempotent Resend request ID as fallback.
    const claim=await db.prepare(`UPDATE sport_card_telemetry_mail_delivery
      SET state='sending',attempts=attempts+1,next_attempt_at=?
      WHERE card_id=? AND owner_epoch=? AND next_attempt_at<=?
        AND state IN ('pending','sending') AND attempts<6`)
      .bind(now+120000,item.card_id,item.owner_epoch,now).run();
    if(Number(claim?.meta?.changes)!==1)continue;
    const distance=item.distance_cm===40000?'400 m':
      (item.distance_cm/100000).toLocaleString('fr-FR')+' km';
    const speed=typeof item.peak_speed_kmh==='number'
      ?'⚠ Pointe GPS mesurée : '+item.peak_speed_kmh.toLocaleString('fr-FR')+' km/h.\n'
      :'⚠ Anomalie de télémétrie détectée.\n';
    try{
      const result=await send('https://api.resend.com/emails',{
        method:'POST',
        headers:{
          authorization:'Bearer '+env.RESEND_API_KEY,
          'content-type':'application/json',
          'Idempotency-Key':'bos-warning-'+item.card_id+'-'+item.owner_epoch,
        },
        body:JSON.stringify({
          from:env.PASSWORD_RESET_EMAIL_FROM,to:[admin.email],
          subject:'BeatOnStep — performance à vérifier, carte #'+item.card_id,
          text:'Une performance a été publiée avec un warning.\n\n'+
            distance+' · SUB '+item.sub_value+' '+
            (item.time_unit==='second'?'s':'min')+'\n'+speed+
            'Carte #'+item.card_id+' · époque '+item.owner_epoch+'\n\n'+
            'Examiner : https://beatonstep.app/admin.html#warnings\n'+
            'La carte reste attribuée, y compris pendant l’examen.\n',
        }),
      });
      if(!result.ok)throw Error('resend_http_'+result.status);
      await db.prepare(`UPDATE sport_card_telemetry_mail_delivery
        SET state='sent',sent_at=?,next_attempt_at=0
        WHERE card_id=? AND owner_epoch=? AND state='sending'`)
        .bind(Date.now(),item.card_id,item.owner_epoch).run();
      sent++;
    }catch(error){
      console.warn('sport warning mail deferred',String(error?.message||'unknown').slice(0,50));
      // Cron retries; card ownership and its public warning remain untouched.
      await db.prepare(`UPDATE sport_card_telemetry_mail_delivery
        SET state='pending',next_attempt_at=?
        WHERE card_id=? AND owner_epoch=? AND state='sending'`)
        .bind(now+15*60000,item.card_id,item.owner_epoch).run();
    }
  }
  return sent;
}
