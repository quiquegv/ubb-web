#!/usr/bin/env python3
"""Actualiza datos/resultados.json leyendo las páginas públicas de competiciones.feb.es.

Para añadir un equipo, copia una línea de EQUIPOS y cambia sus datos
(a = federación/delegación, c = competición, g = grupo).
"""
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

UA = "UBB-web/1.0 (+https://github.com/quiquegv/ubb-web)"
BASE = "https://competiciones.feb.es/autonomicas/"
SALIDA = "datos/resultados.json"
PAUSA = 1.5   # segundos entre consultas, para no saturar la web de la federación
CLUB = "BARBASTRO"  # texto que identifica a nuestros equipos en las tablas

EQUIPOS = [
    {"id": "primer-equipo",       "a": 3,  "c": "23475", "g": "90064"},  # Tercera FEB, grupo C-B
    {"id": "senior-masculino",    "a": 3,  "c": "24077", "g": "90096"},  # Segunda Aragonesa Masc., grupo 03
    {"id": "senior-femenino",     "a": 3,  "c": "24078", "g": "90107"},  # Tercera Aragonesa Fem., grupo 02
    {"id": "junior-masculino",    "a": 3,  "c": "24073", "g": "90125"},  # Cº Aragón Junior Masc. 3ª, grupo 02
    {"id": "cadete-femenino",     "a": 30, "c": "24099", "g": "90265"},  # Huesca
    {"id": "cadete-masculino",    "a": 30, "c": "24240", "g": "90264"},  # Huesca
    {"id": "infantil-masculino",  "a": 30, "c": "24242", "g": "90266"},  # Huesca
]


def descargar(ruta, datos=None):
    """Descarga una página (GET) o envía un formulario (POST). Reintenta si falla."""
    ultimo = None
    for intento in range(3):
        time.sleep(PAUSA if intento == 0 else 5 * intento)
        try:
            cabeceras = {"User-Agent": UA}
            cuerpo = None
            if datos is not None:
                cuerpo = urllib.parse.urlencode(datos).encode()
                cabeceras["Content-Type"] = "application/x-www-form-urlencoded"
            peticion = urllib.request.Request(BASE + ruta, data=cuerpo, headers=cabeceras)
            with urllib.request.urlopen(peticion, timeout=60) as r:
                crudo = r.read()
            try:
                return crudo.decode("utf-8")
            except UnicodeDecodeError:
                return crudo.decode("cp1252", errors="replace")
        except Exception as e:  # noqa: BLE001
            ultimo = e
    raise RuntimeError("no se pudo descargar %s: %s" % (ruta, ultimo))


def limpio(t):
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def etiqueta(pagina, id_):
    m = re.search(r'id="%s"[^>]*>(.*?)</span>' % re.escape(id_), pagina, re.S)
    return limpio(m.group(1)) if m else None


def elegido(pagina, nombre):
    m = re.search(r'<select name="%s".*?</select>' % re.escape(nombre), pagina, re.S)
    if not m:
        return None, None
    s = re.search(r'<option selected="selected" value="([^"]*)">(.*?)</option>', m.group(0), re.S)
    if not s:
        s = re.search(r'<option[^>]*value="([^"]*)">(.*?)</option>', m.group(0), re.S)
    return (s.group(1), limpio(s.group(2))) if s else (None, None)


def filas(pagina, id_tabla):
    i = pagina.find('id="%s"' % id_tabla)
    if i < 0:
        return None
    fin = pagina.find("</table>", i)
    return re.findall(r"<tr[^>]*>(.*?)</tr>", pagina[i:fin], re.S)


def entero(t):
    try:
        return int(t)
    except (TypeError, ValueError):
        return None


