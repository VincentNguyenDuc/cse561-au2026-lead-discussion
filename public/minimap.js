// Slide minimap: a sidebar of live slide thumbnails, toggled with the button or "M"
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

  // A copy of the slide as it first appears, before any fragments. The wrappers carry the
  // "reveal" and "slides" classes so the deck's styles apply to it.
  function thumbnail(slide) {
    const copy = slide.cloneNode(true);
    copy.querySelectorAll('aside.notes').forEach(el => el.remove());
    copy.querySelectorAll('.fragment').forEach(el => el.classList.remove('visible', 'current-fragment'));
    copy.classList.remove('past', 'future');
    copy.classList.add('present');
    ['style', 'hidden', 'aria-hidden'].forEach(attr => copy.removeAttribute(attr));

    const stage = document.createElement('div');
    stage.className = 'reveal';
    stage.inert = true;
    stage.innerHTML = '<div class="slides"></div>';
    stage.firstChild.appendChild(copy);

    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.appendChild(stage);
    return thumb;
  }

  function build() {
    Reveal.getSlides().forEach((slide, i) => {
      const { h, v } = Reveal.getIndices(slide);
      const heading = slide.querySelector('h1, h2, h3');
      const title = heading ? heading.textContent : 'Slide ' + (i + 1);
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.title = title;
      button.setAttribute('aria-label', (i + 1) + ': ' + title);
      const thumb = thumbnail(slide);
      const num = document.createElement('span');
      num.className = 'thumb-num';
      num.textContent = i + 1;
      thumb.appendChild(num);
      button.appendChild(thumb);
      button.addEventListener('click', () => {
        Reveal.slide(h, v);
        button.blur();
      });
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
