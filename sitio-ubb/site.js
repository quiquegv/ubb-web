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

  // Ventana de plantillas
  // IMPORTANTE: datos de EJEMPLO. Sustituir por la plantilla real (dorsal + nombre).
  var ROSTERS = {
    'primer-equipo': {
      title: 'Primer equipo · Tercera FEB',
      example: true,
      players: [
        {n: '4',  name: 'Nombre Apellido'},
        {n: '5',  name: 'Nombre Apellido'},
        {n: '7',  name: 'Nombre Apellido'},
        {n: '9',  name: 'Nombre Apellido'},
        {n: '11', name: 'Nombre Apellido'}
      ]
    }
  };
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  document.addEventListener('click', function(e){
    var dlg = document.getElementById('roster');
    if (!dlg) return;
    var openBtn = e.target.closest('[data-roster]');
    if (openBtn) {
      var r = ROSTERS[openBtn.dataset.roster];
      if (!r) return;
      document.getElementById('roster-title').textContent = r.title;
      var html = '';
      if (r.example) html += '<p class="roster-note">Datos de ejemplo: la plantilla real está pendiente de publicar.</p>';
      if (r.players.length) {
        html += '<table class="roster-table"><thead><tr><th class="num">Dorsal</th><th>Jugador</th></tr></thead><tbody>';
        r.players.forEach(function(p){ html += '<tr><td class="num">' + esc(p.n) + '</td><td>' + esc(p.name) + '</td></tr>'; });
        html += '</tbody></table>';
      } else {
        html += '<p>Plantilla próximamente.</p>';
      }
      document.getElementById('roster-body').innerHTML = html;
      dlg.showModal();
      return;
    }
    if (e.target.closest('[data-roster-close]') || e.target === dlg) dlg.close();
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
