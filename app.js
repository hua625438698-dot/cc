/* 时态小站 app logic — ES6, no modules, no external deps */
(function () {
  "use strict";

  var DATA = window.TENSES_DATA;
  var root = document.getElementById("app");
  if (!DATA || !root) {
    if (root) root.innerHTML = "<p style='padding:24px'>数据加载失败，请确认 data.js 与本页在同一目录。</p>";
    return;
  }

  var SECTIONS = [
    { id: "present", title: "一般现在时", en: "Present Simple", tag: "习惯 · 事实 · 时刻表" },
    { id: "continuous", title: "现在进行时", en: "Present Continuous", tag: "正在发生 · 暂时的情况" },
    { id: "past", title: "一般过去时", en: "Past Simple", tag: "已经发生 · 已经结束" },
    { id: "future", title: "一般将来时", en: "Future Simple", tag: "will · be going to" },
    { id: "mixed", title: "综合练习", en: "Mixed Tenses", tag: "看时间词，判断时态" }
  ];

  var TYPE_LABEL = {
    mcq: "选择题",
    fill: "填空题",
    timeword: "选时间词",
    correct: "改错题",
    order: "连词成句",
    cloze: "短文填空"
  };

  var quizState = null; // { section, items, index, locked, finished, results }

  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u3002\uFF0E]/g, ".")
      .replace(/[\uFF0C]/g, ",")
      .replace(/[\uFF01]/g, "!")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.,!?;:]+$/g, "")
      .toLowerCase();
  }
  function answersOf(item) {
    if (item.answers) return item.answers;
    if (item.answer != null) return [item.answer];
    return [];
  }
  function expandContractions(s) {
    return s
      .replace(/\bi'm\b/g, "i am")
      .replace(/\byou're\b/g, "you are")
      .replace(/\bhe's\b/g, "he is")
      .replace(/\bshe's\b/g, "she is")
      .replace(/\bit's\b/g, "it is")
      .replace(/\bwe're\b/g, "we are")
      .replace(/\bthey're\b/g, "they are")
      .replace(/\bisn't\b/g, "is not")
      .replace(/\baren't\b/g, "are not")
      .replace(/\bwasn't\b/g, "was not")
      .replace(/\bweren't\b/g, "were not")
      .replace(/\bdon't\b/g, "do not")
      .replace(/\bdoesn't\b/g, "does not")
      .replace(/\bdidn't\b/g, "did not")
      .replace(/\bwon't\b/g, "will not")
      .replace(/\bcan't\b/g, "cannot")
      .replace(/\bcouldn't\b/g, "could not")
      .replace(/\bi'll\b/g, "i will")
      .replace(/\bhe'll\b/g, "he will")
      .replace(/\bshe'll\b/g, "she will")
      .replace(/\bwe'll\b/g, "we will")
      .replace(/\bthey'll\b/g, "they will")
      .replace(/\byou'll\b/g, "you will");
  }
  function isCorrect(item, user) {
    var n = norm(user);
    if (!n) return false;
    var list = answersOf(item).map(norm);
    if (list.indexOf(n) !== -1) return true;
    var n2 = expandContractions(n);
    var list2 = list.map(expandContractions);
    if (list2.indexOf(n2) !== -1) return true;
    // Allow optional subject pronoun before a verb phrase: "he is swimming" / "He's swimming"
    var prefix = /^(i|you|he|she|it|we|they|tom|lucy|mum|dad|lily|ben|jack|sam|anna|my mum|my dad|the baby|the sun|someone)\s+/;
    if (prefix.test(n2)) {
      var rest = n2.replace(prefix, "");
      if (list2.indexOf(rest) !== -1) return true;
    }
    return false;
  }

  function hashParts() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    var parts = h.split("/").filter(Boolean);
    return parts;
  }

  function go(to) {
    location.hash = "#/" + to;
  }

  function sectionById(id) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return SECTIONS[i];
    return null;
  }

  function quizCount(id) {
    var n = (DATA.quizzes[id] || []).length;
    if (id === "mixed") {
      var extra = 0;
      (DATA.cloze || []).forEach(function (c) { extra += c.blanks.length; });
      n += extra;
    }
    return n;
  }

  /* ---------- Timeline SVGs ---------- */
  function timelineSVG(kind) {
    var ink = "#2A2744";
    var muted = "#8A879C";
    var line = "#D9CDBB";
    var colors = {
      present: "#1FA971",
      continuous: "#F07828",
      past: "#6B5CFF",
      future: "#2B8FFF",
      mixed: "#E8487A"
    };
    var c = colors[kind] || colors.present;
    var marks = "";
    var caption = "";
    if (kind === "present") {
      marks =
        '<circle cx="90" cy="80" r="8" fill="' + c + '" opacity="0.35"/>' +
        '<circle cx="170" cy="80" r="9" fill="' + c + '" opacity="0.55"/>' +
        '<circle cx="250" cy="80" r="11" fill="' + c + '"/>' +
        '<circle cx="330" cy="80" r="9" fill="' + c + '" opacity="0.55"/>' +
        '<circle cx="410" cy="80" r="8" fill="' + c + '" opacity="0.35"/>' +
        '<path d="M90 80 L410 80" stroke="' + c + '" stroke-width="3" stroke-dasharray="6 7" fill="none" opacity="0.5"/>';
      caption = "习惯和事实会一次次发生，像沿着时间线不断重复。";
    } else if (kind === "continuous") {
      marks =
        '<rect x="222" y="62" width="56" height="36" rx="12" fill="' + c + '" opacity="0.2"/>' +
        '<circle cx="250" cy="80" r="14" fill="' + c + '"/>' +
        '<circle cx="250" cy="80" r="22" fill="none" stroke="' + c + '" stroke-width="3" opacity="0.45"/>';
      caption = "动作正发生在“现在”这一点上，还没有结束。";
    } else if (kind === "past") {
      marks =
        '<circle cx="130" cy="80" r="14" fill="' + c + '"/>' +
        '<path d="M130 94 L130 118" stroke="' + c + '" stroke-width="3"/>' +
        '<polygon points="130,128 122,118 138,118" fill="' + c + '"/>';
      caption = "动作发生在“现在”之前，并且已经结束。";
    } else if (kind === "future") {
      marks =
        '<circle cx="370" cy="80" r="14" fill="' + c + '"/>' +
        '<path d="M370 94 L370 118" stroke="' + c + '" stroke-width="3"/>' +
        '<polygon points="370,128 362,118 378,118" fill="' + c + '"/>';
      caption = "动作还没有发生，落在“现在”之后的将来一侧。";
    } else {
      marks =
        '<circle cx="130" cy="80" r="10" fill="#6B5CFF"/>' +
        '<circle cx="250" cy="80" r="12" fill="#F07828"/>' +
        '<circle cx="250" cy="80" r="7" fill="#1FA971"/>' +
        '<circle cx="370" cy="80" r="10" fill="#2B8FFF"/>';
      caption = "过去、现在、将来都可能出现——先看时间词，再决定时态。";
    }
    var svg =
      '<svg class="tl-svg" viewBox="0 0 500 168" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="时态时间轴">' +
      '<line x1="40" y1="80" x2="460" y2="80" stroke="' + line + '" stroke-width="6" stroke-linecap="round"/>' +
      '<polygon points="468,80 450,72 450,88" fill="' + line + '"/>' +
      '<line x1="250" y1="52" x2="250" y2="108" stroke="' + ink + '" stroke-width="2" stroke-dasharray="3 4"/>' +
      marks +
      '<text x="90" y="36" text-anchor="middle" font-size="15" font-weight="700" fill="' + muted + '" font-family="system-ui,sans-serif">过去</text>' +
      '<text x="250" y="36" text-anchor="middle" font-size="16" font-weight="800" fill="' + ink + '" font-family="system-ui,sans-serif">现在</text>' +
      '<text x="410" y="36" text-anchor="middle" font-size="15" font-weight="700" fill="' + muted + '" font-family="system-ui,sans-serif">将来</text>' +
      '<text x="90" y="154" text-anchor="middle" font-size="11" fill="' + muted + '" font-family="system-ui,sans-serif">Past</text>' +
      '<text x="250" y="154" text-anchor="middle" font-size="11" fill="' + muted + '" font-family="system-ui,sans-serif">Now</text>' +
      '<text x="410" y="154" text-anchor="middle" font-size="11" fill="' + muted + '" font-family="system-ui,sans-serif">Future</text>' +
      "</svg>";
    return '<figure class="timeline-card">' + svg + "<figcaption>" + esc(caption) + "</figcaption></figure>";
  }

  /* ---------- Shell / nav ---------- */
  function topbar(showBack, title) {
    var back = showBack
      ? '<button class="back-btn" type="button" data-go="home" aria-label="返回首页">←</button>'
      : "";
    return (
      '<div class="topbar">' + back +
      '<a class="brand" href="#/home">' +
        '<span class="logo" aria-hidden="true">' +
          '<svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="9" stroke="#fff" stroke-width="2"/><circle cx="13" cy="13" r="1.6" fill="#2A2744"/><path d="M13 13 V7" stroke="#2A2744" stroke-width="2" stroke-linecap="round"/><path d="M13 13 H18" stroke="#E8487A" stroke-width="2" stroke-linecap="round"/></svg>' +
        "</span>" +
        '<span class="brand-text"><h1>时态小站</h1><p>' + esc(title || "剑桥少儿英语 · 四大时态") + "</p></span>" +
      "</a></div>"
    );
  }

  /* ---------- Home ---------- */
  function renderHome() {
    var cards = SECTIONS.map(function (s) {
      var extra = s.id === "mixed" ? " card-mixed" : "";
      return (
        '<a class="card-link card-' + s.id + extra + '" href="#/' + s.id + '">' +
          '<span class="count">' + quizCount(s.id) + " 题</span>" +
          '<span class="dot bg-' + s.id + '"></span>' +
          "<h3>" + esc(s.title) + "</h3>" +
          '<p class="en">' + esc(s.en) + "</p>" +
          '<p class="tag fg-' + s.id + '">' + esc(s.tag) + "</p>" +
        "</a>"
      );
    }).join("");
    root.innerHTML =
      topbar(false) +
      '<section class="hero">' +
        "<h2>四个时态，一把钥匙：先看时间词。</h2>" +
        '<p class="lead">专为剑桥少儿英语 Starters / Movers / Flyers 编写。讲解、时间轴、时间词和练习都在里面，适合在手机或微信里打开。</p>' +
        '<div class="pills"><span class="pill">一般现在时</span><span class="pill">现在进行时</span><span class="pill">一般过去时</span><span class="pill">一般将来时</span><span class="pill">综合练习</span></div>' +
      "</section>" +
      '<div class="grid home-grid">' + cards + "</div>" +
      '<div class="home-tips">' +
        "<h3>怎么学最有效？</h3>" +
        "<ol>" +
          "<li>先看时间轴，知道这个时态落在过去、现在还是将来。</li>" +
          "<li>再读讲解：肯定 / 否定 / 疑问 / 简短回答，以及人称变化。</li>" +
          "<li>记牢时间词，它们常常就是考题里的线索。</li>" +
          "<li>做练习，马上看解析；最后做综合练习，四个时态混在一起判断。</li>" +
        "</ol>" +
      "</div>" +
      '<p class="footer-note">本页为纯静态网页，不含任何外部字体、图床或统计代码，可直接发布到腾讯云 COS、阿里云 OSS 或 Gitee Pages。词汇与语法控制在剑桥少儿英语三级（Flyers）以内。</p>';
  }

  /* ---------- Lesson ---------- */
  function renderTable(rows, cls) {
    if (!rows || !rows.length) return "";
    var head = rows[0];
    var body = rows.slice(1);
    var thead = "<tr>" + head.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>";
    var tbody = body.map(function (r) {
      return "<tr>" + r.map(function (c, i) {
        return (i === 0 ? "<th>" : "<td>") + esc(c) + (i === 0 ? "</th>" : "</td>");
      }).join("") + "</tr>";
    }).join("");
    return '<div class="table-wrap"><table class="' + (cls || "") + '"><thead>' + thead + "</thead><tbody>" + tbody + "</tbody></table></div>";
  }

  function renderLearn(lesson) {
    var html = '<div class="panel"><h3>什么时候用？</h3>';
    (lesson.usage || []).forEach(function (u) {
      html += '<div class="usage-item"><h4>' + esc(u.h) + "</h4><p>" + esc(u.p) + "</p></div>";
    });
    var f = lesson.forms || {};
    html += "<h3>句型结构（人称变化）</h3>";
    if (f.intro) html += "<p>" + esc(f.intro) + "</p>";
    html += renderTable(f.table);
    (f.notes || []).forEach(function (n) {
      html += '<div class="note">' + esc(n) + "</div>";
    });
    var sp = lesson.spelling || {};
    if (sp.title) html += "<h3>" + esc(sp.title) + "</h3>";
    (sp.rules || []).forEach(function (r) {
      html += '<div class="rule"><strong>' + esc(r.name) + '</strong><div class="ex">' + esc(r.examples) + "</div></div>";
    });
    if (sp.irregular) {
      html += "<h4>" + esc(sp.irregularTitle || "不规则动词") + "</h4>";
      html += renderTable(sp.irregular, "irr");
    }
    html += "</div>";
    return html;
  }

  function renderWords(lesson) {
    var tw = lesson.timewords || {};
    var html = '<div class="panel"><h3>判断时态的时间词</h3>';
    if (tw.intro) html += "<p>" + esc(tw.intro) + "</p>";
    (tw.groups || []).forEach(function (g) {
      html += '<div class="word-group"><h4>' + esc(g.name) + "</h4><div class=\"chips\">";
      (g.items || []).forEach(function (it) {
        html += '<span class="chip chip-' + lesson.color + '"><b>' + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></span>";
      });
      html += "</div>";
      if (g.tip) html += '<div class="note">' + esc(g.tip) + "</div>";
      html += "</div>";
    });
    html += "</div>";
    return html;
  }

  function renderLesson(id, tab) {
    var sec = sectionById(id);
    if (!sec) { renderHome(); return; }
    tab = tab || "timeline";
    var lesson = DATA.lessons[id];
    var tabs = [
      { id: "timeline", name: "时间轴" },
      { id: "learn", name: "讲解" },
      { id: "words", name: "时间词" },
      { id: "quiz", name: "练习 " + quizCount(id) }
    ];
    // mixed has no full lesson; still show a short guide
    if (id === "mixed") {
      tabs = [
        { id: "timeline", name: "怎么做" },
        { id: "quiz", name: "综合练习 " + quizCount(id) }
      ];
    }
    var tabBtns = tabs.map(function (t) {
      return '<button class="tab tab-' + id + (t.id === tab ? " is-on" : "") + '" type="button" data-go="' + id + "/" + t.id + '">' + esc(t.name) + "</button>";
    }).join("");

    var body = "";
    if (id === "mixed") {
      if (tab === "quiz") {
        body = renderQuizShell(id);
      } else {
        body =
          timelineSVG("mixed") +
          '<div class="panel">' +
            "<h3>四个时态放在一起，怎么判断？</h3>" +
            "<ol>" +
              "<li><strong>先圈时间词。</strong>every day / usually → 一般现在时；now / Look! / at the moment → 现在进行时；yesterday / last… / …ago → 一般过去时；tomorrow / next… / soon → 一般将来时。</li>" +
              "<li><strong>再看人称。</strong>he / she / it 在一般现在时要加 -s / -es；进行时要选对 am / is / are；过去时 was 还是 were。</li>" +
              "<li><strong>注意“陷阱”。</strong>didn't / doesn't / don't / will / won't 后面一律用动词原形；Did you see（不是 saw）；be going to 不要和 will 叠用。</li>" +
              "<li>本部分有 " + (DATA.quizzes.mixed.length) + " 道综合题，外加 2 篇剑桥风格短文填空（共 " + quizCount("mixed") + " 空/题）。做完可以查看错题解析。</li>" +
            "</ol>" +
            '<div class="actions"><button class="btn btn-primary btn-grow" type="button" data-go="mixed/quiz">开始综合练习</button></div>' +
          "</div>";
      }
    } else if (tab === "learn") {
      body = renderLearn(lesson);
    } else if (tab === "words") {
      body = renderWords(lesson);
    } else if (tab === "quiz") {
      body = renderQuizShell(id);
    } else {
      body =
        timelineSVG(id) +
        '<div class="panel"><h3>' + esc(lesson.title) + "落在时间线的哪里？</h3><p>" +
        esc(lesson.timelineNote) + "</p>" +
        '<div class="actions">' +
          '<button class="btn btn-primary" type="button" data-go="' + id + '/learn">看讲解</button>' +
          '<button class="btn btn-ghost" type="button" data-go="' + id + '/quiz">直接练习</button>' +
        "</div></div>";
    }

    root.innerHTML =
      topbar(true, sec.en) +
      '<header class="lesson-head">' +
        '<p class="kicker fg-' + id + '">' + esc(sec.tag) + "</p>" +
        "<h2>" + esc(sec.title) + "</h2>" +
        '<p class="en">' + esc(sec.en) + "</p>" +
        '<nav class="tabs" aria-label="本课栏目">' + tabBtns + "</nav>" +
      "</header>" + body;
  }

  /* ---------- Quiz ---------- */
  function buildItems(section) {
    var items = (DATA.quizzes[section] || []).map(function (q) {
      var copy = {};
      for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) copy[k] = q[k];
      if (copy.options) copy.options = copy.options.slice();
      return copy;
    });
    items = shuffle(items);
    items.forEach(function (it) {
      if (it.options) it.options = shuffle(it.options);
      if (it.type === "order" && it.words) {
        // keep punctuation glued; shuffle all tokens
        it.displayWords = shuffle(it.words.slice());
      }
    });
    if (section === "mixed") {
      (DATA.cloze || []).forEach(function (c) {
        items.push({
          id: c.id,
          type: "cloze",
          title: c.title,
          prompt: c.prompt,
          passage: c.passage,
          blanks: c.blanks,
          explain: c.title
        });
      });
    }
    return items;
  }

  function startQuiz(section, onlyWrongIds) {
    var items;
    if (onlyWrongIds && quizState && quizState.results) {
      items = quizState.items.filter(function (it) {
        return onlyWrongIds.indexOf(it.id) !== -1;
      });
      if (!items.length) items = buildItems(section);
    } else {
      items = buildItems(section);
    }
    quizState = {
      section: section,
      items: items,
      index: 0,
      locked: false,
      finished: false,
      results: {}
    };
  }

  function currentItem() {
    if (!quizState) return null;
    return quizState.items[quizState.index];
  }

  function renderQuizShell(section) {
    if (!quizState || quizState.section !== section) {
      var n = quizCount(section);
      return (
        '<div class="panel">' +
          "<h3>准备好了吗？</h3>" +
          "<p>本套练习共 <strong>" + n + "</strong> 题，题型包括选择、填空、选时间词、改错和连词成句" +
          (section === "mixed" ? "，最后还有 2 篇短文填空" : "") +
          "。提交后立刻看到正误和中文解析。题目每次都会打乱顺序。</p>" +
          '<div class="actions">' +
            '<button class="btn btn-primary btn-grow" type="button" data-action="start-quiz" data-section="' + section + '">开始练习</button>' +
          "</div>" +
        "</div>"
      );
    }
    if (quizState.finished) return renderScore();
    return renderQuestion();
  }

  function highlightStem(stem) {
    return esc(stem).replace(/_{2,}|____+/g, '<span class="blank">&nbsp;&nbsp;&nbsp;</span>');
  }

  function renderQuestion() {
    var it = currentItem();
    var total = quizState.items.length;
    var i = quizState.index + 1;
    var sec = quizState.section;
    var pct = Math.round(((i - 1) / total) * 100);
    var html =
      '<div class="quiz-bar">' +
        '<div class="progress" aria-hidden="true"><span class="prog-' + sec + '" style="width:' + pct + '%"></span></div>' +
        '<div class="q-meta">' + i + " / " + total + "</div>" +
      "</div>" +
      '<div class="panel" data-qid="' + esc(it.id) + '">' +
        '<div class="q-type">' + esc(TYPE_LABEL[it.type] || it.type) + (it.title ? " · " + esc(it.title) : "") + "</div>" +
        "<p class=\"hint\">" + esc(it.prompt || "") + "</p>";

    if (it.type === "cloze") {
      html += renderCloze(it);
    } else {
      if (it.stem) html += '<p class="stem">' + highlightStem(it.stem) + "</p>";
      if (it.type === "mcq" || it.type === "timeword" || it.type === "correct") {
        html += '<div class="options">';
        (it.options || []).forEach(function (op, idx) {
          html += '<button class="opt" type="button" data-action="pick" data-val="' + esc(op) + '">' +
            '<span style="color:#9a96ad;font-size:12px;margin-right:8px">' + String.fromCharCode(65 + idx) + "</span>" +
            esc(op) + "</button>";
        });
        html += "</div>";
      } else if (it.type === "fill") {
        html += '<div class="fill-row"><input id="fill-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="在这里填写（可用缩写，如 don\'t、I\'m）" aria-label="答案"><button class="btn btn-primary" type="button" data-action="submit">提交</button></div>';
      } else if (it.type === "order") {
        html += '<div class="hint">先点下面的词，把它们按顺序排进虚线框；点框里的词可以拿下来。</div>';
        html += '<div class="order-slots" id="order-slots" aria-label="已排好的句子"></div>';
        html += '<div class="order-bank" id="order-bank">';
        (it.displayWords || it.words || []).forEach(function (w, idx) {
          html += '<button class="wchip" type="button" data-action="chip" data-idx="' + idx + '">' + esc(w) + "</button>";
        });
        html += "</div>";
        html += '<div class="actions"><button class="btn btn-primary btn-grow" type="button" data-action="submit">提交语序</button></div>';
      }
    }

    html += '<div id="feedback"></div><div class="actions" id="q-actions"></div></div>';
    return html;
  }

  function renderCloze(it) {
    var html = '<div class="passage" id="cloze-passage">';
    var parts = it.passage.split(/\{(\d+)\}/);
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        html += esc(parts[i]);
      } else {
        var n = parts[i];
        html += '<span class="gap-wrap"><span class="n">' + n + "</span>" +
          '<input class="cloze-gap" data-num="' + n + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="第' + n + '空"></span>';
      }
    }
    html += "</div>";
    html += '<div class="actions" style="margin-top:14px"><button class="btn btn-primary btn-grow" type="button" data-action="submit">提交短文</button></div>';
    return html;
  }

  function lockOptions(picked, correct) {
    var btns = root.querySelectorAll(".opt");
    for (var i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute("data-val");
      btns[i].disabled = true;
      if (norm(v) === norm(correct)) btns[i].className += " is-right";
      else if (norm(v) === norm(picked) && norm(picked) !== norm(correct)) btns[i].className += " is-wrong";
    }
  }

  function showFeedback(ok, message, explain) {
    var box = $("#feedback");
    if (!box) return;
    box.innerHTML =
      '<div class="feedback ' + (ok ? "ok" : "bad") + '">' +
        "<strong>" + (ok ? "回答正确！" : "再看一看") + "</strong>" +
        (message ? "<div>" + message + "</div>" : "") +
        (explain ? "<div style='margin-top:6px'>" + esc(explain) + "</div>" : "") +
      "</div>";
    var actions = $("#q-actions");
    var last = quizState.index >= quizState.items.length - 1;
    actions.innerHTML =
      '<button class="btn btn-ok btn-grow" type="button" data-action="next">' +
      (last ? "查看成绩" : "下一题") + "</button>";
    var bar = root.querySelector(".progress > span");
    if (bar) {
      var pct = Math.round(((quizState.index + 1) / quizState.items.length) * 100);
      bar.style.width = pct + "%";
    }
  }

  function record(id, user, ok, correct) {
    quizState.results[id] = { user: user, ok: ok, correct: correct };
    quizState.locked = true;
  }

  function submitCurrent() {
    if (!quizState || quizState.locked) return;
    var it = currentItem();
    if (!it) return;

    if (it.type === "cloze") {
      submitCloze(it);
      return;
    }
    var user = "";
    if (it.type === "mcq" || it.type === "timeword" || it.type === "correct") {
      var picked = root.querySelector(".opt.is-picked");
      if (!picked) return;
      user = picked.getAttribute("data-val") || "";
    } else if (it.type === "fill") {
      var inp = $("#fill-input");
      user = inp ? inp.value : "";
      if (!norm(user)) {
        if (inp) inp.focus();
        return;
      }
    } else if (it.type === "order") {
      var slots = root.querySelectorAll("#order-slots .wchip");
      var words = [];
      for (var i = 0; i < slots.length; i++) words.push(slots[i].textContent);
      user = words.join(" ").replace(/\s+([.,!?])/g, "$1");
      if (!words.length) return;
    }

    var ok = isCorrect(it, user);
    var correct = answersOf(it)[0];
    record(it.id, user, ok, correct);

    if (it.type === "mcq" || it.type === "timeword" || it.type === "correct") {
      lockOptions(user, correct);
    } else if (it.type === "fill") {
      var f = $("#fill-input");
      if (f) {
        f.disabled = true;
        f.className += ok ? " is-right" : " is-wrong";
      }
    }

    var msg = ok ? "" : ("正确答案：" + esc(answersOf(it).join("  或  ")));
    showFeedback(ok, msg, it.explain);
  }

  function submitCloze(it) {
    var inputs = root.querySelectorAll(".cloze-gap");
    var allOk = true;
    var summary = [];
    var filled = 0;
    for (var i = 0; i < it.blanks.length; i++) {
      var b = it.blanks[i];
      var inp = root.querySelector('.cloze-gap[data-num="' + b.num + '"]');
      var user = inp ? inp.value : "";
      if (norm(user)) filled++;
      var fake = { answers: b.answers };
      var ok = isCorrect(fake, user);
      if (!ok) allOk = false;
      if (inp) {
        inp.disabled = true;
        inp.className += ok ? " is-right" : " is-wrong";
      }
      var bid = it.id + "-" + b.num;
      quizState.results[bid] = { user: user, ok: ok, correct: b.answers[0], explain: b.explain, stem: "第 " + b.num + " 空（" + it.title + "）" };
      if (!ok) summary.push("第 " + b.num + " 空正确答案：" + b.answers.join(" 或 "));
    }
    if (!filled) {
      // unlock if completely empty
      for (var j = 0; j < inputs.length; j++) {
        inputs[j].disabled = false;
        inputs[j].className = "cloze-gap";
      }
      it.blanks.forEach(function (b) { delete quizState.results[it.id + "-" + b.num]; });
      return;
    }
    quizState.locked = true;
    // also mark the cloze item itself so "next" works; score uses blank ids
    quizState.results[it.id] = { user: "(passage)", ok: allOk, correct: "", skipScore: true };
    var msg = allOk ? "每一空都对了，真棒！" : summary.join("<br>");
    var explain = allOk ? "短文里的时间词（usually、Look!、now、Yesterday、Tomorrow、Last Saturday、Right now）就是选择时态的钥匙。" : "对照下面的正确答案，再读一遍短文里的时间词。";
    // append per-blank explains for wrong ones
    if (!allOk) {
      explain = it.blanks.filter(function (b) {
        return !quizState.results[it.id + "-" + b.num].ok;
      }).map(function (b) {
        return "第 " + b.num + " 空：" + b.explain;
      }).join(" ");
    }
    showFeedback(allOk, msg, explain);
  }

  function nextQuestion() {
    if (!quizState) return;
    if (quizState.index >= quizState.items.length - 1) {
      quizState.finished = true;
      renderLesson(quizState.section, "quiz");
      return;
    }
    quizState.index += 1;
    quizState.locked = false;
    renderLesson(quizState.section, "quiz");
    var input = $("#fill-input") || $(".cloze-gap");
    if (input) input.focus();
  }

  function scoreableResults() {
    var out = [];
    if (!quizState) return out;
    var keys = Object.keys(quizState.results);
    keys.forEach(function (k) {
      var r = quizState.results[k];
      if (r.skipScore) return;
      out.push({ id: k, result: r });
    });
    return out;
  }

  function renderScore() {
    var rows = scoreableResults();
    var total = rows.length;
    var right = 0;
    rows.forEach(function (r) { if (r.result.ok) right++; });
    var pct = total ? Math.round((right / total) * 100) : 0;
    var msg = pct === 100 ? "全部正确，太厉害了！" : pct >= 80 ? "很棒，再把错题看一遍就会更稳。" : pct >= 60 ? "已经掌握一大半了，错题多练几遍。" : "先回到讲解和时间词，再来挑战一次。";
    var emoji = pct === 100 ? "🌟" : pct >= 80 ? "🎉" : pct >= 60 ? "💪" : "📘";
    var color = quizState.section;
    var size = 140, r0 = 58, c0 = 2 * Math.PI * r0;
    var dash = (pct / 100) * c0;
    var wrong = rows.filter(function (r) { return !r.result.ok; });

    var review = "";
    if (wrong.length) {
      review = "<h3 style='text-align:left;margin-top:8px'>错题回顾</h3>";
      wrong.forEach(function (w) {
        var item = null;
        quizState.items.forEach(function (it) { if (it.id === w.id) item = it; });
        var stem = w.result.stem || (item && (item.stem || item.prompt || item.title)) || w.id;
        var explain = w.result.explain || (item && item.explain) || "";
        var correct = w.result.correct;
        if (item) correct = answersOf(item).join("  /  ");
        else if (w.result.correct) correct = w.result.correct;
        review +=
          '<div class="review-item">' +
            '<div class="q">' + esc(stem) + "</div>" +
            '<div class="you">你的作答：' + esc(w.result.user || "（未作答）") + "</div>" +
            '<div class="ok">正确答案：' + esc(correct) + "</div>" +
            (explain ? '<div class="ex">' + esc(explain) + "</div>" : "") +
          "</div>";
      });
    } else {
      review = "<p>没有错题。四个时态的时间词你都抓住了！</p>";
    }

    var wrongIds = wrong.map(function (w) {
      // for cloze blanks, retry the whole cloze
      return w.id.indexOf("cz") === 0 ? w.id.split("-")[0] : w.id;
    }).filter(function (id, idx, arr) { return arr.indexOf(id) === idx; });

    return (
      '<div class="panel score-card">' +
        '<div class="celebrate">' + emoji + "</div>" +
        '<svg class="score-ring" viewBox="0 0 140 140" aria-hidden="true">' +
          '<circle cx="70" cy="70" r="' + r0 + '" fill="none" stroke="#efe4d4" stroke-width="12"/>' +
          '<circle cx="70" cy="70" r="' + r0 + '" fill="none" stroke="currentColor" class="fg-' + color + '" stroke-width="12" stroke-linecap="round" transform="rotate(-90 70 70)" stroke-dasharray="' + dash + " " + c0 + '"/>' +
          '<text x="70" y="76" text-anchor="middle" font-size="28" font-weight="800" fill="#2A2744" font-family="system-ui,sans-serif">' + pct + "%</text>" +
        "</svg>" +
        '<p class="score-num">' + right + " / " + total + "</p>" +
        '<p class="score-sub">' + esc(msg) + "</p>" +
        '<div class="actions" style="justify-content:center">' +
          '<button class="btn btn-primary" type="button" data-action="retry">再练一次（重新打乱）</button>' +
          (wrong.length ? '<button class="btn btn-ghost" type="button" data-action="retry-wrong">只做错题</button>' : "") +
          '<button class="btn btn-soft" type="button" data-go="home">返回首页</button>' +
        "</div>" +
        '<div style="margin-top:18px">' + review + "</div>" +
      "</div>"
    );
  }

  /* ---------- Events ---------- */
  root.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== root && !t.getAttribute("data-go") && !t.getAttribute("data-action")) t = t.parentNode;
    if (!t || t === root) return;
    var goTo = t.getAttribute("data-go");
    if (goTo) {
      e.preventDefault();
      if (goTo === "home") quizState = null;
      go(goTo);
      return;
    }
    var action = t.getAttribute("data-action");
    if (!action) return;
    e.preventDefault();
    if (action === "start-quiz") {
      startQuiz(t.getAttribute("data-section"));
      renderLesson(quizState.section, "quiz");
    } else if (action === "pick") {
      if (quizState && quizState.locked) return;
      var opts = root.querySelectorAll(".opt");
      for (var i = 0; i < opts.length; i++) opts[i].classList.remove("is-picked");
      t.classList.add("is-picked");
      submitCurrent();
    } else if (action === "submit") {
      submitCurrent();
    } else if (action === "next") {
      nextQuestion();
    } else if (action === "retry") {
      var sec = quizState ? quizState.section : "present";
      startQuiz(sec);
      renderLesson(sec, "quiz");
    } else if (action === "retry-wrong") {
      var sec2 = quizState ? quizState.section : "present";
      var ids = [];
      scoreableResults().forEach(function (w) {
        if (!w.result.ok) {
          var id = w.id.indexOf("cz") === 0 ? w.id.split("-")[0] : w.id;
          if (ids.indexOf(id) === -1) ids.push(id);
        }
      });
      startQuiz(sec2, ids);
      renderLesson(sec2, "quiz");
    } else if (action === "chip") {
      if (quizState && quizState.locked) return;
      var bank = $("#order-bank");
      var slots = $("#order-slots");
      if (!bank || !slots) return;
      if (t.parentNode === bank) {
        t.classList.add("in-slot");
        slots.appendChild(t);
      } else {
        t.classList.remove("in-slot");
        bank.appendChild(t);
      }
    }
  });

  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var el = e.target;
    if (el && (el.id === "fill-input" || (el.className && el.className.indexOf("cloze-gap") !== -1))) {
      e.preventDefault();
      submitCurrent();
    }
  });

  function route() {
    var parts = hashParts();
    var page = parts[0] || "home";
    if (page === "home" || page === "") {
      quizState = null;
      renderHome();
      window.scrollTo(0, 0);
      return;
    }
    if (sectionById(page)) {
      var tab = parts[1] || "timeline";
      // If leaving quiz mid-way to another tab, keep state; switching section resets
      if (quizState && quizState.section !== page) quizState = null;
      renderLesson(page, tab);
      window.scrollTo(0, 0);
      return;
    }
    renderHome();
  }

  window.addEventListener("hashchange", route);
  route();

  // Expose a tiny hook for headless tests
  window.__TENSES_APP__ = {
    counts: function () {
      return {
        present: (DATA.quizzes.present || []).length,
        continuous: (DATA.quizzes.continuous || []).length,
        past: (DATA.quizzes.past || []).length,
        future: (DATA.quizzes.future || []).length,
        mixed: (DATA.quizzes.mixed || []).length,
        clozePassages: (DATA.cloze || []).length,
        clozeBlanks: (DATA.cloze || []).reduce(function (n, c) { return n + c.blanks.length; }, 0)
      };
    },
    isCorrect: isCorrect,
    data: DATA
  };
})();
