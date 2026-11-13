const api = window.skillsApi;

const S = {
  scan: null,
  skills: [],
  categories: [],
  agents: [],
  settings: { customDirs: [], installMode: 'copy', presets: [] },
  query: '',
  category: 'all',
  source: 'all',
  detailId: null,
  contextId: null,
  loading: false,
  entering: false,
  selectionMode: false,
  selected: new Set(),
  sort: 'recommended',
};

const $ = (sel) => document.querySelector(sel);
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 分类 → 颜色 + 自绘图标 */
const CAT_STYLE = {
  code: { color: '#3b5b8c', icon: 'code' },
  writing: { color: '#9a5b3b', icon: 'writing' },
  design: { color: '#8557a3', icon: 'design' },
  data: { color: '#2c6b66', icon: 'data' },
  office: { color: '#7a6828', icon: 'office' },
  research: { color: '#4a6b3a', icon: 'research' },
  media: { color: '#a1476a', icon: 'media' },
  automation: { color: '#55557a', icon: 'automation' },
  other: { color: '#6e685d', icon: 'other' },
};
const catStyle = (id) => CAT_STYLE[id] || CAT_STYLE.other;
const HOT_STARS = 100000;
const starsOf = (s) => Number(s?.stats?.stars) || 0;
const usageOf = (s) => Number(s?.stats?.usage) || 0;
const nameCmp = (a, b) => a.name.localeCompare(b.name, 'zh');

function fmtNum(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  try {
    return new Intl.NumberFormat('zh-CN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);
  } catch {
    return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `${(v / 1000).toFixed(1)}k`;
  }
}
const ic = (name, cls = '') =>
  `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}" /></svg>`;

function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.remove('show');
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      if (!el.classList.contains('show')) el.hidden = true;
    }, 240);
  }, 3600);
}

function friendlyError(e) {
  return String(e?.message || e || '未知错误').replace(/^Error:\s*/i, '');
}

/* ---------------- fuzzy search ---------------- */
function subsequenceScore(text, query) {
  const t = text.toLowerCase();
  const chars = query.toLowerCase().replace(/\s/g, '');
  if (!chars) return 0;
  let ti = 0;
  let gaps = 0;
  let last = -1;
  for (const ch of chars) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    if (last >= 0) gaps += found - last - 1;
    last = found;
    ti = found + 1;
  }
  const span = last + 1;
  if (span <= 0) return 0;
  const density = chars.length / span;
  return Math.max(0, (density - gaps / (span * 4)) * 40);
}