def clasificacion(pagina):
    res = []
    for fila in filas(pagina, "clasificacionDataGrid") or []:
        c = [limpio(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", fila, re.S)]
        if len(c) >= 9 and c[0].isdigit():
            res.append({"pos": int(c[0]), "equipo": c[1], "pj": entero(c[2]), "pg": entero(c[3]),
                        "pp": entero(c[4]), "pf": entero(c[5]), "pc": entero(c[6]),
                        "pts": entero(c[7]), "dif": c[8]})
    return res


def separar(texto, conocidos):
    """Divide 'LOCAL - VISITANTE' aunque los nombres lleven guiones."""
    partes = texto.split(" - ")
    if len(partes) == 2:
        return partes[0].strip(), partes[1].strip()
    for exigir_ambos in (True, False):
        for k in range(1, len(partes)):
            a, b = " - ".join(partes[:k]), " - ".join(partes[k:])
            if (a in conocidos and b in conocidos) if exigir_ambos else (a in conocidos or b in conocidos):
                return a, b
    return None


def partidos(pagina, id_tabla, conocidos):
    res = []
    for fila in filas(pagina, id_tabla) or []:
        celdas = re.findall(r"<td[^>]*>(.*?)</td>", fila, re.S)
        if len(celdas) < 4:
            continue
        spans = [limpio(s) for s in re.findall(r"<span[^>]*>(.*?)</span>", celdas[0], re.S)]
        if not spans:
            continue
        texto = spans[0]
        campo = None
        if len(spans) > 1:
            campo = re.sub(r"^Campo:\s*", "", spans[1])
            campo = re.sub(r"^(0-)+", "", campo).strip()
            if not campo or "DESCONOCIDO" in campo.upper():
                campo = None
        marcador = limpio(celdas[1])
        hora = limpio(celdas[3])
        par = separar(texto, conocidos)
        res.append({
            "texto": texto,
            "local": par[0] if par else None,
            "visitante": par[1] if par else None,
            "resultado": marcador if re.fullmatch(r"\d+\s*-\s*\d+", marcador) else None,
            "fecha": limpio(celdas[2]) or None,
            "hora": None if hora in ("", "00:00") else hora,
            "campo": campo,
        })
    return res


def analizar(pagina):
    """Convierte una página de 'Resultados y Clasificación' en datos."""
    tabla = clasificacion(pagina)
    conocidos = {f["equipo"] for f in tabla}
    jornada = partidos(pagina, "jornadaDataGrid", conocidos)
    proxima = partidos(pagina, "proximaJornadaDataGrid", conocidos)
    for p in jornada + proxima:
        if p["local"]:
            conocidos.update((p["local"], p["visitante"]))
    # segunda pasada, ya con más nombres conocidos
    jornada = partidos(pagina, "jornadaDataGrid", conocidos)
    proxima = partidos(pagina, "proximaJornadaDataGrid", conocidos)
    return {
        "competicion": etiqueta(pagina, "controlNavegacion_subTituloLabel"),
        "grupo": elegido(pagina, "gruposDropDownList")[1],
        "jornada": {"titulo": etiqueta(pagina, "jornadaCabeceraSeccion_tituloLabel"), "partidos": jornada},
        "proxima": {"titulo": etiqueta(pagina, "proximaJornadaCabeceraSeccion_tituloLabel"), "partidos": proxima},
        "clasificacion": tabla,
    }


def campos_ocultos(pagina):
    return {m.group(1): html.unescape(m.group(2))
            for m in re.finditer(r'<input type="hidden" name="([^"]+)"[^>]*value="([^"]*)"', pagina)}


def pagina_del_grupo(a, c, g):
    """Descarga la página de resultados y, si hace falta, cambia al grupo pedido."""
    ruta = "Resultados.aspx?a=%d&c=%s&med=0" % (a, c)
    pagina = descargar(ruta)
    if elegido(pagina, "gruposDropDownList")[0] == g:
        return pagina
    f = campos_ocultos(pagina)
    f["controlNavegacion:categoriasDropDownList"] = elegido(pagina, "controlNavegacion:categoriasDropDownList")[0]
    f["controlNavegacion:temporadasDropDownList"] = elegido(pagina, "controlNavegacion:temporadasDropDownList")[0]
    f["gruposDropDownList"] = g
    f["jornadasDropDownList"] = elegido(pagina, "jornadasDropDownList")[0]
    f["__EVENTTARGET"] = "gruposDropDownList"
    f["__EVENTARGUMENT"] = ""
    pagina = descargar(ruta, datos=f)
    if elegido(pagina, "gruposDropDownList")[0] != g:
        raise RuntimeError("la web no cambió al grupo %s" % g)
    return pagina


def main():
    try:
        anterior = json.load(open(SALIDA, encoding="utf-8"))
    except (OSError, ValueError):
        anterior = {}
    previos = anterior.get("equipos", {})
    equipos, errores = {}, []

    for e in EQUIPOS:
        try:
            datos = analizar(pagina_del_grupo(e["a"], e["c"], e["g"]))
            if not datos["clasificacion"] and not datos["jornada"]["partidos"]:
                raise RuntimeError("la página no tiene el formato esperado")
            datos["club"] = CLUB
            datos["url"] = "%sResultados.aspx?a=%d&c=%s&med=0" % (BASE, e["a"], e["c"])
            equipos[e["id"]] = datos
            print("OK   ", e["id"], "-", datos["competicion"], "|", datos["grupo"])
        except Exception as ex:  # noqa: BLE001
            errores.append("%s: %s" % (e["id"], ex))
            if e["id"] in previos:
                equipos[e["id"]] = previos[e["id"]]
            print("FALLO", e["id"], "-", ex)

    huella = hashlib.sha256(json.dumps(equipos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    if anterior.get("huella") == huella:
        actualizado = anterior.get("actualizado")
    else:
        actualizado = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump({"actualizado": actualizado, "huella": huella, "equipos": equipos}, f, ensure_ascii=False, indent=1)
    if errores:
        print("\nHubo errores:\n- " + "\n- ".join(errores))
        sys.exit(1)


if __name__ == "__main__":
    main()
