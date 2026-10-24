// Slide minimap: a sidebar listing every slide, toggled with the button or "M"
(function () {
  const nav = document.getElementById('minimap');
  const list = nav.querySelector('ol');
  const toggle = document.getElementById('minimap-toggle');
  const STORAGE_KEY = 'minimap-open';

  function setOpen(open) {
    document.body.classList.toggle('minimap-open', open);
    toggle.setAttribute('aria-expanded', open);
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch (e) {}
    Reveal.layout();
  }

  function build() {
    Reveal.getSlides().forEach((slide, i) => {
      const { h, v } = Reveal.getIndices(slide);
      const heading = slide.querySelector('h1, h2, h3');
      const li = document.createElement('li');
      if (v > 0) li.classList.add('sub');
      const button = document.createElement('button');
      button.innerHTML = '<span class="num"></span><span class="label"></span>';
      button.querySelector('.num').textContent = i + 1;
      button.querySelector('.label').textContent = heading ? heading.textContent : 'Slide ' + (i + 1);
      button.addEventListener('click', () => Reveal.slide(h, v));
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function highlight() {
    const current = Reveal.getCurrentSlide();
    Reveal.getSlides().forEach((slide, i) => {
      const li = list.children[i];
      li.classList.toggle('active', slide === current);
      if (slide === current) li.scrollIntoView({ block: 'nearest' });
    });
  }

  function init() {
    if (Reveal.isSpeakerNotes()) {
      nav.remove();
      toggle.remove();
      return;
    }
    build();
    highlight();
    Reveal.on('slidechanged', highlight);
    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('minimap-open')));
    Reveal.addKeyBinding({ keyCode: 77, key: 'M', description: 'Toggle slide minimap' },
      () => setOpen(!document.body.classList.contains('minimap-open')));

    let open = false;
    try { open = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) {}
    setOpen(open);
  }

  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();
