// The Boatyard: spend Embers on boats, upgrades and paint. The 3D preview in the middle is
// the real game renderer (main.js puts it in "showcase" mode); this file is the panels around it.
import {
  BOATS, UPGRADES, PAINTS, MAX_UPGRADE, upgradeCost, boatStats, statBars, boatById, paintById,
} from './boats.js';

// The Boatyard lists boats from cheapest to most expensive.
const LIST = [...BOATS].sort((a, b) => a.price - b.price);

export function createShop({ yard, onSave, onPreview, onClose, onSound }) {
  const el = document.createElement('div');
  el.id = 'shop';
  el.className = 'hidden';
  document.body.appendChild(el);
  let selected = yard.equipped;
  let message = '';

  const owned = (id) => yard.boats[id];
  const fmt = (n) => `${n.toLocaleString()} ✦`;

  function render() {
    const boat = boatById(selected);
    const mine = owned(selected);
    const ups = mine || {};
    const stats = boatStats(selected, ups);
    const bars = statBars(stats);
    const equippedStats = statBars(boatStats(yard.equipped, owned(yard.equipped)));

    el.innerHTML = `
      <header>
        <b>Boatyard</b>
        <span class="embers" title="Embers: earned by clearing levels">${fmt(yard.embers)}</span>
        <button data-act="close" title="Esc">Back</button>
      </header>
      <aside class="list">
        ${LIST.map((b) => {
          const o = owned(b.id);
          const tag = yard.equipped === b.id ? 'Equipped' : o ? 'Owned' : fmt(b.price);
          return `<button data-boat="${b.id}" class="${b.id === selected ? 'sel' : ''} ${o ? 'own' : ''} ${!o && b.price > yard.embers ? 'poor' : ''}">
            <span>${b.name}</span><small>${tag}</small></button>`;
        }).join('')}
      </aside>
      <section class="detail">
        <h2>${boat.name}</h2>
        <p class="blurb">${boat.blurb}</p>
        ${boat.trait ? `<p class="trait">\u2605 ${boat.trait}</p>` : ''}
        <ul class="bars">
          ${bars.map((s, i) => {
            const diff = s.value - equippedStats[i].value;
            const mark = Math.abs(diff) < 0.01 ? '' : diff > 0 ? '<em class="up">▲</em>' : '<em class="down">▼</em>';
            return `<li><span>${s.label}</span><i><b style="width:${Math.round(s.value * 100)}%"></b></i>${mark}</li>`;
          }).join('')}
        </ul>
        <p class="numbers">Top speed ${stats.maxSpeed.toFixed(1)} · tank ${Math.round(stats.tank)} oil · oil use ×${stats.drain.toFixed(2)} · light ×${stats.lantern.toFixed(2)}</p>
        ${mine ? `
          <div class="main-act">${yard.equipped === selected ? '<span class="eq">✓ Equipped</span>' : '<button data-act="equip" class="big">Equip</button>'}</div>
          <h3>Upgrades</h3>
          <ul class="ups">
            ${UPGRADES.map((u) => {
              const lvl = mine[u.id] || 0;
              const cost = upgradeCost(boat, lvl);
              const pips = '●'.repeat(lvl) + '○'.repeat(MAX_UPGRADE - lvl);
              const btn = lvl >= MAX_UPGRADE ? '<small>Max</small>'
                : `<button data-up="${u.id}" ${cost > yard.embers ? 'class="poor"' : ''}>${fmt(cost)}</button>`;
              return `<li><span><b>${u.name}</b> <small>${u.blurb}</small></span><span class="pips">${pips}</span>${btn}</li>`;
            }).join('')}
          </ul>
          <h3>Paint</h3>
          ${['hull', 'trim'].map((part) => `
            <div class="paints"><span>${part === 'hull' ? 'Hull' : 'Trim'}</span>
              ${PAINTS.map((p) => {
                const have = yard.paints.includes(p.id);
                const on = mine[part] === p.id;
                const c = p.color.map((v) => Math.round(v * 255)).join(',');
                return `<button data-paint="${p.id}" data-part="${part}" class="sw ${on ? 'on' : ''} ${have ? '' : 'locked'} ${p.glow ? 'glow' : ''}"
                  style="--c: rgb(${c})" title="${p.name}${have ? '' : ` (${fmt(p.price)})`}">${have ? '' : '\u{1F512}'}</button>`;
              }).join('')}
            </div>`).join('')}
        ` : `<div class="main-act"><button data-act="buy" class="big ${boat.price > yard.embers ? 'poor' : ''}">Buy for ${fmt(boat.price)}</button></div>
             <p class="hint">Earn Embers by clearing levels. First clears, oil left over, new best times and full runs pay extra.</p>`}
        <p class="msg">${message}</p>
      </section>`;
    message = '';
  }

  function spend(cost, what) {
    if (yard.embers < cost) {
      message = `You need ${fmt(cost - yard.embers)} more for ${what}.`;
      onSound('noFlare');
      return false;
    }
    yard.embers -= cost;
    onSound('allBuoys');
    return true;
  }

  function act(e) {
    const t = e.target.closest('button');
    if (!t) return;
    const boat = boatById(selected);
    const mine = owned(selected);
    if (t.dataset.boat) {
      selected = t.dataset.boat;
      onSound('oil');
    } else if (t.dataset.act === 'close') {
      onClose();
      return;
    } else if (t.dataset.act === 'buy' && !mine) {
      if (spend(boat.price, boat.name)) {
        const paint = boat.paint || { hull: 'oak', trim: 'tar' };
        yard.boats[selected] = { engine: 0, tank: 0, burner: 0, lens: 0, ...paint };
        for (const id of Object.values(paint)) if (!yard.paints.includes(id)) yard.paints.push(id); // its paint comes free
        yard.equipped = selected;
        message = `${boat.name} is yours!`;
      }
    } else if (t.dataset.act === 'equip' && mine) {
      yard.equipped = selected;
      onSound('buoy');
    } else if (t.dataset.up && mine) {
      const lvl = mine[t.dataset.up] || 0;
      if (lvl < MAX_UPGRADE && spend(upgradeCost(boat, lvl), 'that upgrade')) mine[t.dataset.up] = lvl + 1;
    } else if (t.dataset.paint && mine) {
      const p = paintById(t.dataset.paint);
      if (!yard.paints.includes(p.id)) {
        if (!spend(p.price, p.name)) { render(); return; }
        yard.paints.push(p.id);
        message = `${p.name} paint unlocked for every boat.`;
      }
      mine[t.dataset.part] = p.id;
    } else {
      return;
    }
    onSave();
    onPreview(selected);
    render();
  }
  el.addEventListener('click', act);

  return {
    el,
    get selected() { return selected; },
    open() {
      selected = yard.equipped;
      el.classList.remove('hidden');
      onPreview(selected);
      render();
    },
    close() { el.classList.add('hidden'); },
    // Up/down picks a boat, Enter buys or equips, Esc leaves.
    key(code) {
      const i = LIST.findIndex((b) => b.id === selected);
      if (code === 'Escape') { onClose(); return; }
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowDown' || code === 'KeyS') {
        const step = code === 'ArrowUp' || code === 'KeyW' ? -1 : 1;
        selected = LIST[(i + step + LIST.length) % LIST.length].id;
        onSound('oil');
        onPreview(selected);
        render();
      } else if (code === 'Enter' || code === 'Space') {
        const fake = document.createElement('button');
        fake.dataset.act = owned(selected) ? 'equip' : 'buy';
        el.appendChild(fake);
        act({ target: fake });
        fake.remove();
      }
    },
  };
}
