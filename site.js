/* Unión Basket Barbastro — comportamiento común del sitio */
(function(){
  // Imágenes sueltas (solo en el archivo único de prueba)
  if (window.UBB_ASSETS) {
    document.querySelectorAll('img[data-asset]').forEach(function(i){ i.src = window.UBB_ASSETS[i.dataset.asset]; });
  }

  // Menú móvil
  var burger = document.querySelector('.burger');
  var menu = document.querySelector('nav.menu');
  if (burger && menu) {
    burger.addEventListener('click', function(){
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function(e){ if (e.target.tagName === 'A') menu.classList.remove('open'); });
  }

  // Carrusel de la portada
  var slides = document.querySelectorAll('.hero-slide');
  var dots = document.querySelectorAll('.dot');
  var current = 0;
  function showSlide(i){
    slides.forEach(function(s){ s.classList.remove('active'); });
    dots.forEach(function(d){ d.classList.remove('active'); });
    slides[i].classList.add('active');
    dots[i].classList.add('active');
    current = i;
  }
  if (slides.length) {
    dots.forEach(function(dot, i){ dot.addEventListener('click', function(){ showSlide(i); }); });
    setInterval(function(){ showSlide((current + 1) % slides.length); }, 4500);
  }

  // Resultados y clasificaciones (datos/resultados.json, lo actualiza un programa automático)
  var NOMBRES = {
    'primer-equipo': 'Primer equipo · Tercera FEB',
    'senior-masculino': 'Senior masculino',
    'senior-femenino': 'Senior femenino',
    'junior-masculino': 'Junior masculino',
    'cadete-femenino': 'Cadete femenino',
    'cadete-masculino': 'Cadete masculino',
    'infantil-masculino': 'Infantil masculino'
  };
  var DATOS = null;

  function el(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function bloquePartidos(titulo, lista, club){
    var frag = document.createDocumentFragment();
    frag.appendChild(el('h4', null, titulo || ''));
    if (!lista.length) { frag.appendChild(el('p', 'modal-note', 'Sin partidos publicados.')); return frag; }
    lista.forEach(function(p){
      var fila = el('div', 'match');
      var nuestro = function(n){ return n && n.toUpperCase().indexOf(club) !== -1; };
      if (p.local) {
        fila.appendChild(el('span', 'home' + (nuestro(p.local) ? ' ours' : ''), p.local));
        fila.appendChild(el('span', 'score' + (p.resultado ? '' : ' pending'), p.resultado || 'pendiente'));
        fila.appendChild(el('span', 'away' + (nuestro(p.visitante) ? ' ours' : ''), p.visitante));
      } else {
        fila.appendChild(el('span', 'home', p.texto));
        fila.appendChild(el('span', 'score' + (p.resultado ? '' : ' pending'), p.resultado || 'pendiente'));
        fila.appendChild(el('span'));
      }
      var info = [p.fecha, p.hora, p.campo].filter(Boolean).join(' · ');
      if (info) fila.appendChild(el('span', 'match-info', info));
      frag.appendChild(fila);
    });
    return frag;
  }

  function bloqueClasificacion(tabla, club){
    var frag = document.createDocumentFragment();
    frag.appendChild(el('h4', null, 'Clasificación'));
    if (!tabla.length) {
      frag.appendChild(el('p', 'modal-note', 'La clasificación aparecerá cuando se hayan jugado los primeros partidos.'));
      return frag;
    }
    var t = el('table', 'standings');
    var cab = el('tr');
    ['#', 'Equipo', 'PJ', 'PG', 'PP', 'PF', 'PC', 'Pts'].forEach(function(h){ cab.appendChild(el('th', null, h)); });
    t.appendChild(cab);
    tabla.forEach(function(f){
      var tr = el('tr', f.equipo.toUpperCase().indexOf(club) !== -1 ? 'ours' : '');
      [f.pos, f.equipo, f.pj, f.pg, f.pp, f.pf, f.pc, f.pts].forEach(function(v){ tr.appendChild(el('td', null, v)); });
      t.appendChild(tr);
    });
    frag.appendChild(t);
    return frag;
  }

  function abrirResultados(id){
    var e = DATOS && DATOS.equipos && DATOS.equipos[id];
    var dlg = document.getElementById('resultados');
    if (!e || !dlg) return;
    document.getElementById('resultados-titulo').textContent = NOMBRES[id] || id;
    document.getElementById('resultados-sub').textContent = [e.competicion, e.grupo].filter(Boolean).join(' · ');
    var cuerpo = document.getElementById('resultados-body');
    cuerpo.textContent = '';
    cuerpo.appendChild(bloquePartidos(e.jornada.titulo, e.jornada.partidos, e.club));
    cuerpo.appendChild(bloquePartidos(e.proxima.titulo, e.proxima.partidos, e.club));
    cuerpo.appendChild(bloqueClasificacion(e.clasificacion, e.club));
    var pie = el('div', 'modal-foot');
    var cuando = DATOS.actualizado ? new Date(DATOS.actualizado) : null;
    pie.appendChild(el('span', null, cuando && !isNaN(cuando) ? 'Actualizado: ' + cuando.toLocaleString('es-ES', {timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short'}) : ''));
    var enlace = el('a', null, 'Ver en la web oficial ↗');
    enlace.href = e.url; enlace.target = '_blank'; enlace.rel = 'noopener';
    pie.appendChild(enlace);
    cuerpo.appendChild(pie);
    dlg.showModal();
  }

  function activarResultados(){
    if (!document.querySelector('[data-equipo], [data-resultados]')) return;
    if (!window.fetch) return;
    fetch('datos/resultados.json', {cache: 'no-cache'})
      .then(function(r){ if (!r.ok) throw new Error('sin datos'); return r.json(); })
      .then(function(d){
        DATOS = d;
        document.querySelectorAll('[data-equipo]').forEach(function(tag){
          var id = tag.dataset.equipo;
          if (!d.equipos || !d.equipos[id]) return;
          var b = el('button', 'mini-btn', 'Resultados');
          b.type = 'button'; b.dataset.resultados = id;
          tag.replaceWith(b);
        });
        document.querySelectorAll('[data-resultados][hidden]').forEach(function(b){
          if (d.equipos && d.equipos[b.dataset.resultados]) b.hidden = false;
        });
      })
      .catch(function(){ /* sin datos: se queda "Próximamente" */ });
  }
  activarResultados();

  document.addEventListener('click', function(e){
    var dlg = document.getElementById('resultados');
    var abrir = e.target.closest('[data-resultados]');
    if (abrir) { abrirResultados(abrir.dataset.resultados); return; }
    if (dlg && (e.target.closest('[data-modal-close]') || e.target === dlg)) dlg.close();
  });

  // Navegación entre páginas del archivo único de prueba
  if (window.UBB_SPA) {
    var pages = document.querySelectorAll('.page');
    function route(){
      var parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
      var name = parts[0] || 'home', anchor = parts[1];
      var el = document.getElementById('page-' + name) || document.getElementById('page-home');
      name = el.id.replace('page-', '');
      pages.forEach(function(p){ p.hidden = (p !== el); });
      document.querySelectorAll('nav.menu a').forEach(function(a){
        var on = a.dataset.nav === name;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      document.title = el.dataset.title || 'Unión Basket Barbastro';
      var target = anchor && document.getElementById(anchor);
      if (target) target.scrollIntoView(); else window.scrollTo({top: 0, behavior: 'instant'});
    }
    window.addEventListener('hashchange', route);
    route();
  }
})();
