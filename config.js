// Configuration de la synchronisation Supabase.
// Gamelle utilise le même projet que Fonte : même compte, tables séparées.
// Ces deux valeurs sont faites pour être publiques : la sécurité repose sur les règles RLS
// créées par supabase/schema.sql. Ne mets JAMAIS la clé « secret » ou « service_role » ici.
// Laisse vide pour utiliser l'app sans synchro (données sur l'appareil uniquement).

window.GAMELLE_CONFIG = {
  supabaseUrl: 'https://kjlpavfrikmruardqkoj.supabase.co',
  supabaseKey: 'sb_publishable_3rMHt7xOerlTburnGV7CAQ_-vqQaAjA',
};