function fuzzyScore(skill, query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 1;
  const name = String(skill.name || '').toLowerCase();
  const fields = [
    [name, 100],
    [String(skill.categoryName || '').toLowerCase(), 50],
    [String(skill.summary?.what || '').toLowerCase(), 40],
    [String(skill.summary?.when || '').toLowerCase(), 25],
    [String(skill.description || '').toLowerCase(), 25],
    [
      [...(skill.sourceAgents || []), ...(skill.sourcePaths || [])].join(' ').toLowerCase(),
      15,
    ],
  ];
  let total = 0;
  for (const term of terms) {
    let best = 0;
    for (const [text, base] of fields) {
      if (!text) continue;
      if (text.includes(term)) {
        best = Math.max(best, base + (text.startsWith(term) ? 10 : 0));
      }
    }
    if (!best && term.length >= 2) {
      const sub = subsequenceScore(name, term);
      if (sub >= 24) best = sub;
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

/* ---------------- data ---------------- */
function renderSkeleton(count = 8) {
  const card = `
    <article class="card skeleton" aria-hidden="true">
      <div class="sk-head">
        <div class="sk sk-ico"></div>
        <div style="flex:1">
          <div class="sk sk-title"></div>
          <div class="sk sk-meta"></div>
        </div>
      </div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line short"></div>
      <div class="sk sk-foot"></div>
    </article>`;
  $('#grid').innerHTML = card.repeat(count);
  $('#empty').hidden = true;
  $('#resultCount').textContent = '正在扫描…';
  $('#resultHint').textContent = '';
}

function applyScan(scan) {
  S.scan = scan;
  S.skills = scan?.skills || [];
  S.categories = scan?.categories || [];
  S.agents = scan?.agents || [];
  renderAll();
}

async function refresh(force = true) {
  if (S.loading) return;
  S.loading = true;
  renderSkeleton();
  try {
    const scan = await api.scan(force);
    S.entering = true;
    applyScan(scan);
  } catch (e) {
    $('#grid').innerHTML = '';
    toast(`扫描失败：${friendlyError(e)}`, true);
  } finally {
    S.loading = false;
  }
}

function fileUnder(pathValue, root) {
  const p = String(pathValue || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const r = String(root || '').replace(/\\/g, '/').replace(/\/+$/, '');
  return p === r || p.startsWith(`${r}/`);
}

function installedTargets(skill) {
  return S.agents.filter((a) => (skill.sourcePaths || []).some((p) => fileUnder(p, a.dir)));
}

function targetInstalled(skill, target) {
  return (skill.sourcePaths || []).some((p) => fileUnder(p, target.dir));
}

function filteredSkills() {
  const q = S.query.trim();
  let list = S.skills.slice();
  if (S.category !== 'all') list = list.filter((s) => s.category === S.category);
  if (S.source !== 'all') list = list.filter((s) => (s.sourceAgents || []).includes(S.source));
  if (q) {
    list = list
      .map((s) => ({ s, score: fuzzyScore(s, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || compareBySort(a.s, b.s))
      .map((x) => x.s);
  } else {
    list.sort(compareBySort);
  }
  return list;
}

function sortLabel() {
  return (
    {
      recommended: '按星标 + 使用排序',
      name: '按名称排序',
      stars: '按 GitHub 星标排序',
      usage: '按本机调用排序',
      recent: '按最近修改排序',
    }[S.sort] || '按名称排序'
  );
}

function compareBySort(a, b) {
  if (S.sort === 'name') return nameCmp(a, b);
  if (S.sort === 'recent') return b.mtime - a.mtime || nameCmp(a, b);
  if (S.sort === 'stars') return starsOf(b) - starsOf(a) || usageOf(b) - usageOf(a) || nameCmp(a, b);
  if (S.sort === 'usage') return usageOf(b) - usageOf(a) || starsOf(b) - starsOf(a) || nameCmp(a, b);
  const score = (s) =>
    Math.log10(starsOf(s) + 1) * 2 +
    Math.log10(usageOf(s) + 1) * 1.5 +
    Math.log10((Number(s.stats?.installs) || 0) + 1) * 0.15;
  return score(b) - score(a) || nameCmp(a, b);
}

/* ---------------- render ---------------- */
function renderAll() {
  renderStats();
  renderCategories();
  renderSources();
  renderPresets();
  renderGrid();
}

function renderStats() {
  const st = S.scan?.stats || {};
  $('#brandCount').textContent = st.total ? String(st.total) : '—';
  $('#stats').innerHTML = `
    <div class="stat"><b>${st.total || 0}</b><span>个技能</span></div>
    <div class="stat"><b>${st.tools || 0}</b><span>个已检测工具</span></div>
    <div class="stat"><b>${st.categories || 0}</b><span>个分类</span></div>
    <div class="stat"><b>${st.occurrences || 0}</b><span>处安装位置</span></div>
  `;
}

function renderCategories() {
  const row = $('#categoryRow');
  if (S.category !== 'all' && !S.categories.some((c) => c.id === S.category && c.count > 0)) {
    S.category = 'all';
  }
  const total = S.skills.length;
  const all = `<button class="cat-chip ${S.category === 'all' ? 'on' : ''}" data-cat="all">全部 <span class="count">${total}</span></button>`;
  const cats = S.categories
    .filter((c) => c.count > 0)
    .map((c) => {
      const st = catStyle(c.id);
      return `<button class="cat-chip ${S.category === c.id ? 'on' : ''}" data-cat="${esc(c.id)}">
        <i class="cat-dot" style="--c:${st.color}"></i>${esc(c.name)}
        <span class="count">${c.count}</span>
      </button>`;
    })
    .join('');
  row.innerHTML = all + cats;
}

function renderSources() {
  const names = [...new Set(S.skills.flatMap((s) => s.sourceAgents || []))].sort((a, b) =>
    a.localeCompare(b, 'zh')
  );
  if (S.source !== 'all' && !names.includes(S.source)) S.source = 'all';
  const selected = S.source;
  $('#sourceSelect').innerHTML =
    `<option value="all">全部来源</option>` +
    names.map((n) => `<option value="${esc(n)}"${n === selected ? ' selected' : ''}>${esc(n)}</option>`).join('');
  $('#sourceNote').textContent = S.source === 'all' ? '' : `只看来自「${S.source}」的技能`;
}

function renderGrid() {
  const list = filteredSkills();
  const grid = $('#grid');
  const empty = $('#empty');
  grid.classList.toggle('batch', S.selectionMode);
  const visible = new Set(list.map((s) => s.id));
  for (const id of [...S.selected]) if (!visible.has(id)) S.selected.delete(id);
  updateBatchCount();
  const filtered = !!(S.query.trim() || S.category !== 'all' || S.source !== 'all');
  $('#resultCount').textContent = filtered
    ? `${list.length} / ${S.skills.length} 个技能`
    : `${list.length} 个技能`;
  $('#resultHint').textContent = filtered ? '已按相关度排序' : `${sortLabel()} · 右键卡片查看更多操作`;

  if (!list.length) {
    grid.innerHTML = '';
    const nothingAtAll =
      S.skills.length === 0 && !S.query.trim() && S.category === 'all' && S.source === 'all';
    $('#emptyTitle').textContent = nothingAtAll ? '还没有发现技能' : '没有找到匹配的技能';
    $('#emptyText').textContent = nothingAtAll
      ? '把你的技能放进任意 Agent 的 skills 目录，或添加自定义目录后刷新。'
      : '换个关键词，或点右上角「刷新」重新扫描。';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = list.map(cardHtml).join('');

  if (S.entering) {
    const cards = [...grid.children];
    cards.forEach((el, i) => {
      el.classList.add('enter');
      el.style.setProperty('--delay', `${Math.min(i, 11) * 26}ms`);
      setTimeout(() => {
        el.classList.remove('enter');
        el.style.removeProperty('--delay');
      }, 1500);
    });
    S.entering = false;
  }
}

function sourceBadges(skill) {
  const names = skill.sourceAgents || [];
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  return (
    shown.map((n) => `<span class="source-badge" title="${esc(n)}">${esc(n)}</span>`).join('') +
    (rest > 0 ? `<span class="source-badge more">+${rest}</span>` : '')
  );
}

function cardHtml(skill) {
  const targets = S.agents.filter((a) => a.installed);
  const installed = targets.filter((a) => targetInstalled(skill, a)).length;
  const remaining = targets.length ? Math.max(0, targets.length - installed) : 1;
  const addLabel = remaining === 0 ? '已安装' : '添加';
  const st = catStyle(skill.category);
  const picked = S.selected.has(skill.id);
  const stats = skill.stats || {};
  const stars = Number(stats.stars) || 0;
  const usage = Number(stats.usage) || 0;
  const hot = stars >= HOT_STARS;
  return `
    <article class="card ${picked ? 'selected' : ''} ${hot ? 'hot' : ''}" data-id="${esc(
      skill.id
    )}" tabindex="0" style="--cat:${st.color}">
      <span class="card-check" aria-hidden="true">${ic('check')}</span>
      ${hot ? `<span class="seal" title="GitHub ${stars} 星 · 热门技能">夯</span>` : ''}
      <div class="card-head">
        <div class="card-icon">${ic(st.icon)}</div>
        <div class="card-title">
          <h2 title="${esc(skill.name)}">${esc(skill.name)}</h2>
          <div class="card-meta">
            <span class="pill cat">${esc(skill.categoryName || '其他')}</span>
            ${skill.multipleVersions ? `<span class="pill warn">${ic('alert')}多版本</span>` : ''}
            ${skill.aiSummary ? `<span class="pill ai">AI 摘要</span>` : ''}
            ${
              stars > 0
                ? `<span class="pill star" title="GitHub ${stars} 星">${ic('star')}${fmtNum(stars)}</span>`
                : ''
            }
            ${
              usage > 0
                ? `<span class="pill use" title="本机调用 ${usage} 次（Claude Code 记录）">${ic(
                    'pulse'
                  )}${fmtNum(usage)} 次</span>`
                : ''
            }
          </div>
        </div>
      </div>
      <p class="card-summary">${esc(skill.summary?.what || skill.description || '暂无简介')}</p>
      <div class="card-sources">${sourceBadges(skill)}</div>
      <div class="card-actions">
        <button class="btn ghost" data-action="detail" data-id="${esc(skill.id)}">查看详情
          <span class="btn-arrow">${ic('arrow-right')}</span>
        </button>
        <button class="btn primary ${remaining === 0 ? 'installed' : ''}" data-action="add" data-id="${esc(
          skill.id
        )}" ${remaining === 0 ? 'disabled' : ''}>
          ${remaining === 0 ? ic('check') : ic('plus')}${addLabel}
        </button>
      </div>
    </article>
  `;
}

/* ---------------- presets / batch / import ---------------- */
function sortedTargets() {
  const rank = { main: 0, more: 1, library: 2, custom: 3 };
  return [...S.agents].sort(
    (a, b) =>
      (rank[a.group] ?? 9) - (rank[b.group] ?? 9) ||
      (a.detected ? 0 : 1) - (b.detected ? 0 : 1) ||
      a.label.localeCompare(b.label, 'zh')
  );
}

function targetRowsForSkills(skills, { showAll = false } = {}) {
  const targets = sortedTargets();
  const visible = (a) => {
    const n = skills.filter((s) => targetInstalled(s, a)).length;
    return (n > 0 && n < skills.length) || a.detected || a.custom || n === skills.length;
  };
  const rows = targets
    .map((a) => {
      const n = skills.filter((s) => targetInstalled(s, a)).length;
      const full = n === skills.length;
      const extra = !showAll && !visible(a);
      return `<label class="target-row ${full ? 'disabled' : ''} ${extra ? 'extra' : ''}" ${
        extra ? 'hidden' : ''
      }>
        <input type="checkbox" value="${esc(a.id)}" ${full ? 'disabled' : ''} />
        <span class="target-name">${esc(a.label)}
          <small>${esc(a.dir)}${a.detected ? '' : ' · 未检测到，仍会创建目录'}</small>
        </span>
        <span class="target-state ${full ? '' : 'miss'}">${
          full ? '已安装' : n > 0 ? `已装 ${n}/${skills.length}` : '添加'
        }</span>
      </label>`;
    })
    .join('');
  const extraCount = showAll
    ? 0
    : targets.filter((a) => {
        const n = skills.filter((s) => targetInstalled(s, a)).length;
        return !(n > 0 || a.detected || a.custom);
      }).length;
  return { rows, extraCount };
}

function bindShowAllTargets(btnId = 'showAllTargets', scope = '#modal') {
  const btn = $(`#${btnId}`);
  if (!btn) return;
  btn.onclick = () => {
    document.querySelectorAll(`${scope} .target-row.extra`).forEach((r) => (r.hidden = false));
    btn.remove();
  };
}

function renderPresets() {
  const presets = S.settings.presets || [];
  const chips = $('#presetChips');
  const byId = new Map(S.skills.map((s) => [s.id, s]));
  chips.innerHTML = presets
    .map((p) => {
      const alive = p.skillIds.filter((id) => byId.has(id)).length;
      const partial = alive < p.skillIds.length;
      return `<button class="preset-chip" data-preset="${esc(p.id)}" title="应用「${esc(
        p.name
      )}」到工具">
        ${ic('layers')}<span>${esc(p.name)}</span>
        <span class="count ${partial ? 'partial' : ''}">${alive}${partial ? `/${p.skillIds.length}` : ''}</span>
      </button>`;
    })
    .join('');
}

function updateBatchCount() {
  const n = S.selected.size;
  $('#batchCount').textContent = n;
  $('#batchAddBtn').disabled = n === 0;
}

function setSelectionMode(on) {
  S.selectionMode = on;
  document.body.classList.toggle('batching', on);
  if (!on) S.selected.clear();
  $('#batchToggle').classList.toggle('on', on);
  $('#batchToggle span').textContent = on ? '退出多选' : '多选';
  $('#grid').classList.toggle('batch', on);
  const bar = $('#batchBar');
  if (on) {
    bar.hidden = false;
    requestAnimationFrame(() => bar.classList.add('show'));
  } else {
    bar.classList.remove('show');
    setTimeout(() => {
      if (!S.selectionMode) bar.hidden = true;
    }, 240);
  }
  document.querySelectorAll('.card.selected').forEach((c) => c.classList.remove('selected'));
  updateBatchCount();
}

function toggleSelected(id) {
  if (S.selected.has(id)) S.selected.delete(id);
  else S.selected.add(id);
  document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.classList.toggle('selected', S.selected.has(id));
  updateBatchCount();
}

function openSavePresetModal() {
  const list = filteredSkills();
  if (!list.length) {
    toast('当前筛选下没有技能');
    return;
  }
  const cat = S.categories.find((c) => c.id === S.category);
  const suggested = S.query.trim() || (cat ? cat.name : '我的套装');
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>保存为套装</h3>
    <p class="modal-sub">把当前筛选出的 ${list.length} 个技能打包，之后可以一键应用到任意工具。</p>
    <div class="field">
      <label for="presetName">套装名称</label>
      <input id="presetName" type="text" maxlength="40" placeholder="例如：前端日常、写作三件套"
        value="${esc(suggested)}" />
    </div>
    <p class="field-hint">套装只记录技能列表，不复制任何文件；技能有增减时可以重新保存。</p>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn primary" id="savePresetConfirm">${ic('check')}保存套装</button>
    </div>
  `);
  $('#modalCancel').onclick = closeModal;
  const input = $('#presetName');
  input.focus();
  input.select();
  const submit = async () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      toast('给套装起个名字');
      return;
    }
    const preset = {
      id: `p${Date.now().toString(36)}`,
      name,
      skillIds: list.map((s) => s.id),
      createdAt: Date.now(),
    };
    S.settings.presets = [...(S.settings.presets || []), preset];
    await persistSettings();
    renderPresets();
    closeModal();
    toast(`已保存套装「${name}」`);
  };
  $('#savePresetConfirm').onclick = submit;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function openPresetModal(presetId) {
  const preset = (S.settings.presets || []).find((p) => p.id === presetId);
  if (!preset) return;
  const skills = preset.skillIds.map((id) => S.skills.find((s) => s.id === id)).filter(Boolean);
  if (!skills.length) {
    toast('这个套装里的技能都找不到了，可以删除它', true);
    return;
  }
  const { rows, extraCount } = targetRowsForSkills(skills);
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>应用套装「${esc(preset.name)}」</h3>
    <p class="modal-sub">包含 ${skills.length}${
      skills.length < preset.skillIds.length ? ` / ${preset.skillIds.length}` : ''
    } 个技能。勾选目标工具，已有的会跳过，不会覆盖。</p>
    <div class="preset-summary">${ic('layers')}<span>${skills
      .slice(0, 6)
      .map((s) => esc(s.name))
      .join('、')}${skills.length > 6 ? ` 等 ${skills.length} 个` : ''}</span></div>
    <div class="target-list">${rows}</div>
    ${
      extraCount > 0
        ? `<button class="btn ghost show-all-targets" id="showAllTargets">显示其余 ${extraCount} 个未检测到的工具</button>`
        : ''
    }
    <div class="radio-row">
      <label><input type="radio" name="preset-mode" value="copy" ${
        S.settings.installMode === 'copy' ? 'checked' : ''
      } /> 复制（推荐）</label>
      <label><input type="radio" name="preset-mode" value="symlink" ${
        S.settings.installMode === 'symlink' ? 'checked' : ''
      } /> 软链接</label>
    </div>
    <div class="modal-actions">
      <button class="btn danger preset-delete" id="deletePreset">${ic('trash')}删除套装</button>
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn primary" id="applyPreset">${ic('check')}应用</button>
    </div>
  `);
  bindShowAllTargets();
  $('#modalCancel').onclick = closeModal;

  let armed = false;
  let armTimer = null;
  const del = $('#deletePreset');
  del.onclick = async () => {
    if (!armed) {
      armed = true;
      del.classList.remove('danger');
      del.classList.add('primary');
      del.innerHTML = `${ic('trash')}再次点击确认删除`;
      armTimer = setTimeout(() => {
        armed = false;
        del.classList.add('danger');
        del.classList.remove('primary');
        del.innerHTML = `${ic('trash')}删除套装`;
      }, 3000);
      return;
    }
    clearTimeout(armTimer);
    S.settings.presets = (S.settings.presets || []).filter((p) => p.id !== preset.id);
    await persistSettings();
    renderPresets();
    closeModal();
    toast('已删除套装');
  };

  const applyBtn = $('#applyPreset');
  applyBtn.onclick = async () => {
    const targetIds = [...document.querySelectorAll('#modal .target-row input:checked')].map((x) => x.value);
    if (!targetIds.length) {
      toast('先勾选至少一个工具');
      return;
    }
    const mode = document.querySelector('#modal input[name="preset-mode"]:checked')?.value || 'copy';
    applyBtn.disabled = true;
    applyBtn.textContent = '应用中…';
    try {
      const res = await api.installMany({ ids: skills.map((s) => s.id), targetIds, mode, overwrite: false });
      if (!res?.ok) {
        toast(res?.error || '应用失败', true);
        return;
      }
      toast(`已应用 ${res.applied}/${res.total} 个技能`);
      closeModal();
      if (res.scan) applyScan(res.scan);
      if (S.detailId) await openDetail(S.detailId);
    } catch (e) {
      toast(`应用失败：${friendlyError(e)}`, true);
    } finally {
      applyBtn.disabled = false;
      applyBtn.innerHTML = `${ic('check')}应用`;
    }
  };
}

function openBatchAddModal() {
  const ids = [...S.selected];
  const skills = ids.map((id) => S.skills.find((s) => s.id === id)).filter(Boolean);
  if (!skills.length) {
    toast('先选择技能');
    return;
  }
  const { rows, extraCount } = targetRowsForSkills(skills);
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>添加 ${skills.length} 个技能</h3>
    <p class="modal-sub">选择要添加到的工具。已经存在的会跳过，不会覆盖原文件。</p>
    <div class="target-list">${rows}</div>
    ${
      extraCount > 0
        ? `<button class="btn ghost show-all-targets" id="showAllTargets">显示其余 ${extraCount} 个未检测到的工具</button>`
        : ''
    }
    <div class="radio-row">
      <label><input type="radio" name="batch-mode" value="copy" ${
        S.settings.installMode === 'copy' ? 'checked' : ''
      } /> 复制（推荐）</label>
      <label><input type="radio" name="batch-mode" value="symlink" ${
        S.settings.installMode === 'symlink' ? 'checked' : ''
      } /> 软链接</label>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn primary" id="batchInstall">${ic('plus')}添加</button>
    </div>
  `);
  bindShowAllTargets();
  $('#modalCancel').onclick = closeModal;
  const installBtn = $('#batchInstall');
  installBtn.onclick = async () => {
    const targetIds = [...document.querySelectorAll('#modal .target-row input:checked')].map((x) => x.value);
    if (!targetIds.length) {
      toast('先勾选至少一个工具');
      return;
    }
    const mode = document.querySelector('#modal input[name="batch-mode"]:checked')?.value || 'copy';
    installBtn.disabled = true;
    installBtn.textContent = '添加中…';
    try {
      const res = await api.installMany({ ids: skills.map((s) => s.id), targetIds, mode, overwrite: false });
      if (!res?.ok) {
        toast(res?.error || '添加失败', true);
        return;
      }
      toast(`已添加 ${res.applied}/${res.total} 个技能`);
      closeModal();
      setSelectionMode(false);
      if (res.scan) applyScan(res.scan);
    } catch (e) {
      toast(`添加失败：${friendlyError(e)}`, true);
    } finally {
      installBtn.disabled = false;
      installBtn.innerHTML = `${ic('plus')}添加`;
    }
  };
}

async function importSkillsFlow() {
  const res = await api.importSkills();
  if (res?.canceled) return;
  if (!res?.ok) {
    toast(res?.error || '没有可导入的技能', true);
    return;
  }
  if (res.scan) applyScan(res.scan);
  if (res.imported > 0) {
    toast(`已导入 ${res.imported} 个技能到中央技能库${res.error ? '，部分同名技能已跳过' : ''}`);
  } else {
    toast('这些技能已经在中央技能库里了');
  }
}

async function addProjectFlow() {
  const res = await api.addProject();
  if (res?.canceled) return;
  if (!res?.ok) {
    toast(res?.error || '关联失败', true);
    return;
  }
  if (res.settings) S.settings = res.settings;
  if (res.scan) applyScan(res.scan);
  if (res.added?.length) {
    toast(`已关联 ${res.added.length} 个技能目录：${res.labels.join('、')}`);
  } else {
    toast('这些技能目录已经关联过了');
  }
}

/* ---------------- detail ---------------- */
let drawerCloseTimer = null;

async function openDetail(id) {
  clearTimeout(drawerCloseTimer);
  const drawer = $('#detailDrawer');
  const mask = $('#drawerMask');
  drawer.classList.remove('closing');
  mask.classList.remove('closing');
  S.detailId = id;
  drawer.hidden = false;
  mask.hidden = false;
  drawer.innerHTML = '<div class="drawer-loading">加载详情…</div>';
  try {
    const d = await api.detail(id);
    if (!d) throw new Error('技能不存在');
    if (S.detailId !== id) return;
    drawer.innerHTML = detailHtml(d);
    drawer.scrollTop = 0;
    drawer.querySelector('.drawer-head')?.style.setProperty('--cat', catStyle(d.category).color);
  } catch (e) {
    drawer.innerHTML = `<div class="drawer-error">加载失败：${esc(friendlyError(e))}</div>`;
  }
}

function closeDetail() {
  const drawer = $('#detailDrawer');
  const mask = $('#drawerMask');
  if (drawer.hidden) return;
  S.detailId = null;
  drawer.classList.add('closing');
  mask.classList.add('closing');
  drawerCloseTimer = setTimeout(() => {
    drawer.hidden = true;
    mask.hidden = true;
    drawer.classList.remove('closing');
    mask.classList.remove('closing');
    drawer.innerHTML = '';
  }, 200);
}

function detailHtml(d) {
  const installed = S.agents.filter((a) => (d.sourcePaths || []).some((p) => fileUnder(p, a.dir)));
  const installedIds = new Set(installed.map((a) => a.id));
  const targets = [...S.agents].sort((a, b) => {
    const rank = { main: 0, more: 1, library: 2, custom: 3 };
    return (
      (rank[a.group] ?? 9) - (rank[b.group] ?? 9) ||
      (a.detected ? 0 : 1) - (b.detected ? 0 : 1) ||
      a.label.localeCompare(b.label, 'zh')
    );
  });
  const agentRows = targets
    .map((a) => {
      const has = installedIds.has(a.id);
      const extra = !has && !a.detected && !a.custom;
      return `<div class="agent-row ${has ? 'installed' : ''} ${extra ? 'extra' : ''}" ${
        extra ? 'hidden' : ''
      }>
        <span class="agent-mark">${ic(has ? 'check' : 'folder')}</span>
        <div class="agent-name">${esc(a.label)}
          <small>${esc(a.dir)}${a.detected ? '' : ' · 未检测到'}</small>
        </div>
        ${
          has
            ? `<button class="btn danger" data-agent-remove="${esc(a.id)}" title="只从 ${esc(
                a.label
              )} 移除">${ic('trash')}移除</button>`
            : `<button class="btn" data-agent-add="${esc(a.id)}" title="添加到 ${esc(
                a.label
              )}">${ic('plus')}添加</button>`
        }
      </div>`;
    })
    .join('');
  const extraCount = targets.filter((a) => !installedIds.has(a.id) && !a.detected && !a.custom).length;
  const files = (d.files || [])
    .map(
      (f) =>
        `<button class="file-row" data-open-file="${esc(f)}">
          <span class="file-icon">${ic('file')}</span>
          <span class="file-name">${esc(f)}</span>
          <span class="file-go">${ic('arrow-right')}</span>
        </button>`
    )
    .join('');
  const paths = (d.sourcePaths || [])
    .map(
      (p) =>
        `<div class="path-row"><code title="${esc(p)}">${esc(p)}</code>
          <button data-copy="${esc(p)}" title="复制路径">${ic('copy')}复制</button>
          <button data-reveal="${esc(p)}" title="在文件夹中显示">${ic('folder')}显示</button>
        </div>`
    )
    .join('');
  return `
    <div class="drawer-head">
      <button class="drawer-close" id="drawerClose" title="关闭">${ic('close')}</button>
      <div class="drawer-icon">${ic(catStyle(d.category).icon)}</div>
      <div class="drawer-title">
        <h2>${esc(d.name)}</h2>
        <p>${esc(d.categoryName || '')} · 已安装于 ${installed.length} 个工具${
          d.multipleVersions ? ' · 存在多个版本' : ''
        }</p>
        ${(() => {
          const stats = d.stats || {};
          const stars = Number(stats.stars) || 0;
          const usage = Number(stats.usage) || 0;
          if (!stats.repo && !stars && !usage) return '';
          return `<div class="detail-stats">
            ${
              stats.repo
                ? `<button class="detail-repo" data-open-url="https://github.com/${esc(
                    stats.repo
                  )}" title="在 GitHub 打开">${ic('external')}${esc(stats.repo)}</button>`
                : ''
            }
            ${stars > 0 ? `<span class="pill star">${ic('star')}${fmtNum(stars)} 星</span>` : ''}
            ${
              usage > 0
                ? `<span class="pill use">${ic('pulse')}本机用过 ${fmtNum(usage)} 次</span>`
                : ''
            }
          </div>
          <p class="detail-note">星标来自 GitHub；调用次数统计自 Claude Code / OpenCode 的会话记录，只保存在本机。</p>`;
        })()}
      </div>
    </div>

    <section class="detail-section">
      <h4>一句话说明</h4>
      <div class="detail-summary">${esc(d.summary?.what || d.description || '暂无简介')}</div>
      ${
        d.multipleVersions
          ? `<div class="version-warn">${ic('alert')}<span>检测到多个内容不一致的副本，这里展示最近修改的一份。添加时可勾选「覆盖」统一起见。</span></div>`
          : ''
      }
    </section>

    <section class="detail-section">
      <h4>使用要点</h4>
      <div class="detail-grid">
        <div class="detail-box"><b>什么时候用</b><p>${esc(d.summary?.when || '需要这类能力时')}</p></div>
        <div class="detail-box"><b>优势</b><p>${esc(d.summary?.pros || '提供可复用的步骤和脚本')}</p></div>
        <div class="detail-box full"><b>注意</b><p>${esc(
          d.summary?.cons || '具体效果取决于技能内容和模型，使用前先看 SKILL.md'
        )}</p></div>
      </div>
    </section>

    <section class="detail-section">
      <h4>安装到工具</h4>
      <div class="agent-list">${agentRows}</div>
      ${
        extraCount > 0
          ? `<button class="btn ghost show-all-agents" id="showAllAgents">显示其余 ${extraCount} 个未检测到的工具</button>`
          : ''
      }
    </section>

    <section class="detail-section">
      <h4>技能来源（${(d.sourcePaths || []).length}）</h4>
      <div class="path-list">${paths}</div>
    </section>

    <section class="detail-section">
      <h4>文件（${(d.files || []).length}）</h4>
      <div class="file-list">${files || '<div class="settings-hint">没有额外文件</div>'}</div>
    </section>

    <section class="detail-section">
      <h4>原始 SKILL.md</h4>
      <pre class="md-view">${esc(d.raw || '')}</pre>
    </section>

    <div class="detail-actions">
      <button class="btn" data-action="detail-add" data-id="${esc(d.id)}">${ic('plus')}添加到其他工具…</button>
      <button class="btn" data-reveal="${esc(d.path)}">${ic('folder')}在文件夹中显示</button>
    </div>
  `;
}

/* ---------------- modal shell ---------------- */
let modalCloseTimer = null;

function showModal(html) {
  clearTimeout(modalCloseTimer);
  const mask = $('#modalMask');
  const modal = $('#modal');
  mask.classList.remove('closing');
  modal.classList.remove('closing');
  modal.innerHTML = html;
  mask.hidden = false;
}

function closeModal() {
  const mask = $('#modalMask');
  const modal = $('#modal');
  if (mask.hidden || mask.classList.contains('closing')) return;
  mask.classList.add('closing');
  modal.classList.add('closing');
  modalCloseTimer = setTimeout(() => {
    mask.hidden = true;
    mask.classList.remove('closing');
    modal.classList.remove('closing');
    modal.innerHTML = '';
  }, 180);
}

/* ---------------- add modal ---------------- */
function openAddModal(id) {
  const skill = S.skills.find((s) => s.id === id);
  if (!skill) return;
  const targets = [...S.agents].sort((a, b) => {
    const rank = { main: 0, more: 1, library: 2, custom: 3 };
    return (
      (rank[a.group] ?? 9) - (rank[b.group] ?? 9) ||
      (a.detected ? 0 : 1) - (b.detected ? 0 : 1) ||
      a.label.localeCompare(b.label, 'zh')
    );
  });
  const visibleRow = (a) => targetInstalled(skill, a) || a.detected || a.custom;
  const showAll = targets.every((a) => !visibleRow(a));
  const rows = targets
    .map((a) => {
      const installed = targetInstalled(skill, a);
      const extra = !showAll && !visibleRow(a);
      return `<label class="target-row ${installed ? 'disabled' : ''} ${extra ? 'extra' : ''}" ${
        extra ? 'hidden' : ''
      }>
        <input type="checkbox" value="${esc(a.id)}" ${installed ? 'disabled' : ''} />
        <span class="target-name">${esc(a.label)}
          <small>${esc(a.dir)}${a.detected ? '' : ' · 未检测到，仍会创建目录'}</small>
        </span>
        <span class="target-state ${installed ? '' : 'miss'}">${installed ? '已安装' : '添加'}</span>
      </label>`;
    })
    .join('');
  const extraCount = showAll ? 0 : targets.filter((a) => !visibleRow(a)).length;
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>添加「${esc(skill.name)}」</h3>
    <p class="modal-sub">勾选要添加到的工具。默认复制一份；也可以创建软链接（同一份技能同步更新）。</p>
    <div class="target-list">${rows}</div>
    ${
      extraCount > 0
        ? `<button class="btn ghost show-all-targets" id="showAllTargets">显示其余 ${extraCount} 个未检测到的工具</button>`
        : ''
    }
    <div class="radio-row">
      <label><input type="radio" name="mode" value="copy" ${
        S.settings.installMode === 'copy' ? 'checked' : ''
      } /> 复制（推荐）</label>
      <label><input type="radio" name="mode" value="symlink" ${
        S.settings.installMode === 'symlink' ? 'checked' : ''
      } /> 软链接</label>
    </div>
    <label class="check-row"><input type="checkbox" id="overwrite" /> 覆盖已存在的同名技能</label>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn primary" id="modalInstall">${ic('plus')}添加</button>
    </div>
  `);
  $('#modalCancel').onclick = closeModal;
  const showAllBtn = $('#showAllTargets');
  if (showAllBtn) {
    showAllBtn.onclick = () => {
      document.querySelectorAll('#modal .target-row.extra').forEach((r) => (r.hidden = false));
      showAllBtn.remove();
    };
  }
  $('#modalInstall').onclick = async () => {
    const targetIds = [...document.querySelectorAll('#modal .target-row input:checked')].map((x) => x.value);
    if (!targetIds.length) {
      toast('先勾选至少一个工具');
      return;
    }
    const mode = document.querySelector('#modal input[name="mode"]:checked')?.value || 'copy';
    const overwrite = $('#overwrite').checked;
    const btn = $('#modalInstall');
    btn.disabled = true;
    btn.textContent = '添加中…';
    try {
      const res = await api.install({ id, targetIds, mode, overwrite });
      if (!res?.ok) {
        toast(res?.error || '添加失败', true);
        return;
      }
      const ok = (res.results || []).filter((r) => r.ok).length;
      const fail = (res.results || []).filter((r) => !r.ok);
      toast(`已添加 ${ok} 个工具${fail.length ? `，${fail.length} 个失败` : ''}`, fail.length > 0);
      closeModal();
      S.settings = await api.getSettings();
      await refresh(false);
      if (S.detailId) await openDetail(S.detailId);
    } catch (e) {
      toast(`添加失败：${friendlyError(e)}`, true);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${ic('plus')}添加`;
    }
  };
}

/* ---------------- remove modal ---------------- */
function openRemoveModal(id) {
  const skill = S.skills.find((s) => s.id === id);
  if (!skill) return;
  const installed = S.agents.filter((a) => targetInstalled(skill, a));
  if (!installed.length) {
    toast('这个技能还没有安装到任何工具');
    return;
  }
  const single = installed.length === 1;
  const rows = installed
    .map(
      (a) => `<label class="target-row">
        <input type="radio" name="remove-target" value="${esc(a.id)}" ${single ? 'checked' : ''} />
        <span class="target-name">${esc(a.label)}<small>${esc(a.dir)}</small></span>
      </label>`
    )
    .join('');
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>移除「${esc(skill.name)}」</h3>
    <p class="modal-sub">${
      single ? '只从下面这个工具里移除；不会影响其他工具。删除会移到废纸篓。' : '请选择要移除的工具；只会删除这个工具里的副本，其他工具不受影响。'
    }</p>
    <div class="target-list">${rows}</div>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn danger" id="modalRemove" ${single ? '' : 'disabled'}>${ic('trash')}移除</button>
    </div>
  `);
  $('#modalCancel').onclick = closeModal;
  const removeBtn = $('#modalRemove');
  document.querySelectorAll('#modal input[name="remove-target"]').forEach((r) => {
    r.addEventListener('change', () => {
      removeBtn.disabled = false;
    });
  });
  $('#modalRemove').onclick = async () => {
    const targetId = document.querySelector('#modal input[name="remove-target"]:checked')?.value;
    if (!targetId) return;
    try {
      const res = await api.remove({ id, targetId });
      toast(res?.ok ? '已移除' : res?.error || '移除失败', !res?.ok);
      closeModal();
      await refresh(false);
      if (S.detailId) await openDetail(S.detailId);
    } catch (e) {
      toast(`移除失败：${friendlyError(e)}`, true);
    }
  };
}

/* ---------------- settings ---------------- */
async function openSettings() {
  S.settings = await api.getSettings();
  const dirs = (S.settings.customDirs || [])
    .map(
      (d) =>
        `<div class="dir-row"><code title="${esc(d)}">${esc(d)}</code><button data-dir-remove="${esc(
          d
        )}">移除</button></div>`
    )
    .join('');
  const agents = [...S.agents]
    .sort((a, b) => {
      const rank = { main: 0, more: 1, library: 2, custom: 3 };
      return (
        (rank[a.group] ?? 9) - (rank[b.group] ?? 9) ||
        (a.detected ? 0 : 1) - (b.detected ? 0 : 1) ||
        a.label.localeCompare(b.label, 'zh')
      );
    })
    .map(
      (a) =>
        `<div class="dir-row">
          <code>${esc(a.label)} · ${esc(a.dir)}</code>
          <span class="tool-state ${a.detected ? 'on' : ''}"><i class="dot"></i>${a.detected ? '已检测' : '未检测'}</span>
        </div>`
    )
    .join('');
  const ai = S.settings.ai || {};
  const aiPresets = ai.presets || {};
  const providerOptions = Object.entries(aiPresets)
    .map(
      ([id, preset]) =>
        `<option value="${esc(id)}" ${ai.provider === id ? 'selected' : ''}>${esc(preset.label)}</option>`
    )
    .join('');
  const aiStatusText = ai.hasKey
    ? `已保存 Key · ${esc(aiPresets[ai.provider]?.label || ai.provider)} · ${esc(ai.model || '')}`
    : '未配置。配置后可对市场长尾技能和本机技能做语义级总结。';
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>设置</h3>
    <p class="modal-sub">技能目录、安装方式、AI 摘要和本机工具检测。</p>
    <div class="settings-section">
      <h4>自定义技能目录</h4>
      <p class="settings-hint">除了内置工具目录，还可以扫描任意文件夹（例如项目里的 .claude/skills）。</p>
      <div class="dir-list" id="customDirList">${dirs || '<div class="settings-hint">还没有自定义目录</div>'}</div>
      <div class="settings-actions">
        <button class="btn" id="addDirBtn">${ic('plus')}添加目录</button>
        <button class="btn" id="addProjectBtn">${ic('folder-plus')}关联项目…</button>
      </div>
    </div>
    <div class="settings-section">
      <h4>默认安装方式</h4>
      <div class="radio-row">
        <label><input type="radio" name="settings-mode" value="copy" ${
          S.settings.installMode === 'copy' ? 'checked' : ''
        } /> 复制</label>
        <label><input type="radio" name="settings-mode" value="symlink" ${
          S.settings.installMode === 'symlink' ? 'checked' : ''
        } /> 软链接</label>
      </div>
      <p class="settings-hint">Windows 上软链接会自动尝试 junction，失败则回退为复制。</p>
    </div>
    <div class="settings-section">
      <h4>AI 语义摘要（可选）</h4>
      <p class="settings-hint">用你自己的大模型把技能描述总结成「功能 + 独特优势」。API Key 只保存在本机钥匙串，不会上传到我们的服务器；技能描述会发送给你选择的模型服务商。</p>
      <div class="field-row">
        <div class="field">
          <label for="aiProvider">服务商</label>
          <select id="aiProvider">${providerOptions}</select>
        </div>
        <div class="field">
          <label for="aiModel">模型</label>
          <input id="aiModel" type="text" value="${esc(ai.model || '')}" placeholder="模型名" />
        </div>
      </div>
      <div class="field">
        <label for="aiBaseUrl">接口地址</label>
        <input id="aiBaseUrl" type="text" value="${esc(ai.baseUrl || '')}" placeholder="https://api.example.com/v1" />
      </div>
      <div class="field">
        <label for="aiKey">API Key</label>
        <input id="aiKey" type="password" autocomplete="off" placeholder="${
          ai.hasKey ? '已保存，重新输入可替换' : '粘贴 API Key'
        }" />
      </div>
      <label class="check-row"><input type="checkbox" id="aiEnabled" ${
        ai.enabled ? 'checked' : ''
      } /> 启用 AI 摘要（市场长尾自动使用；批量结果优先显示）</label>
      <p class="settings-hint">提示词已内置：只输出 JSON，包含「功能」与「适用场景」；不会把 API Key 写进导出配置。</p>
      <div class="settings-actions">
        <button class="btn" id="aiTestBtn">测试连接</button>
        <button class="btn primary" id="aiSaveBtn">保存</button>
        <button class="btn" id="aiBatchBtn">用 AI 重写全部本机技能</button>
      </div>
      <p class="settings-hint" id="aiStatus">${aiStatusText}</p>
      <div class="ai-progress" id="aiProgress" hidden>
        <div class="ai-progress-bar"><i id="aiProgressBar"></i></div>
        <span id="aiProgressText"></span>
      </div>
      <p class="settings-hint">自定义服务请填 OpenAI 兼容的 /v1 地址；MiniMax、MiMo 等地址如发生变化可直接修改。批量总结会调用模型并可能产生费用。</p>
    </div>
    <div class="settings-section">
      <h4>备份与恢复</h4>
      <p class="settings-hint">导出目录、套装和安装方式；不包含技能文件。换电脑时先导入配置，再按需安装技能。</p>
      <div class="settings-actions">
        <button class="btn" id="exportCfgBtn">${ic('external')}导出配置</button>
        <button class="btn" id="importCfgBtn">${ic('import')}导入配置</button>
      </div>
    </div>
    <div class="settings-section">
      <h4>本机工具</h4>
      <div class="dir-list tools-list">${agents}</div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">关闭</button>
      <button class="btn primary" id="saveSettings">保存并重新扫描</button>
    </div>
  `);
  $('#modalCancel').onclick = closeModal;
  $('#addDirBtn').onclick = async () => {
    const dir = await api.chooseDir();
    if (!dir) return;
    if (!S.settings.customDirs.includes(dir)) S.settings.customDirs.push(dir);
    await persistSettings();
    await refresh(true);
    await openSettings();
  };
  $('#addProjectBtn').onclick = async () => {
    await addProjectFlow();
    await openSettings();
  };
  $('#exportCfgBtn').onclick = async () => {
    const res = await api.exportSettings();
    if (res?.ok) toast('配置已导出');
    else if (!res?.canceled) toast(res?.error || '导出失败', true);
  };
  $('#importCfgBtn').onclick = async () => {
    const res = await api.importSettings();
    if (res?.canceled) return;
    if (!res?.ok) {
      toast(res?.error || '导入失败', true);
      return;
    }
    S.settings = res.settings;
    if (res.scan) applyScan(res.scan);
    closeModal();
    toast('配置已导入');
  };
  $('#modal').querySelectorAll('[data-dir-remove]').forEach((btn) => {
    btn.onclick = async () => {
      S.settings.customDirs = S.settings.customDirs.filter((x) => x !== btn.dataset.dirRemove);
      await persistSettings();
      await refresh(true);
      await openSettings();
    };
  });
  const aiValues = () => ({
    provider: $('#aiProvider').value,
    baseUrl: $('#aiBaseUrl').value.trim(),
    model: $('#aiModel').value.trim(),
    enabled: $('#aiEnabled').checked,
  });
  $('#aiProvider').onchange = (e) => {
    const preset = aiPresets[e.target.value];
    if (!preset) return;
    if (e.target.value !== 'custom') {
      $('#aiBaseUrl').value = preset.baseUrl;
      $('#aiModel').value = preset.model;
    }
  };
  $('#aiTestBtn').onclick = async () => {
    const btn = $('#aiTestBtn');
    btn.disabled = true;
    btn.textContent = '测试中…';
    try {
      const res = await api.aiTest({ ...aiValues(), apiKey: $('#aiKey').value });
      $('#aiStatus').textContent = res?.ok
        ? `连接成功 · ${res.latency} ms · ${res.reply || ''}`
        : `连接失败：${res?.error || '未知错误'}`;
      toast(res?.ok ? '连接成功' : res?.error || '连接失败', !res?.ok);
    } catch (e) {
      $('#aiStatus').textContent = `连接失败：${friendlyError(e)}`;
      toast(`连接失败：${friendlyError(e)}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '测试连接';
    }
  };
  $('#aiSaveBtn').onclick = async () => {
    const btn = $('#aiSaveBtn');
    btn.disabled = true;
    try {
      const res = await api.aiSave({ ...aiValues(), apiKey: $('#aiKey').value });
      if (!res?.ok) {
        toast(res?.error || '保存失败', true);
        return;
      }
      S.settings.ai = res.ai;
      $('#aiKey').value = '';
      $('#aiKey').placeholder = '已保存，重新输入可替换';
      $('#aiStatus').textContent = `已保存 · ${res.ai.presets?.[res.ai.provider]?.label || res.ai.provider} · ${res.ai.model}`;
      toast('AI 配置已保存');
    } catch (e) {
      toast(`保存失败：${friendlyError(e)}`, true);
    } finally {
      btn.disabled = false;
    }
  };
  let aiBatchArmed = false;
  let aiBatchTimer = null;
  $('#aiBatchBtn').onclick = async () => {
    if (!S.settings.ai?.hasKey) {
      toast('先保存 API Key', true);
      return;
    }
    if (!aiBatchArmed) {
      aiBatchArmed = true;
      $('#aiBatchBtn').textContent = `确认调用 ${S.skills.length} 次模型？再点一次`;
      aiBatchTimer = setTimeout(() => {
        aiBatchArmed = false;
        $('#aiBatchBtn').textContent = '用 AI 重写全部本机技能';
      }, 4000);
      return;
    }
    clearTimeout(aiBatchTimer);
    aiBatchArmed = false;
    const btn = $('#aiBatchBtn');
    btn.disabled = true;
    $('#aiProgress').hidden = false;
    $('#aiProgressBar').style.width = '0%';
    $('#aiProgressText').textContent = '准备中…';
    try {
      const res = await api.aiSummarizeLocal({ force: true });
      if (!res?.ok && res?.error) {
        toast(res.error, true);
        return;
      }
      const scan = await api.scan(false);
      applyScan(scan);
      $('#aiStatus').textContent = `完成 ${res.done}/${res.total}${
        res.errors?.length ? `，${res.errors.length} 个失败` : ''
      }`;
      toast(`AI 摘要完成 ${res.done}/${res.total}`);
      if (!$('#aiEnabled').checked) toast('记得勾选「启用 AI 摘要」并保存');
    } catch (e) {
      toast(`AI 总结失败：${friendlyError(e)}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '用 AI 重写全部本机技能';
    }
  };
  $('#saveSettings').onclick = async () => {
    const mode = document.querySelector('#modal input[name="settings-mode"]:checked')?.value || 'copy';
    S.settings.installMode = mode;
    await persistSettings();
    closeModal();
    await refresh(true);
    toast('设置已保存');
  };
}

async function persistSettings() {
  S.settings = await api.saveSettings(S.settings);
}

/* ---------------- context menu ---------------- */
function openContextMenu(id, x, y) {
  const skill = S.skills.find((s) => s.id === id);
  if (!skill) return;
  S.contextId = id;
  const menu = $('#contextMenu');
  menu.innerHTML = `
    <button data-ctx="detail">${ic('sparkle')}查看详细介绍</button>
    <button data-ctx="add">${ic('plus')}添加到其他工具…</button>
    <button data-ctx="reveal">${ic('folder')}在文件夹中显示</button>
    <button data-ctx="copy">${ic('copy')}复制技能路径</button>
    <div class="sep"></div>
    <button data-ctx="remove" class="danger">${ic('trash')}从某个工具移除…</button>
  `;
  menu.hidden = false;
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - h - 8))}px`;
  menu.onclick = (e) => {
    const action = e.target.closest('[data-ctx]')?.dataset.ctx;
    if (!action) return;
    menu.hidden = true;
    if (action === 'detail') openDetail(id);
    if (action === 'add') openAddModal(id);
    if (action === 'reveal') api.openFolder(skill.path);
    if (action === 'copy') {
      api.copy(skill.path);
      toast('路径已复制');
    }
    if (action === 'remove') openRemoveModal(id);
  };
}

function hideContextMenu() {
  $('#contextMenu').hidden = true;
}

/* ---------------- market ---------------- */
const M = {
  opened: false,
  board: 'all',
  query: '',
  items: [],
  boardItems: [],
  stars: {},
  desc: {},
  descTried: new Set(),
  category: 'all',
  sort: 'installs',
  aiIds: new Set(),
  aiPicks: null,
  aiNeed: '',
  aiNote: '',
  seq: 0,
};
const CAT_NAMES = {
  code: '编程开发',
  writing: '写作内容',
  design: '设计创意',
  data: '数据金融',
  office: '办公效率',
  research: '研究学习',
  media: '视频音频',
  automation: '自动化',
  other: '生活其他',
};
const MARKET_COLORS = [
  '#3b5b8c',
  '#9a5b3b',
  '#8557a3',
  '#2c6b66',
  '#7a6828',
  '#4a6b3a',
  '#a1476a',
  '#55557a',
  '#6e685d',
];

function marketColor(key) {
  let h = 0;
  for (const ch of String(key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MARKET_COLORS[h % MARKET_COLORS.length];
}

function marketSkeleton(count = 8) {
  const card = `<article class="m-card" aria-hidden="true">
    <div class="m-head">
      <div class="sk" style="width:38px;height:38px;border-radius:10px;flex:none"></div>
      <div style="flex:1">
        <div class="sk sk-title" style="width:62%"></div>
        <div class="sk sk-meta" style="width:82%"></div>
      </div>
    </div>
    <div class="sk sk-line" style="width:48%"></div>
    <div class="m-actions" style="border-top-color:transparent;padding-top:0">
      <div class="sk" style="height:26px;width:66px;border-radius:7px"></div>
      <div class="sk" style="height:26px;width:66px;border-radius:7px"></div>
    </div>
  </article>`;
  return card.repeat(count);
}

const GLOSS_WORDS = {
  kubernetes: 'Kubernetes', k8s: 'Kubernetes', prisma: 'Prisma', api: 'API', cli: '命令行',
  setup: '配置', patterns: '模式', pentesting: '渗透测试', specialist: '专家',
  postgres: 'PostgreSQL', postgresql: 'PostgreSQL', mongodb: 'MongoDB', mongo: 'MongoDB',
  upgrade: '升级', migration: '迁移', client: '客户端', database: '数据库', db: '数据库',
  image: '图片', video: '视频', audio: '音频', pdf: 'PDF', docx: 'Word', xlsx: 'Excel', pptx: 'PPT',
  react: 'React', next: 'Next.js', vue: 'Vue', node: 'Node', python: 'Python', rust: 'Rust',
  design: '设计', ui: 'UI', ux: 'UX', test: '测试', testing: '测试', tdd: 'TDD', debug: '调试',
  deploy: '部署', deployment: '部署', docker: 'Docker', aws: 'AWS', azure: 'Azure', gcp: 'GCP',
  agent: 'Agent', agents: 'Agent', skill: '技能', skills: '技能', search: '搜索', find: '查找',
  generate: '生成', generation: '生成', edit: '编辑', editor: '编辑器', review: '审查',
};

function glossName(name) {
  const parts = String(name || '').split(/[-_]+/).filter(Boolean);
  let mapped = 0;
  const words = parts.map((part) => {
    const hit = GLOSS_WORDS[part.toLowerCase()];
    if (hit) {
      mapped += 1;
      return hit;
    }
    return part;
  });
  return { text: words.join(' '), mapped };
}

function marketDescText(item) {
  if (M.desc[item.id]?.what) return M.desc[item.id].what;
  if (item.what) return item.what;
  if (M.descTried.has(item.id)) {
    const gloss = glossName(item.name || item.skillId);
    if (gloss.mapped) return `${gloss.text} 相关技能`;
    return `${item.source} 的技能，安装后可在详情中查看完整说明。`;
  }
  return '正在概括中文简介…';
}

function marketWhenText(item) {
  if (M.desc[item.id]?.when) return M.desc[item.id].when;
  return item.when || '';
}

function updateMarketDesc(id) {
  const item = M.items.find((x) => x.id === id) || (M.aiPicks || []).find((x) => x.id === id);
  if (!item) return;
  const descEl = document.querySelector(`[data-desc="${CSS.escape(id)}"]`);
  if (descEl) {
    descEl.textContent = marketDescText(item);
    descEl.classList.toggle('pending', !(M.desc[id]?.what || item.what));
  }
  const whenEl = document.querySelector(`[data-when="${CSS.escape(id)}"]`);
  if (whenEl) {
    const when = marketWhenText(item);
    whenEl.hidden = !when;
    whenEl.textContent = when ? `适合 ${when}` : '';
  }
}

function marketCardHtml(item) {
  const stars = M.stars[item.source] ?? item.stars;
  const hot = Number(stars) >= HOT_STARS;
  const initial =
    (String(item.name || 'S').match(/[A-Za-z0-9\u4e00-\u9fff]/) || ['S'])[0].toUpperCase();
  return `<article class="m-card ${hot ? 'hot' : ''}" data-market-id="${esc(item.id)}">
    ${hot ? `<span class="seal" title="GitHub ${stars} 星 · 热门">夯</span>` : ''}
    <div class="m-head">
      <div class="m-icon" style="--c:${marketColor(item.source)}">${esc(initial)}</div>
      <div class="m-title">
        <h3 title="${esc(item.name)}">${esc(item.name)}</h3>
        <p title="${esc(item.source)}">${esc(item.source)}${
          item.ai || M.aiIds.has(item.id) ? '<span class="ai-tag">AI</span>' : ''
        }</p>
      </div>
    </div>
    <p class="m-desc ${M.desc[item.id]?.what || item.what ? '' : 'pending'}" data-desc="${esc(
      item.id
    )}">${esc(marketDescText(item))}</p>
    <p class="m-when" data-when="${esc(item.id)}" ${marketWhenText(item) ? '' : 'hidden'}>${
      marketWhenText(item) ? `适合 ${esc(marketWhenText(item))}` : ''
    }</p>
    ${
      item.reason
        ? `<p class="m-reason">${ic('sparkle')}<span>${esc(item.reason)}</span></p>`
        : ''
    }
    <div class="m-metrics">
      <span title="skills.sh 安装量">${ic('import')}${fmtNum(item.installs)}</span>
      <span class="star" title="GitHub 星标">${ic('star')}${
        stars == null ? '—' : fmtNum(stars)
      }</span>
    </div>
    <div class="m-actions">
      <button class="btn ghost" data-github="${esc(item.source)}">${ic('external')}GitHub</button>
      <button class="btn primary" data-get="${esc(item.id)}" ${
        item.installed ? 'disabled' : ''
      }>${item.installed ? `${ic('check')}已收录` : `${ic('import')}获取`}</button>
    </div>
  </article>`;
}

function marketVisible() {
  let list = M.items.slice();
  if (M.category !== 'all') list = list.filter((item) => item.category === M.category);
  if (M.sort === 'relevance') {
    // Keep the server's relevance order.
  } else if (M.sort === 'stars') {
    list.sort(
      (a, b) =>
        (Number(b.stars) || 0) - (Number(a.stars) || 0) || (b.installs || 0) - (a.installs || 0)
    );
  } else if (M.sort === 'name') {
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'));
  } else {
    list.sort((a, b) => (b.installs || 0) - (a.installs || 0));
  }
  return list;
}

function renderMarketCats() {
  const row = $('#marketCats');
  const counts = {};
  for (const item of M.items) counts[item.category] = (counts[item.category] || 0) + 1;
  const cats = [
    { id: 'all', name: '全部', count: M.items.length },
    ...Object.keys(CAT_NAMES)
      .filter((id) => counts[id] > 0 || M.category === id)
      .map((id) => ({ id, name: CAT_NAMES[id], count: counts[id] || 0 })),
  ];
  row.innerHTML = cats
    .map((cat) => {
      const st = CAT_STYLE[cat.id] || CAT_STYLE.other;
      return `<button class="cat-chip ${M.category === cat.id ? 'on' : ''}" data-mcat="${cat.id}">
        ${cat.id === 'all' ? '' : `<i class="cat-dot" style="--c:${st.color}"></i>`}${cat.name}
        <span class="count">${cat.count}</span>
      </button>`;
    })
    .join('');
}

function resetMarketAi() {
  M.aiPicks = null;
  M.aiNeed = '';
  M.aiNote = '';
  renderMarket();
}

function renderMarket() {
  const grid = $('#marketGrid');
  const tools = document.querySelector('.market-tools');
  if (M.aiPicks) {
    const picks = M.aiPicks;
    if (tools) tools.hidden = true;
    $('#marketStatus').textContent = `AI 推荐 · ${picks.length} 个技能`;
    const banner = `<div class="market-ai-banner">
      <span class="market-ai-banner-icon">${ic('sparkle')}</span>
      <div class="market-ai-banner-text">
        <b>为「${esc(M.aiNeed)}」推荐 ${picks.length} 个技能</b>
        ${M.aiNote ? `<p>${esc(M.aiNote)}</p>` : ''}
      </div>
      <button class="btn ghost mini" id="marketAiReset">查看全部</button>
    </div>`;
    grid.innerHTML = picks.length
      ? banner + picks.map((item) => marketCardHtml(item)).join('')
      : `${banner}<div class="market-loading">没有找到特别合适的技能，换个说法试试。</div>`;
    return;
  }
  if (tools) tools.hidden = false;
  const q = M.query.trim();
  const boardName =
    M.board === 'trending' ? '趋势榜' : M.board === 'hot' ? '飙升榜' : '热门榜';
  const list = marketVisible();
  const catName = M.category === 'all' ? '' : ` · ${CAT_NAMES[M.category] || ''}`;
  $('#marketStatus').textContent = q
    ? `搜索「${q}」${catName} · ${list.length} 个结果`
    : `${boardName}${catName} · 数据来自 skills.sh`;
  renderMarketCats();
  if (!list.length) {
    grid.innerHTML = `<div class="market-loading">这个条件下没有技能，换个关键词或分类试试。</div>`;
    return;
  }
  grid.innerHTML = list.map(marketCardHtml).join('');
}

async function loadMarket({ board = M.board, q = M.query } = {}) {
  const seq = ++M.seq;
  M.board = board;
  M.query = q;
  const query = q.trim();
  if (query.length === 1) {
    $('#marketStatus').textContent = '再输入一个字就可以搜索了';
    return;
  }
  $('#marketGrid').innerHTML = marketSkeleton();
  $('#marketStatus').textContent = query ? '正在搜索市场…' : '正在加载市场…';
  try {
    const res = await api.marketList({ board, q: query });
    if (seq !== M.seq) return;
    M.items = res.items || [];
    if (!query) M.boardItems = M.items.slice();
    M.sort = query ? 'relevance' : M.sort === 'relevance' ? 'installs' : M.sort;
    $('#marketSort').value = M.sort;
    renderMarket();
    loadMarketStars();
    loadMarketDescriptions(seq);
  } catch (e) {
    if (seq !== M.seq) return;
    if (query && M.boardItems.length) {
      const q = query.toLowerCase();
      M.items = M.boardItems.filter((item) =>
        `${item.name} ${item.source} ${item.what || ''}`.toLowerCase().includes(q)
      );
      M.sort = 'relevance';
      $('#marketSort').value = 'relevance';
      renderMarket();
      $('#marketStatus').textContent = `市场接口不可用，已用本地模糊匹配 · ${M.items.length} 个结果`;
      return;
    }
    $('#marketGrid').innerHTML = '';
    $('#marketStatus').textContent = `加载失败：${friendlyError(e)}。请检查网络后重试。`;
  }
}

async function loadMarketStars() {
  const repos = [...new Set(M.items.map((i) => i.source).filter((r) => r && r.includes('/')))].slice(
    0,
    14
  );
  if (!repos.length) return;
  try {
    const map = await api.marketStars(repos);
    let changed = false;
    for (const [repo, stars] of Object.entries(map || {})) {
      if (stars != null) {
        M.stars[repo] = stars;
        changed = true;
      }
    }
    if (changed && M.opened && !document.querySelector('[data-get][disabled]')) renderMarket();
  } catch {}
}

async function loadMarketDescriptions(seq) {
  const items = marketVisible();
  for (let i = 0; i < items.length; i += 3) {
    if (seq !== M.seq) return;
    const chunk = items
      .slice(i, i + 3)
      .filter((it) => !it.what && !M.desc[it.id]?.what && !M.descTried.has(it.id));
    if (!chunk.length) continue;
    let map = {};
    try {
      map = await api.marketDescribe(chunk);
    } catch {}
    if (seq !== M.seq) return;
    for (const item of chunk) {
      M.descTried.add(item.id);
      if (map?.[item.id]?.what) M.desc[item.id] = map[item.id];
      updateMarketDesc(item.id);
    }
  }
}

async function runMarketAsk() {
  if (!S.settings.ai?.hasKey) {
    toast('请先在设置中配置 AI 接口和 Key', true);
    return;
  }
  const need = $('#marketAskInput').value.trim();
  if (!need) {
    toast('先说说你想做什么');
    $('#marketAskInput').focus();
    return;
  }
  const btn = $('#marketAskBtn');
  btn.disabled = true;
  btn.textContent = '挑选中…';
  $('#marketStatus').textContent = 'AI 正在挑选技能…';
  try {
    let candidates = marketVisible().slice(0, 60);
    try {
      const extra = await api.marketList({ q: need, board: 'all' });
      if (extra?.items?.length) candidates = candidates.concat(extra.items);
    } catch {}
    const byId = new Map();
    for (const item of candidates) if (item?.id) byId.set(item.id, item);
    candidates = [...byId.values()].slice(0, 80);
    const res = await api.aiRecommend({
      need,
      items: candidates.map((item) => ({
        source: item.source,
        skillId: item.skillId,
        name: item.name,
        what: item.what || '',
        when: item.when || '',
      })),
    });
    if (!res?.ok) {
      toast(res?.error || 'AI 挑选失败', true);
      renderMarket();
      return;
    }
    const pool = new Map();
    for (const item of M.items) pool.set(item.id, item);
    for (const item of candidates) pool.set(item.id, item);
    M.aiPicks = (res.picks || [])
      .map((pick) => ({ ...(pool.get(pick.id) || {}), reason: pick.reason }))
      .filter((item) => item.id);
    M.aiNeed = need;
    M.aiNote = res.note || '';
    renderMarket();
  } catch (e) {
    toast(`AI 挑选失败：${friendlyError(e)}`, true);
    renderMarket();
  } finally {
    btn.disabled = false;
    btn.textContent = '帮我挑';
  }
}

async function openMarket() {
  closeDetail();
  closeModal();
  M.opened = true;
  $('#marketView').hidden = false;
  $('#marketAskInput').placeholder = S.settings.ai?.hasKey
    ? '说说你要做什么，例如：把播客剪成短视频并写推文'
    : '先在设置中配置 AI，然后让模型帮你挑技能';
  if (!M.items.length) await loadMarket({ board: M.board, q: '' });
  $('#marketQuery').focus();
}

function closeMarket() {
  M.opened = false;
  $('#marketView').hidden = true;
}

async function installMarketItem(id) {
  const item = M.items.find((x) => x.id === id);
  if (!item) return;
  const buttons = document.querySelectorAll(`[data-get="${CSS.escape(id)}"]`);
  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.textContent = '下载中…';
  });
  try {
    const res = await api.marketInstall({ source: item.source, skillId: item.skillId });
    if (res?.scan) applyScan(res.scan);
    if (res?.ok) {
      item.installed = true;
      toast(`已下载「${res.name}」到中央技能库`);
      renderMarket();
    } else if (res?.code === 'exists') {
      item.installed = true;
      toast('技能库里已经有这个技能了');
      renderMarket();
    } else {
      toast(res?.error || '下载失败', true);
      buttons.forEach((btn) => {
        btn.disabled = false;
        btn.innerHTML = `${ic('import')}获取`;
      });
    }
  } catch (e) {
    toast(`下载失败：${friendlyError(e)}`, true);
    buttons.forEach((btn) => {
      btn.disabled = false;
      btn.innerHTML = `${ic('import')}获取`;
    });
  }
}

async function openMarketAiBatch() {
  if (!S.settings.ai?.hasKey) {
    toast('请先在设置中配置 AI 接口和 Key', true);
    return;
  }
  const items = (M.aiPicks || marketVisible()).slice(0, 24);
  if (!items.length) {
    toast('当前没有可总结的技能');
    return;
  }
  showModal(`
    <button class="modal-close" data-modal-close title="关闭">${ic('close')}</button>
    <h3>用 AI 总结 ${items.length} 个技能？</h3>
    <p class="modal-sub">将调用 ${items.length} 次模型，可能产生费用；已有中文摘要会被 AI 版本覆盖。</p>
    <p class="field-hint">模型：${esc(S.settings.ai.model || '')}｜只发送公开的技能描述。</p>
    <div class="modal-actions">
      <button class="btn" id="modalCancel">取消</button>
      <button class="btn primary" id="aiMarketGo">${ic('sparkle')}开始总结</button>
    </div>
  `);
  $('#modalCancel').onclick = closeModal;
  $('#aiMarketGo').onclick = async () => {
    const btn = $('#aiMarketGo');
    btn.disabled = true;
    btn.textContent = '总结中…';
    $('#marketStatus').textContent = `AI 总结中 0/${items.length}…`;
    try {
      const res = await api.aiSummarizeMarket(
        items.map((item) => ({
          source: item.source,
          skillId: item.skillId,
          name: item.name,
        }))
      );
      if (!res?.ok && res?.error) {
        toast(res.error, true);
        renderMarket();
        return;
      }
      for (const [id, summary] of Object.entries(res.summaries || {})) {
        M.desc[id] = summary;
        M.aiIds.add(id);
      }
      closeModal();
      renderMarket();
      toast(
        `AI 已总结 ${res.done || 0}/${res.total || items.length} 个技能${
          res.errors?.length ? '，部分失败' : ''
        }`
      );
    } catch (e) {
      toast(`AI 总结失败：${friendlyError(e)}`, true);
      renderMarket();
    } finally {
      btn.disabled = false;
      btn.textContent = '开始总结';
    }
  };
}

/* ---------------- events ---------------- */
function bind() {
  $('#refreshBtn').onclick = () => refresh(true);
  $('#settingsBtn').onclick = () => openSettings().catch((e) => toast(friendlyError(e), true));
  $('#projectBtn').onclick = () => addProjectFlow().catch((e) => toast(friendlyError(e), true));
  $('#marketBtn').onclick = () => openMarket().catch((e) => toast(friendlyError(e), true));
  $('#marketAiBtn').onclick = openMarketAiBatch;
  $('#marketAskBtn').onclick = runMarketAsk;
  $('#marketAskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runMarketAsk();
  });
  $('#marketBack').onclick = closeMarket;
  $('#importBtn').onclick = () => importSkillsFlow().catch((e) => toast(friendlyError(e), true));
  $('#savePresetBtn').onclick = openSavePresetModal;
  $('#presetChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-preset]');
    if (chip) openPresetModal(chip.dataset.preset);
  });
  $('#batchToggle').onclick = () => setSelectionMode(!S.selectionMode);
  $('#batchClearBtn').onclick = () => setSelectionMode(false);
  $('#batchAddBtn').onclick = openBatchAddModal;
  $('#emptySettingsBtn').onclick = () => openSettings().catch((e) => toast(friendlyError(e), true));
  $('#searchInput').addEventListener('input', (e) => {
    S.query = e.target.value;
    $('#searchClear').hidden = !e.target.value;
    renderGrid();
  });
  $('#searchClear').onclick = () => {
    S.query = '';
    $('#searchInput').value = '';
    $('#searchClear').hidden = true;
    $('#searchInput').focus();
    renderGrid();
  };
  $('#categoryRow').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    S.category = btn.dataset.cat;
    renderCategories();
    renderGrid();
  });
  $('#sourceSelect').addEventListener('change', (e) => {
    S.source = e.target.value;
    renderSources();
    renderGrid();
  });
  try {
    const savedSort = localStorage.getItem('sm-sort');
    if (['recommended', 'name', 'stars', 'usage', 'recent'].includes(savedSort)) S.sort = savedSort;
  } catch {}
  $('#sortSelect').value = S.sort;
  $('#sortSelect').addEventListener('change', (e) => {
    S.sort = e.target.value;
    try {
      localStorage.setItem('sm-sort', S.sort);
    } catch {}
    renderGrid();
  });
  let marketSearchTimer = null;
  $('#marketQuery').addEventListener('input', (e) => {
    clearTimeout(marketSearchTimer);
    M.aiPicks = null;
    const q = e.target.value;
    marketSearchTimer = setTimeout(() => loadMarket({ q, board: M.board }), 380);
  });
  $('#marketCats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mcat]');
    if (!btn) return;
    M.category = btn.dataset.mcat;
    M.aiPicks = null;
    renderMarket();
    loadMarketDescriptions(M.seq);
  });
  $('#marketSort').addEventListener('change', (e) => {
    M.sort = e.target.value;
    renderMarket();
  });
  $('#marketTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-board]');
    if (!btn) return;
    document.querySelectorAll('#marketTabs button').forEach((x) => x.classList.toggle('on', x === btn));
    $('#marketQuery').value = '';
    M.aiPicks = null;
    loadMarket({ board: btn.dataset.board, q: '' }).catch((err) =>
      toast(friendlyError(err), true)
    );
  });
  $('#marketGrid').addEventListener('click', (e) => {
    if (e.target.closest('#marketAiReset')) {
      resetMarketAi();
      return;
    }
    const github = e.target.closest('[data-github]');
    if (github) {
      api.openUrl(`https://github.com/${github.dataset.github}`);
      return;
    }
    const get = e.target.closest('[data-get]');
    if (get) installMarketItem(get.dataset.get);
  });
  $('#grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-id]');
    if (S.selectionMode) {
      if (card) toggleSelected(card.dataset.id);
      return;
    }
    const action = e.target.closest('[data-action]');
    if (action) {
      e.stopPropagation();
      if (action.dataset.action === 'detail') openDetail(action.dataset.id);
      if (action.dataset.action === 'add') openAddModal(action.dataset.id);
      return;
    }
    const card2 = e.target.closest('.card[data-id]');
    if (card2) openDetail(card2.dataset.id);
  });
  $('#grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card[data-id]');
    if (!card) return;
    e.preventDefault();
    if (S.selectionMode) toggleSelected(card.dataset.id);
    else openDetail(card.dataset.id);
  });
  $('#grid').addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card[data-id]');
    if (!card) return;
    e.preventDefault();
    openContextMenu(card.dataset.id, e.clientX, e.clientY);
  });
  $('#drawerMask').onclick = closeDetail;
  $('#detailDrawer').addEventListener('click', async (e) => {
    const close = e.target.closest('#drawerClose');
    if (close) return closeDetail();
    const showAll = e.target.closest('#showAllAgents');
    if (showAll) {
      document.querySelectorAll('#detailDrawer .agent-row.extra').forEach((r) => (r.hidden = false));
      showAll.remove();
      return;
    }
    const add = e.target.closest('[data-action="detail-add"]');
    if (add) return openAddModal(add.dataset.id);
    const agentAdd = e.target.closest('[data-agent-add]');
    if (agentAdd && S.detailId) return openAddModalForTarget(S.detailId, agentAdd.dataset.agentAdd);
    const agentRemove = e.target.closest('[data-agent-remove]');
    if (agentRemove && S.detailId) {
      const removedId = S.detailId;
      const res = await api.remove({ id: removedId, targetId: agentRemove.dataset.agentRemove });
      toast(res?.ok ? '已移除' : res?.error || '移除失败', !res?.ok);
      await refresh(false);
      if (S.skills.some((s) => s.id === removedId)) return openDetail(removedId);
      return closeDetail();
    }
    const openUrl = e.target.closest('[data-open-url]');
    if (openUrl) return api.openUrl(openUrl.dataset.openUrl);
    const reveal = e.target.closest('[data-reveal]');
    if (reveal) return api.openFolder(reveal.dataset.reveal);
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      api.copy(copy.dataset.copy);
      toast('路径已复制');
      return;
    }
    const file = e.target.closest('[data-open-file]');
    if (file && S.detailId) {
      const d = await api.detail(S.detailId);
      const base = String(d?.path || '').replace(/[\\/]+$/, '');
      const sep = base.includes('\\') ? '\\' : '/';
      api.openFile(`${base}${sep}${file.dataset.openFile}`);
    }
  });
  $('#modalMask').addEventListener('click', (e) => {
    if (e.target.id === 'modalMask') closeModal();
  });
  $('#modal').addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#contextMenu')) hideContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (M.opened) {
        closeMarket();
        return;
      }
      hideContextMenu();
      if (!$('#modalMask').hidden) closeModal();
      else if (!$('#detailDrawer').hidden) closeDetail();
      return;
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      $('#searchInput').focus();
      $('#searchInput').select();
    }
  });
}

