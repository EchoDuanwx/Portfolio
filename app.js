(() => {
  'use strict';
  const data = window.PORTFOLIO;
  const main = document.querySelector('main');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const star = '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="currentColor" stroke-width="15" stroke-linecap="square"><path d="M50 4v92M4 50h92M17.5 17.5l65 65M17.5 82.5l65-65"/></g></svg>';
  const arrow = '<span aria-hidden="true">↗</span>';
  const tagList = tags => tags.map(tag => `<span>${escape(tag)}</span>`).join('');
  const number = index => String(index + 1).padStart(2, '0');
  const featured = (items, count) => [...items.filter(item => item.featured), ...items.filter(item => !item.featured)].slice(0, count);
  const emptyState = text => `<p class="empty-collection">${text}</p>`;
  const sampleNote = entry => entry.sample ? '<p class="content-note post-sample-note">这是一篇用于展示网站的示例文章。</p>' : '';
  const collectionNote = items => items.length && items.every(item => item.sample) ? '<p class="content-note collection-note">当前内容为展示版示例。</p>' : '';
  function postMeta(entry) {
    return `<span><time datetime="${escape(entry.date)}">${escape(entry.date)}</time>${entry.updated ? ` · 更新于 <time datetime="${escape(entry.updated)}">${escape(entry.updated)}</time>` : ''}${entry.sample ? ' · 示例文章' : ''}</span>`;
  }
  function nextPost(items, entry, route, label) {
    if (items.length < 2) return '';
    const next = items[(items.indexOf(entry) + 1) % items.length];
    return `<a class="next-story" href="#/${route}/${escape(next.slug)}"><span class="mono">${label}</span><h2>${escape(next.title)}<span>↗</span></h2></a>`;
  }
  let cleanup = () => {};
  let toastTimer;
  let revealObserver;

  function notify(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  async function copy(text, successMessage) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      notify(successMessage || '已复制');
    } catch {
      notify(`暂时无法复制，请手动复制：${text}`);
    }
  }

  function art(theme) {
    if (theme === 'finance') return `<div class="project-art finance-art" aria-hidden="true">
      <div class="art-corner"><span>YOSU / 有数</span><span>MAKE ROOM FOR LIFE.</span></div>
      <div class="finance-orbit"></div><div class="finance-orbit second"></div>
      <div class="finance-dashboard"><aside><b>有数<span>®</span></b><i class="selected">◈ &nbsp; 总览</i><i>▤ &nbsp; 我的账本</i><i>◷ &nbsp; 消费洞察</i><i>⚙ &nbsp; 设置</i><small>生活，自有分寸。</small></aside><div class="finance-content"><div class="mock-top"><b>每一笔，都心中有数。</b><span>↗</span></div><div class="balance-label">这个月，花得怎么样？</div><div class="balance">¥ 6,280<span>.00</span></div><div class="finance-chart">${[28,42,34,68,49,80,65,43,57,92,60,76,56,100,75].map((n,i)=>`<i style="--bar:${n}%;--i:${i}"></i>`).join('')}</div><div class="mock-chart-label"><span>01 OCT</span><span>15 OCT</span><span>30 OCT</span></div><div class="mock-spend"><div><i>↗</i><span>吃点好的<small>餐饮 · 今天</small></span><b>− 48.00</b></div><div><i>⌁</i><span>去远一点<small>交通 · 昨天</small></span><b>− 12.00</b></div></div></div></div><div class="finance-float"><span>✦</span> 好好记账，好好生活。</div></div>`;
    if (theme === 'notes') return `<div class="project-art notes-art" aria-hidden="true"><div class="art-corner"><span>MOMENT / 片刻</span><span>IDEAS LIVE HERE.</span></div><span class="notes-giant">a little<br /><em>spark.</em></span><div class="note-sheet"><span class="sheet-label">A THOUGHT WORTH KEEPING</span><span class="note-scribble">↳</span><h3>灵感不必<br />立刻有用。</h3><p>先接住它，<br />让想法慢慢发生。</p><span class="note-dots">● ● ●</span></div><div class="note-mini"><span>今天的灵光一闪</span><b>如果，<br />换个角度呢？</b><span>⌁ &nbsp; 记录于某个片刻</span></div><span class="note-flower">${star}</span><span class="notes-bottom">为稍纵即逝的想法，留一个位置。</span></div>`;
    if (theme === 'culture') return `<div class="project-art culture-art" aria-hidden="true"><div class="art-corner"><span>WANDER / 转角</span><span>A WALK TO REMEMBER.</span></div><div class="map-line one"></div><div class="map-line two"></div><div class="map-line three"></div><h3>拐个弯，<br />遇见日常。</h3><div class="map-pin">巷</div><div class="map-caption">一条没有最优解的城市漫游路线。 ↗</div></div>`;
    return `<div class="project-art system-art" aria-hidden="true"><div class="art-corner"><span>SPACING / 间距</span><span>LESS FRICTION. MORE CREATION.</span></div><div class="system-pieces"><span class="sys-a">Aa</span><span class="sys-button">恰到好处 ↗</span><span class="sys-circle">${star}</span><span class="sys-slider"><i></i></span><span class="sys-colors"><i></i><i></i><i></i></span><span class="sys-text">Small pieces.<br /><em>One language.</em></span></div></div>`;
  }

  function projectCover(project) {
    if (project.cover) return `<img class="project-cover" src="${escape(project.cover)}" alt="${escape(project.coverAlt || project.title)}" loading="lazy" />`;
    if (['finance', 'notes', 'culture', 'system'].includes(project.theme)) return art(project.theme);
    return `<div class="project-art generic-project-art" aria-hidden="true"><span class="mono">A NOTE IN PROGRESS</span><span class="generic-project-star">${star}</span><strong>${escape(project.title)}</strong></div>`;
  }

  function projectCard(project, index) {
    return `<a class="project-card reveal" href="#/project/${escape(project.slug)}" data-category="${escape(project.category)}"><div class="project-visual">${projectCover(project)}<span class="view-project">打开手札 ↗</span></div><div class="project-info"><div><span class="project-number mono">${number(index)} / ${escape(project.category)}</span><h3>${escape(project.title)}</h3><p>${escape(project.summary)}</p></div><span class="round-arrow">↗</span></div><div class="project-tags">${tagList(project.tags)}${project.sample ? '<span class="sample-label">概念示例</span>' : ''}</div></a>`;
  }

  function sectionHeader(number, title, english, link, linkText) {
    return `<div class="section-header"><div><span class="section-index mono">${number} / ${english}</span><h2>${title}<span class="tiny-dot">.</span></h2></div>${link ? `<a class="text-link" href="${link}">${linkText} ${arrow}</a>` : ''}</div>`;
  }

  function articleRow(article, i) {
    return `<a class="article-row reveal" href="#/article/${escape(article.slug)}"><span class="article-index mono">${number(i)}</span><div class="article-text"><div class="article-category">${escape(article.category)}<span>·</span>${escape(article.readTime)}${article.sample ? '<span>·</span>示例文章' : ''}</div><h3>${escape(article.title)}</h3><p>${escape(article.summary)}</p></div><time class="article-date mono" datetime="${escape(article.date)}">${escape(article.date)}</time><span class="round-arrow">↗</span></a>`;
  }

  // Only visuals and executable demos live in code. Article copy lives in content/playground/.
  const experimentGraphics = {
    palette: '<span class="swatch s1"></span><span class="swatch s2"></span><span class="swatch s3"></span><span class="swatch s4"></span><span class="swatch s5"></span>',
    type: '<span class="type-shape">Aa<span>字</span></span><i class="type-cross one">+</i><i class="type-cross two">+</i>',
    dots: `<span class="dot-field">${Array.from({length:49},(_,i)=>`<i style="--n:${i};--s:${[.45,.6,.9,1,.75,.5,.4][i%7]}"></i>`).join('')}</span>`,
  };

  function experimentCard(item, index) {
    const theme = Object.hasOwn(experimentGraphics, item.theme) ? item.theme : 'notes';
    const graphic = item.cover
      ? `<img class="project-cover" src="${escape(item.cover)}" alt="${escape(item.coverAlt || item.title)}" loading="lazy" />`
      : experimentGraphics[theme] || `<span class="experiment-fallback" aria-hidden="true">${star}</span>`;
    return `<a class="experiment-card reveal" href="#/experiment/${escape(item.slug)}"><div class="experiment-art ${theme}-preview">${graphic}<span class="experiment-launch">阅读手记 ↗</span></div><div class="experiment-label mono"><span>NOTE ${number(index)}</span><span>${escape(item.category)}</span></div><h3>${escape(item.title)}<span>↗</span></h3><p>${escape(item.summary)}</p></a>`;
  }

  function home() {
    return `<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> PRODUCT DESIGNER, LIFELONG EXPLORER</div><h1>认真设计，<br /><span class="hero-second">偶尔<span class="serif-emphasis">跑偏</span><svg class="hand-underline" viewBox="0 0 230 18" aria-hidden="true"><path d="M3 12C58 2 154 3 224 9M30 16C85 10 158 11 200 14"/></svg>。</span></h1><p class="hero-description">在逻辑与直觉之间，寻找恰到好处的体验。<br />这里有设计实践、灵光一现，还有一点不同意见。</p><a class="hero-cta" href="#/projects"><span class="cta-circle">↗</span><span>翻翻我的项目<span class="mono">EXPLORE SELECTED WORK</span></span></a></div><div class="hero-object"><span class="object-note mono">A LITTLE ORDER.<br />A LITTLE WONDER.</span><svg class="orbit-drawing" viewBox="0 0 460 380" aria-hidden="true"><ellipse cx="229" cy="196" rx="201" ry="117" transform="rotate(-29 229 196)"/><ellipse class="orbit-light" cx="229" cy="196" rx="169" ry="161" transform="rotate(25 229 196)"/><path class="orbit-tick" d="M402 95l14 10-16 7M78 316l-15-10 15-6"/></svg><div class="green-disc"><span>KEEP YOUR</span><span>CURIOSITY ALIVE</span></div><button class="curiosity-flower" type="button" aria-label="转动好奇心花朵">${star}</button><span class="hero-sticker">允许<br />不务正业<span>↗</span></span><span class="hero-art-caption">一点好奇心，让事情变有趣。</span><span class="hero-object-coordinate mono">FIG. 01 — AN OPEN MIND</span></div><div class="hero-bottom"><span class="mono">SCROLL TO DISCOVER <span>↓</span></span><span>未完成，也是一种状态。 <i>✳</i></span></div></section>
    <section class="selected-section section-space">${sectionHeader('01','项目手札','SELECTED WORK','#/projects','所有项目')}<div class="projects-grid">${featured(data.projects,2).map(projectCard).join('') || emptyState('新的项目手札，正在整理中。')}</div></section>
    <section class="playground-section section-space">${sectionHeader('02','奇思妙想','OFF THE CLOCK','#/playground','所有探索')}<p class="section-intro">不为解决什么大问题，只是想知道「这样会怎样」。</p><div class="experiments-grid">${featured(data.experiments,3).map(experimentCard).join('') || emptyState('好奇心一直在，新的手记即将到来。')}</div></section>
    <section class="writing-section section-space">${sectionHeader('03','唱唱反调','A DIFFERENT TAKE','#/articles','全部文章')}<div class="articles-list">${featured(data.articles,2).map(articleRow).join('') || emptyState('一些不同的想法，正在酝酿中。')}</div></section>
    <section class="about-strip reveal"><span class="strip-star">${star}</span><p>设计之外，<br /><span>我也是个对日常保持好奇的人。</span></p><a class="text-link" href="#/about">关于我，再多一点 ${arrow}</a></section>`;
  }

  function pageHeading(number, english, title, text) {
    return `<div class="page-heading"><div class="eyebrow">${number} / ${english}</div><h1>${title}<span class="tiny-dot">.</span></h1><p>${text}</p></div>`;
  }

  function projects() {
    const categories = ['全部项目', ...new Set(data.projects.map(project=>project.category))];
    return `${pageHeading('01','PROJECT NOTES','项目手札','从发现一个问题，到做出一点改变。<br />记录过程，也记录那些没有被选择的可能。')}<div class="filter-bar" role="group" aria-label="按项目类型筛选"><div>${categories.map((category,i)=>`<button type="button" class="filter-button ${i===0?'active':''}" aria-pressed="${i===0}" data-filter="${escape(category)}">${escape(category)}<span>${i===0?data.projects.length:data.projects.filter(p=>p.category===category).length}</span></button>`).join('')}</div><span class="mono work-count">${String(data.projects.length).padStart(2,'0')} PROJECT NOTES</span></div><div class="projects-grid all-projects">${data.projects.map(projectCard).join('') || emptyState('新的项目手札，正在整理中。')}</div>${collectionNote(data.projects)}`;
  }

  function projectDetail(slug) {
    const project = data.projects.find(p=>p.slug===slug);
    if (!project) return notFound();
    return `<div class="reading-progress" aria-hidden="true"></div><article class="project-detail"><a class="back-link" href="#/projects">← 返回项目手札</a><header class="detail-heading"><span class="eyebrow">PROJECT NOTES / ${escape(project.category)}</span><h1>${escape(project.title)}</h1><p>${escape(project.summary)}</p><div class="detail-meta"><div><span>记录时间</span><b>${postMeta(project)}</b></div>${project.role ? `<div><span>设计角色</span><b>${escape(project.role)}</b></div>` : ''}<div><span>设计关键词</span><b>${project.tags.length ? project.tags.map(escape).join(' / ') : escape(project.category)}</b></div></div></header><div class="detail-art">${projectCover(project)}</div><div class="project-body"><aside><span class="mono">BEHIND THE DESIGN</span><p>让思考有迹可循。</p><span class="post-read-time">${escape(project.readTime)}</span><button class="text-link" type="button" id="copy-article">复制文章链接 ↗</button></aside><div class="post-content reading-body"><div class="markdown-body">${project.bodyHtml}</div>${sampleNote(project)}</div></div>${nextPost(data.projects, project, 'project', 'NEXT PROJECT NOTE')}</article>`;
  }

  function playground(slug) {
    // Preserve links from the first version, which used #/playground/palette.
    if (slug) return experimentDetail(slug);
    return `${pageHeading('02','OFF THE CLOCK','奇思妙想','有些想法，先做出来再说。<br />记录小实验的起点、过程，以及意料之外的发现。')}<div class="experiments-grid playground-cards">${data.experiments.map(experimentCard).join('') || emptyState('好奇心一直在，新的手记即将到来。')}</div>${collectionNote(data.experiments)}`;
  }

  function demoPanel(demo) {
    const renderers = {palette:paletteDemo, type:typeDemo, dots:dotsDemo};
    if (!Object.hasOwn(renderers, demo)) return '';
    return `<section class="lab article-lab" aria-label="文章中的互动实验"><div class="lab-header"><span class="mono"><i class="live-dot"></i> TRY THE IDEA</span><span class="lab-caption">读到这里，动手试试。</span></div><div id="experiment-stage" data-experiment="${escape(demo)}">${renderers[demo]()}</div></section>`;
  }

  function experimentDetail(slug) {
    const entry = data.experiments.find(item => item.slug === slug);
    if (!entry) return notFound();
    return `<div class="reading-progress" aria-hidden="true"></div><article class="article-detail experiment-detail"><a class="back-link" href="#/playground">← 返回奇思妙想</a><header class="article-heading"><div class="eyebrow">${escape(entry.category)} / ${escape(entry.readTime)}</div><h1>${escape(entry.title)}</h1><p>${escape(entry.summary)}</p><div class="article-byline">${postMeta(entry)}<button class="text-link" type="button" id="copy-article">复制文章链接 ↗</button></div></header>${entry.cover ? `<img class="post-cover" src="${escape(entry.cover)}" alt="${escape(entry.coverAlt || entry.title)}" />` : ''}<div class="reading-body"><div class="markdown-body">${entry.bodyHtml}</div>${sampleNote(entry)}</div>${entry.demoUrl ? `<div class="external-demo"><a class="primary-button" href="${escape(entry.demoUrl)}" target="_blank" rel="noopener noreferrer">打开这个实验 ↗</a></div>` : ''}${demoPanel(entry.demo)}${nextPost(data.experiments,entry,'experiment','NEXT EXPLORATION')}</article>`;
  }

  function paletteDemo() {
    return `<div class="demo-intro"><h2>今天是什么颜色？</h2><p>点击色卡复制色值，锁住喜欢的颜色，再试试别的可能。</p></div><div class="palette-board"></div><div class="demo-controls"><span class="palette-mood">MOOD 01 / 柔软的星期天</span><button class="primary-button" id="shuffle-palette" type="button">换一种心情 <span>↻</span></button></div>`;
  }
  function typeDemo() {
    return `<div class="demo-intro"><h2>让一句话，有自己的表情。</h2><p>输入一句话，再把它调成你喜欢的样子。</p></div><div class="type-canvas"><div id="type-output">好奇心，不打烊。</div><span class="mono">WORDS HAVE PERSONALITY.</span></div><div class="type-controls"><label class="type-input-label">写点什么<input id="type-input" type="text" maxlength="28" value="好奇心，不打烊。" /></label><label>字号 <output id="size-label">64</output><input id="type-size" type="range" min="24" max="100" value="64" /></label><label>字间距 <output id="spacing-label">0</output><input id="type-spacing" type="range" min="-3" max="12" value="0" /></label><button class="secondary-button" id="toggle-font" type="button" aria-pressed="false">换成宋体 ↗</button></div>`;
  }
  function dotsDemo() {
    return `<div class="demo-intro"><h2>给大脑，放个小假。</h2><p>移动鼠标或轻触画布，让小圆点散散步。</p></div><div class="dots-canvas-wrap"><canvas id="dots-canvas" aria-label="会随指针移动散开并回到原位的圆点画布"></canvas><span class="mono">NO PURPOSE. JUST PLAY.</span></div><div class="demo-controls"><span>靠近一点，就有不同。</span><div><button class="secondary-button" type="button" id="reset-dots">重新集合 ↺</button><button class="primary-button" type="button" id="pause-dots" aria-pressed="${reduceMotion.matches}">${reduceMotion.matches?'开始动画':'暂停动画'} <span>Ⅱ</span></button></div></div>`;
  }

  function articles() {
    return `${pageHeading('03','A DIFFERENT TAKE','唱唱反调','习以为常的事情，值得再问一次为什么。<br />关于设计、产品，以及那些还没想明白的事。')}<div class="writing-note"><span>“</span><p>好的观点，不一定让人点头。<br />也可能让人停下来，想一想。</p><i>THINK AGAIN.</i></div><div class="articles-list articles-full">${data.articles.map(articleRow).join('') || emptyState('一些不同的想法，正在酝酿中。')}</div>${collectionNote(data.articles)}`;
  }

  function articleDetail(slug) {
    const article = data.articles.find(a=>a.slug===slug);
    if (!article) return notFound();
    return `<div class="reading-progress" aria-hidden="true"></div><article class="article-detail"><a class="back-link" href="#/articles">← 返回唱唱反调</a><header class="article-heading"><div class="eyebrow">${escape(article.category)} / ${escape(article.readTime)}</div><h1>${escape(article.title)}</h1><p>${escape(article.summary)}</p><div class="article-byline">${postMeta(article)}<button class="text-link" type="button" id="copy-article">复制文章链接 ↗</button></div></header>${article.cover ? `<img class="post-cover" src="${escape(article.cover)}" alt="${escape(article.coverAlt || article.title)}" />` : ''}<div class="reading-body"><div class="markdown-body">${article.bodyHtml}</div><div class="article-end">${star}<span>写到这里，思考继续。</span></div>${sampleNote(article)}</div>${nextPost(data.articles,article,'article','KEEP THINKING')}</article>`;
  }

  function about() {
    const about = data.about;
    return `${pageHeading('04','THE PERSON BEHIND','关于我','认真工作，也认真感受世界。')}<section class="about-main"><div class="about-poster"><span class="mono">SOMEWHERE BETWEEN</span><div class="poster-word">Logic<span>&</span><em>Magic.</em></div><div class="poster-flower">${star}</div><span class="poster-caption">理性构建。感性发现。</span></div><div class="about-copy"><span class="eyebrow">HELLO, NICE TO MEET YOU.</span><h2>嗨，我是<br /><span>${escape(data.site.designer || '一名产品设计师')}。</span></h2><p class="about-lead">${escape(about.intro)}</p>${about.paragraphs.map(p=>`<p>${escape(p)}</p>`).join('')}<div class="about-signature">永远好奇，永远未定稿。<span>↳</span></div></div></section><section class="principles-section">${sectionHeader('✳','一些小小的坚持','THINGS I BELIEVE')}<div class="principles-grid">${about.principles.map((p,i)=>`<div class="principle reveal"><span class="mono">0${i+1}</span><h3>${escape(p.title)}</h3><p>${escape(p.text)}</p></div>`).join('')}</div></section><section class="contact-block"><span class="mono">LET’S MAKE SOMETHING MEANINGFUL.</span><h2>聊聊一个想法，<br />或者只是打个招呼。</h2>${data.site.email?`<a class="primary-button" href="mailto:${escape(data.site.email)}">${escape(data.site.email)} ↗</a>`:'<a class="primary-button" href="#/projects">先从作品认识我 ↗</a><p class="content-note">这里留给你的联系方式，等待下一次相遇。</p>'}</section>`;
  }

  function notFound() {
    return `<section class="not-found"><span class="mono">404 / AN UNFINISHED IDEA</span><h1>这一页，<br />还在想象中。</h1><a class="primary-button" href="#/">回到首页 ↗</a></section>`;
  }

  function initPalette() {
    const palettes = [
      {name:'柔软的星期天',colors:['#713C46','#C7B4D8','#D9EC9C','#F4EAD5','#384C45']},
      {name:'落日之前',colors:['#9E4935','#E6A281','#F0C75E','#EAE2CB','#4B5366']},
      {name:'雨后散步',colors:['#344A46','#869E88','#CED7B4','#D9D7E2','#626078']},
      {name:'跳出框框',colors:['#434EAD','#BCEB7B','#EEE9DD','#E9A5BB','#75444F']},
      {name:'半杯冰美式',colors:['#3F342F','#927968','#D9C5A7','#E9E3D8','#AEBAB1']},
      {name:'一点点叛逆',colors:['#BA513E','#EABED2','#3D4475','#D6E2A2','#F0D9AC']}
    ];
    let index=0;
    const colors=[...palettes[0].colors];
    const locks=Array(5).fill(false);
    function render() {
      const board=document.querySelector('.palette-board');
      board.innerHTML=colors.map((color,i)=>`<div class="palette-color" style="--color:${color};--ink:${isLight(color)?'#262522':'#fff'}"><button type="button" class="copy-color" data-color-index="${i}" aria-label="复制颜色 ${color}"><span>${String(i+1).padStart(2,'0')}</span><b>${color}</b><small>点击复制</small></button><button type="button" class="lock-color" data-lock="${i}" aria-pressed="${locks[i]}" aria-label="${locks[i]?'解锁':'锁定'}第 ${i+1} 个颜色">${locks[i]?'已锁定 ▣':'锁定 ◇'}</button></div>`).join('');
      board.querySelectorAll('[data-color-index]').forEach(b=>b.addEventListener('click',()=>copy(colors[Number(b.dataset.colorIndex)],'色值已复制，去试试看。')));
      board.querySelectorAll('[data-lock]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.lock);locks[i]=!locks[i];render();board.querySelector(`[data-lock="${i}"]`).focus();}));
    }
    render();
    document.querySelector('#shuffle-palette').addEventListener('click',()=>{
      if(locks.every(Boolean)){notify('所有颜色都锁住啦，先解锁一个吧。');return;}
      index=(index+1)%palettes.length;
      palettes[index].colors.forEach((c,i)=>{if(!locks[i])colors[i]=c;});
      document.querySelector('.palette-mood').textContent=`MOOD 0${index+1} / ${palettes[index].name}`;
      render();
    });
  }

  function isLight(hex) {
    const [r,g,b]=hex.slice(1).match(/../g).map(v=>parseInt(v,16));
    return (r*299+g*587+b*114)/1000>154;
  }

  function initType() {
    const output=document.querySelector('#type-output');
    const input=document.querySelector('#type-input');
    const size=document.querySelector('#type-size');
    const spacing=document.querySelector('#type-spacing');
    input.addEventListener('input',()=>{output.textContent=input.value || '写点什么吧。';});
    size.addEventListener('input',()=>{output.style.setProperty('--type-size',`${size.value}px`);document.querySelector('#size-label').textContent=size.value;});
    spacing.addEventListener('input',()=>{output.style.letterSpacing=`${spacing.value}px`;document.querySelector('#spacing-label').textContent=spacing.value;});
    document.querySelector('#toggle-font').addEventListener('click',event=>{const serif=output.classList.toggle('serif');event.currentTarget.textContent=serif?'换成黑体 ↗':'换成宋体 ↗';event.currentTarget.setAttribute('aria-pressed',serif);});
  }

  function initDots() {
    const canvas=document.querySelector('#dots-canvas');
    const ctx=canvas.getContext('2d');
    const pointer={x:-1000,y:-1000};
    let points=[], width=0,height=0,frame=0,paused=reduceMotion.matches;
    function resize(){const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);points=[];const cols=Math.max(6,Math.floor(width/33));const rows=Math.floor(height/33);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const ox=(width-(cols-1)*33)/2+x*33,oy=(height-(rows-1)*33)/2+y*33;points.push({x:ox,y:oy,ox,oy,vx:0,vy:0});}draw();}
    function draw(){ctx.clearRect(0,0,width,height);for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,4.3,0,Math.PI*2);ctx.fillStyle=Math.hypot(p.x-pointer.x,p.y-pointer.y)<135?'#cce68d':'#e6dae4';ctx.fill();}}
    function animate(){if(paused)return;for(const p of points){const dx=p.x-pointer.x,dy=p.y-pointer.y,dist=Math.hypot(dx,dy);if(dist<125&&dist>0.1){const force=(125-dist)/125*1.8;p.vx+=dx/dist*force;p.vy+=dy/dist*force;}p.vx+=(p.ox-p.x)*.026;p.vy+=(p.oy-p.y)*.026;p.vx*=.87;p.vy*=.87;p.x+=p.vx;p.y+=p.vy;}draw();frame=requestAnimationFrame(animate);}
    function start(){cancelAnimationFrame(frame);if(!paused)animate();}
    canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();pointer.x=e.clientX-rect.left;pointer.y=e.clientY-rect.top;if(paused)draw();});
    canvas.addEventListener('pointerleave',()=>{pointer.x=-1000;pointer.y=-1000;if(paused)draw();});
    canvas.addEventListener('pointerdown',e=>{const rect=canvas.getBoundingClientRect();pointer.x=e.clientX-rect.left;pointer.y=e.clientY-rect.top;if(paused)draw();});
    canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){pointer.x=-1000;pointer.y=-1000;}});
    document.querySelector('#pause-dots').addEventListener('click',e=>{paused=!paused;e.currentTarget.innerHTML=`${paused?'继续动画':'暂停动画'} <span>${paused?'▷':'Ⅱ'}</span>`;e.currentTarget.setAttribute('aria-pressed',paused);start();});
    document.querySelector('#reset-dots').addEventListener('click',()=>{pointer.x=-1000;pointer.y=-1000;resize();notify('重新集合，继续发呆。');});
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();start();
    const onVisibility=()=>{if(document.hidden)cancelAnimationFrame(frame);else start();};document.addEventListener('visibilitychange',onVisibility);
    cleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
  }

  function bindInteractions() {
    const flower=document.querySelector('.curiosity-flower');
    if(flower){let turns=0;flower.addEventListener('click',()=>{turns++;flower.style.setProperty('--turn',`${turns*90}deg`);const phrases=['好奇心 +1。再试一次？','换个角度，也许就不一样。','允许跑偏，灵感正在路上。'];document.querySelector('.hero-art-caption').textContent=phrases[(turns-1)%phrases.length];});}
    document.querySelectorAll('.filter-button').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('.filter-button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});
      let count=0;document.querySelectorAll('.all-projects .project-card').forEach(card=>{const show=button.dataset.filter==='全部项目'||button.dataset.filter===card.dataset.category;card.hidden=!show;if(show){count++;card.classList.add('is-visible');}});document.querySelector('.work-count').textContent=`${String(count).padStart(2,'0')} PROJECT NOTES`;
    }));
    document.querySelector('#copy-article')?.addEventListener('click',()=>copy(location.href,'文章链接已复制。'));
    const stage=document.querySelector('#experiment-stage');
    if(stage){if(stage.dataset.experiment==='palette')initPalette();else if(stage.dataset.experiment==='type')initType();else initDots();}
    revealObserver?.disconnect();
    revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}),{threshold:.08});
    document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
  }

  let lastRoute='';
  function renderRoute() {
    if(location.hash==='#main') history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    cleanup();cleanup=()=>{};
    let route,slug;
    try{[,route='',slug]=decodeURIComponent(location.hash).split('/');}catch{route='404';}
    const active={project:'projects',article:'articles',experiment:'playground'}[route] || route || 'home';
    const pages={'':home,projects,playground:()=>playground(slug),articles,about,project:()=>projectDetail(slug),article:()=>articleDetail(slug),experiment:()=>experimentDetail(slug)};
    main.innerHTML=(pages[route] || notFound)();
    main.className=`page-${route || 'home'}`;
    document.querySelectorAll('[data-nav]').forEach(link=>{const selected=link.dataset.nav===active;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    closeMenu();
    const title={'':'认真设计，偶尔跑偏',projects:'项目手札',playground:slug ? data.experiments.find(item=>item.slug===slug)?.title : '奇思妙想',experiment:data.experiments.find(item=>item.slug===slug)?.title,articles:'唱唱反调',about:'关于我',project:data.projects.find(p=>p.slug===slug)?.title,article:data.articles.find(a=>a.slug===slug)?.title}[route] || '还在想象中';
    document.title=`${title} — ${data.site.name}`;
    bindInteractions();
    window.scrollTo({top:0,behavior:'instant'});
    if(lastRoute) main.focus({preventScroll:true});
    lastRoute=`/${route}${slug?`/${slug}`:''}`;
    updateReadingProgress();
  }

  function updateReadingProgress(){const bar=document.querySelector('.reading-progress');if(!bar)return;const body=document.querySelector('.reading-body');if(!body)return;const top=body.getBoundingClientRect().top+window.scrollY;const start=top-window.innerHeight*.3;const end=top+body.offsetHeight-window.innerHeight*.7;const progress=Math.min(1,Math.max(0,(window.scrollY-start)/Math.max(1,end-start)));bar.style.transform=`scaleX(${progress})`;}
  function closeMenu(){
    const toggle=document.querySelector('.menu-toggle');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','展开导航');
    document.querySelector('.site-header').classList.remove('menu-open');
  }
  document.querySelectorAll('#main-nav a').forEach(link=>link.addEventListener('click',closeMenu));
  document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView({behavior:'instant'});});
  document.querySelectorAll('[data-site-name]').forEach(el=>el.textContent=data.site.name);
  document.querySelector('.wordmark').setAttribute('aria-label',`${data.site.name}，首页`);
  document.querySelector('#year').textContent=new Date().getFullYear();
  document.querySelector('meta[name=description]').setAttribute('content',data.site.description);
  document.querySelector('.menu-toggle').addEventListener('click',e=>{const expanded=e.currentTarget.getAttribute('aria-expanded')!=='true';e.currentTarget.setAttribute('aria-expanded',expanded);e.currentTarget.setAttribute('aria-label',expanded?'收起导航':'展开导航');document.querySelector('.site-header').classList.toggle('menu-open',expanded);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.site-header').classList.contains('menu-open')){document.querySelector('.menu-toggle').click();document.querySelector('.menu-toggle').focus();}});
  document.querySelector('.back-top').addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduceMotion.matches?'instant':'smooth'});document.querySelector('.wordmark').focus({preventScroll:true});});
  window.addEventListener('hashchange',renderRoute);
  window.addEventListener('scroll',updateReadingProgress,{passive:true});
  renderRoute();
})();
