// Network diagrams: <div class="net-slot" data-net="NAME"> is filled from <template id="net-NAME">.
// data-hl / data-fail / data-ok on the slot set the base state; the same attributes on fragments update it
// as they are shown (fail and ok accumulate across fragments, hl follows the current fragment).
// A shown fragment with data-reset drops everything before it, e.g. to switch to a "fixed" view.
(function () {
  function mount(slot) {
    const net = document.getElementById('net-' + slot.dataset.net).content.firstElementChild.cloneNode(true);
    const s = parseFloat(slot.dataset.scale || '0.72');
    const w = +net.dataset.w;
    const h = +net.dataset.h;
    net.style.width = w + 'px';
    net.style.height = h + 'px';
    net.style.transform = `scale(${s})`;
    slot.style.width = w * s + 'px';
    slot.style.height = h * s + 'px';
    slot.appendChild(net);
  }

  const tokens = (els, key) => els.flatMap(el => (el.dataset[key] || '').split(/\s+/)).filter(Boolean);

  function update() {
    const slide = Reveal.getCurrentSlide();
    if (!slide) return;
    const shown = [...slide.querySelectorAll('.fragment.visible')];
    const current = [...slide.querySelectorAll('.fragment.current-fragment')];
    const reset = shown.findLastIndex(f => 'reset' in f.dataset);
    slide.querySelectorAll('.net-slot').forEach(slot => {
      const net = slot.querySelector('.net');
      const active = reset >= 0 ? shown.slice(reset) : [slot, ...shown];
      const hl = tokens(current.length ? current : [slot], 'hl');
      const fail = tokens(active, 'fail');
      const ok = tokens(active, 'ok');
      net.querySelectorAll('[data-id]').forEach(el => {
        const ids = el.dataset.id.split(/\s+/);
        el.classList.toggle('hl', ids.some(id => hl.includes(id)));
        el.classList.toggle('fail', ids.some(id => fail.includes(id)));
        el.classList.toggle('ok', ids.some(id => ok.includes(id)));
      });
      net.classList.toggle('focus', hl.length + fail.length + ok.length > 0);
    });
  }

  function init() {
    document.querySelectorAll('.net-slot').forEach(mount);
    Reveal.layout();
    update();
    ['slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(e => Reveal.on(e, update));
  }

  Reveal.isReady() ? init() : Reveal.on('ready', init);
})();
