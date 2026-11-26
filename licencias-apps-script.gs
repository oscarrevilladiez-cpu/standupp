/*  stand UPP comedy · comprobador de licencias (Google Apps Script)
    Este código vive en TU cuenta de Google. Guarda la clave secreta de Payhip
    para que nunca aparezca dentro de la app.
    Solo tienes que cambiar las dos cosas marcadas con  👉  */

// 👉 1. Pega entre las comillas la clave secreta del producto (Payhip → producto → Advanced options)
const CLAVE_SECRETA_PAYHIP = 'PEGA_AQUI_LA_CLAVE';

// 👉 2. Códigos de regalo inventados por ti para compañeros (o para ti). Uno por persona.
//    Ejemplo: ['OSCAR-2026', 'PALOMA-RISAS']   (déjalo así [] si no quieres ninguno)
//    Cada código de regalo vale, como una licencia comprada, para MAX_APARATOS aparatos.
const CODIGOS_REGALO = ['OSCAR-AUTOR'];

// Cuántos aparatos puede activar cada licencia (por ejemplo, móvil y PC)
const MAX_APARATOS = 2;

/* ---------- a partir de aquí no hace falta tocar nada ---------- */
const API = 'https://payhip.com/api/v2/license/';

function doGet(e) {
  const p = (e && e.parameter) || {};
  let r;
  try { r = atender(String(p.accion || 'comprobar'), String(p.clave || '').trim(), String(p.aparato || '').trim()); }
  catch (err) { r = { ok: false, motivo: 'error', detalle: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function atender(accion, clave, aparato) {
  if (!clave) return { ok: false, motivo: 'sin_clave' };
  if (!aparato) return { ok: false, motivo: 'sin_aparato' };
  const regalo = CODIGOS_REGALO.map(c => c.toUpperCase()).indexOf(clave.toUpperCase()) >= 0;
  let datos = null;
  if (!regalo) {
    datos = payhip('get', 'verify?license_key=' + encodeURIComponent(clave));
    if (!datos) return { ok: false, motivo: 'no_existe' };
    if (datos.enabled === false) return { ok: false, motivo: 'desactivada' };
  }
  const props = PropertiesService.getScriptProperties();
  const k = 'ap:' + clave.toUpperCase();
  let lista = JSON.parse(props.getProperty(k) || '[]');
  const ya = lista.indexOf(aparato) >= 0;
  const quien = regalo ? 'Regalo del autor' : (datos.buyer_email || '');

  if (accion === 'comprobar') {
    return ya ? { ok: true, quien: quien } : { ok: false, motivo: 'no_activada' };
  }
  if (accion === 'activar') {
    if (ya) return { ok: true, quien: quien, aparatos: lista.length, max: MAX_APARATOS };
    if (lista.length >= MAX_APARATOS) return { ok: false, motivo: 'limite', max: MAX_APARATOS };
    lista.push(aparato);
    props.setProperty(k, JSON.stringify(lista));
    if (!regalo) payhip('put', 'usage', { license_key: clave });
    return { ok: true, quien: quien, aparatos: lista.length, max: MAX_APARATOS };
  }
  if (accion === 'desactivar') {
    if (ya) {
      lista = lista.filter(a => a !== aparato);
      props.setProperty(k, JSON.stringify(lista));
      if (!regalo) payhip('put', 'decrease', { license_key: clave });
    }
    return { ok: true, aparatos: lista.length };
  }
  return { ok: false, motivo: 'accion_desconocida' };
}

function payhip(metodo, ruta, carga) {
  const opciones = { method: metodo, headers: { 'product-secret-key': CLAVE_SECRETA_PAYHIP }, muteHttpExceptions: true };
  if (carga) opciones.payload = carga;
  const res = UrlFetchApp.fetch(API + ruta, opciones);
  const txt = res.getContentText();
  if (!txt) return null;
  try { const j = JSON.parse(txt); return j && j.data ? j.data : null; } catch (e) { return null; }
}

// Para probar desde el editor: elige "prueba" arriba y pulsa Ejecutar
function prueba() {
  Logger.log(JSON.stringify(atender('comprobar', 'OSCAR-AUTOR', 'prueba-editor')));
}