async function openAddModalForTarget(id, targetId) {
  openAddModal(id);
  const input = document.querySelector(`#modal .target-row input[value="${CSS.escape(targetId)}"]`);
  if (!input || input.disabled) return;
  const row = input.closest('.target-row');
  if (row?.hidden) {
    document.querySelectorAll('#modal .target-row.extra').forEach((r) => (r.hidden = false));
    document.querySelector('#showAllTargets')?.remove();
  }
  input.checked = true;
}

if (api.onAiProgress) {
  api.onAiProgress((p) => {
    const box = $('#aiProgress');
    if (box) {
      box.hidden = false;
      $('#aiProgressBar').style.width = `${p.total ? Math.round((p.done / p.total) * 100) : 0}%`;
      $('#aiProgressText').textContent = `${p.kind === 'local' ? '本机技能' : '市场技能'} ${p.done}/${
        p.total
      }${p.name ? ` · ${p.name}` : ''}${p.error ? ' · 有失败' : ''}`;
    }
    if (M.opened && p.kind === 'market') {
      $('#marketStatus').textContent = `AI 总结中 ${p.done}/${p.total}…`;
    }
  });
}

if (api.onEnriched) {
  api.onEnriched(async () => {
    try {
      const scan = await api.scan(false);
      applyScan(scan);
    } catch {}
  });
}

bind();

(async () => {
  try {
    S.settings = await api.getSettings();
  } catch {}
  await refresh(true);
})();
