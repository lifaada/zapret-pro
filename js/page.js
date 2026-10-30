// Всё, что на странице не 3D: версия, проверка системы, живая демонстрация программы, эффекты.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- Версия и размер из version.json ----------
  fetch('version.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(v => {
    if (!v) return;
    $$('[data-ver]').forEach(el => (el.textContent = v.version));
    if (v.size) $$('[data-size]').forEach(el => (el.textContent = (v.size / 1048576).toFixed(1).replace('.', ',') + ' МБ'));
    if (v.date) {
      const d = new Date(v.date + 'T00:00:00');
      $$('[data-date]').forEach(el => (el.textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })));
    }
  }).catch(() => {});

  // ---------- Подходит ли компьютер посетителя ----------
  (async () => {
    const el = $('#sys');
    if (!el) return;
    const ua = navigator.userAgent;
    let win = /Windows NT/.test(ua), x64 = /Win64|x64|WOW64/.test(ua), mobile = /Android|iPhone|iPad|Mobile/.test(ua);
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const h = await navigator.userAgentData.getHighEntropyValues(['bitness', 'platform']);
        if (h.platform) win = h.platform === 'Windows';
        if (h.bitness) x64 = h.bitness === '64';
      }
    } catch (e) {}
    let cls = 'ok', text = 'Windows 64-бит — программа подойдёт';
    if (mobile) { cls = 'warn'; text = 'Это программа для компьютера с Windows — откройте сайт на ПК'; }
    else if (!win) { cls = 'warn'; text = 'Программа только для Windows 7–11'; }
    else if (!x64) { cls = 'bad'; text = 'Похоже, у вас 32-битная Windows — zapret на ней не работает'; }
    el.className = 'sys ' + cls;
    el.querySelector('span').textContent = text;
  })();

  // ---------- Появление блоков ----------
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // ---------- Подсветка карточек под курсором ----------
  $$('.spot').forEach(card => card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  // ---------- «Магнитные» кнопки скачивания ----------
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    $$('.magnet').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18, y = (e.clientY - r.top - r.height / 2) * 0.28;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      });
      btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
    });
  }
  // наведение на «Скачать» открывает замок в 3D-сцене
  $$('.magnet').forEach(b => b.addEventListener('pointerenter', () => window.dispatchEvent(new Event('zp-unlock'))));

  // ---------- Живая демонстрация программы ----------
  const demo = $('#demo');
  if (demo) {
    const steps = $$('.d-step', demo), rows = $$('.d-row', demo);
    const power = $('.d-power', demo), title = $('.d-title', demo), sub = $('.d-sub', demo), prog = $('.d-prog i', demo), statusTxt = $('.d-status', demo);
    const replay = $('#demo-replay');
    const btn = $('.d-btn', demo), aTitle = $('.d-atitle', demo), aSub = $('.d-asub', demo), pill = $('.d-pilltxt', demo), strat = $('.d-strat', demo);
    let timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, reduce ? 0 : ms));
    const setStep = (i, s, txt) => { const el = steps[i]; el.dataset.s = s; if (txt) el.querySelector('small').textContent = txt; };

    function reset() {
      timers.forEach(clearTimeout); timers = [];
      steps.forEach(s => { s.dataset.s = 'wait'; s.querySelector('small').textContent = ''; });
      rows.forEach(r => { r.dataset.s = 'wait'; r.querySelector('b').style.width = '0%'; r.querySelector('em').textContent = '—'; });
      power.dataset.s = 'off'; title.textContent = 'Обход выключен'; sub.textContent = 'Нажмите, чтобы настроить';
      btn.textContent = 'Запустить проверку и настройку'; btn.classList.remove('press'); aTitle.textContent = 'Автоматическая настройка'; aSub.textContent = 'Одна кнопка — и всё готово'; pill.textContent = 'Выключен'; strat.textContent = '—';
      prog.style.width = '0%'; statusTxt.textContent = 'Готов к настройке';
      demo.classList.remove('done');
    }
    function play() {
      reset();
      at(500, () => { power.dataset.s = 'press'; btn.classList.add('press'); });
      at(800, () => { power.dataset.s = 'busy'; btn.classList.remove('press'); btn.textContent = 'Остановить'; aTitle.textContent = 'Идёт настройка…'; aSub.textContent = 'Можно свернуть окно — программа всё сделает сама'; title.textContent = 'Настраивается…'; sub.textContent = 'Подождите 1–3 минуты'; pill.textContent = 'Настройка'; setStep(0, 'run'); statusTxt.textContent = 'Проверяю систему'; prog.style.width = '8%'; });
      at(1900, () => { setStep(0, 'ok', 'TCP timestamps включены, конфликтов нет'); setStep(1, 'run'); prog.style.width = '16%'; statusTxt.textContent = 'Включаю шифрование DNS'; });
      at(3000, () => { setStep(1, 'ok', 'DNS через HTTPS включён'); setStep(2, 'run'); statusTxt.textContent = 'Проверяю стратегии'; });
      const scores = rows.map(r => +r.dataset.score);
      rows.forEach((r, i) => {
        at(3300 + i * 650, () => { r.dataset.s = 'run'; statusTxt.textContent = 'Проверка ' + (i + 1) + ' из ' + rows.length + ': ' + r.querySelector('span').textContent; });
        at(3800 + i * 650, () => {
          r.dataset.s = scores[i] >= 95 ? 'best' : scores[i] >= 60 ? 'mid' : 'bad';
          r.querySelector('b').style.width = scores[i] + '%';
          r.querySelector('em').textContent = scores[i] + '%';
          prog.style.width = (20 + (i + 1) / rows.length * 60) + '%';
        });
      });
      const tEnd = 3800 + rows.length * 650;
      at(tEnd + 200, () => { setStep(2, 'ok', 'Лучшая: ' + rows[scores.indexOf(Math.max(...scores))].querySelector('span').textContent); setStep(3, 'run'); statusTxt.textContent = 'Устанавливаю службу'; prog.style.width = '90%'; });
      at(tEnd + 1300, () => { setStep(3, 'ok', 'Включается вместе с Windows'); setStep(4, 'run'); statusTxt.textContent = 'Проверяю Discord и YouTube'; });
      at(tEnd + 2300, () => {
        setStep(4, 'ok', '✔ Discord   ✔ YouTube   ✔ Видео   ✔ Голос');
        prog.style.width = '100%';
        power.dataset.s = 'on'; title.textContent = 'Обход работает'; sub.textContent = 'Служба Windows · включается вместе с ПК';
        btn.textContent = 'Проверить заново'; aTitle.textContent = 'Готово'; aSub.textContent = 'Обход включён и стоит в автозапуске'; pill.textContent = 'Работает';
        strat.textContent = 'general (' + rows[scores.indexOf(Math.max(...scores))].querySelector('span').textContent + ')';
        statusTxt.textContent = 'Готово! Больше ничего делать не нужно';
        demo.classList.add('done');
        window.dispatchEvent(new Event('zp-unlock'));
      });
    }
    let played = false;
    new IntersectionObserver(es => { if (es[0].isIntersecting && !played) { played = true; play(); } }, { threshold: 0.45 }).observe(demo);
    replay && replay.addEventListener('click', play);
    reset();
  }

  // ---------- История: подписи меняются вместе с формой частиц ----------
  const caps = $$('.cap'), hint = $('.story-hint'), steps = $$('.story-step');
  if (steps.length) {
    const update = () => {
      const mid = innerHeight / 2;
      let active = 0;
      steps.forEach(st => { const r = st.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) active = +st.dataset.step; });
      caps.forEach(c => c.classList.toggle('on', +c.dataset.cap === active));
      if (hint) hint.classList.toggle('on', active > 0);
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  // ---------- Счётчики ----------
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, dur = reduce ? 0 : 1200, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / Math.max(1, dur)), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach(el => cio.observe(el));
})();
