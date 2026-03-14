// ===== CW案件チェッカー — 分析エンジン v2 =====

// --- 利用回数管理 ---
const STORAGE_KEY = "cw_checker_usage";
const FREE_LIMIT = typeof MEMBER_MODE !== "undefined" && MEMBER_MODE ? Infinity : 5;

function getUsage() {
    try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        const today = new Date().toISOString().slice(0, 7);
        if (d.month !== today) return { month: today, count: 0 };
        return d;
    } catch { return { month: new Date().toISOString().slice(0, 7), count: 0 }; }
}
function saveUsage(u) { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); }
function updateUsageBadge() {
    const badge = document.getElementById("usageBadge");
    if (!badge) return;
    if (FREE_LIMIT === Infinity) { badge.textContent = "講座生専用 ∞"; badge.style.borderColor = "var(--safe)"; return; }
    const u = getUsage();
    const remain = Math.max(0, FREE_LIMIT - u.count);
    document.getElementById("remainCount").textContent = remain;
    if (remain <= 1) badge.style.borderColor = "var(--danger)";
    else if (remain <= 3) badge.style.borderColor = "var(--warn)";
}
function checkUsageLimit() {
    if (FREE_LIMIT === Infinity) return true;
    const u = getUsage();
    if (u.count >= FREE_LIMIT) {
        document.getElementById("limitPopup").style.display = "flex";
        return false;
    }
    u.count++;
    saveUsage(u);
    updateUsageBadge();
    return true;
}
function closePopup() { document.getElementById("limitPopup").style.display = "none"; }

// --- URL解析 ---
function parseUrl(url) {
    url = url.trim();
    const jobMatch = url.match(/crowdworks\.jp\/public\/jobs\/(\d+)/);
    const empMatch = url.match(/crowdworks\.jp\/public\/employers\/(\d+)/);
    if (jobMatch) return { type: "job", id: jobMatch[1], url: `https://crowdworks.jp/public/jobs/${jobMatch[1]}` };
    if (empMatch) return { type: "employer", id: empMatch[1], url: `https://crowdworks.jp/public/employers/${empMatch[1]}` };
    return null;
}

// --- 進捗表示 ---
function showProgress(msg) {
    const el = document.getElementById("progressMsg");
    if (el) el.textContent = msg;
}

// --- CORSプロキシ経由でHTML取得 ---
async function fetchPage(url) {
    const proxies = [
        u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    ];
    for (const proxy of proxies) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch(proxy(url), { signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const text = await resp.text();
                try { const json = JSON.parse(text); if (json.contents) return json.contents; } catch (e) { /* not JSON */ }
                if (text.length > 500) return text;
            }
        } catch (e) { /* proxy failed, try next */ }
    }
    return null;
}

// --- HTMLからデータ抽出 ---
function extractJobData(html) {
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const allText = (doc.body ? doc.body.textContent : "") || "";
        const titleEl = doc.querySelector("h1") || doc.querySelector("title");
        const title = titleEl ? titleEl.textContent.trim() : "";
        const idVerified = !allText.includes("本人確認未提出");
        const orderRule = !allText.includes("発注ルールチェック未回答");
        const reviewMatch = allText.match(/[(（]?(\d+)件のレビュー/);
        const reviews = reviewMatch ? parseInt(reviewMatch[1]) : -1;
        const applicantMatch = allText.match(/応募した人\s*(\d+)/);
        const contractMatch = allText.match(/契約した人\s*(\d+)/);
        const recruitMatch = allText.match(/募集人数\s*(\d+)/);
        const applicants = applicantMatch ? parseInt(applicantMatch[1]) : -1;
        const contracts = contractMatch ? parseInt(contractMatch[1]) : -1;
        const recruitNum = recruitMatch ? parseInt(recruitMatch[1]) : -1;
        const payMatch = allText.match(/([0-9,]+)円\s*[～〜~]\s*([0-9,]+)円/);
        const payLow = payMatch ? parseInt(payMatch[1].replace(/,/g, "")) : -1;
        const payHigh = payMatch ? parseInt(payMatch[2].replace(/,/g, "")) : -1;
        let descText = "";
        try {
            const detailHeaders = doc.querySelectorAll("h2, h3");
            detailHeaders.forEach(h => {
                if (h.textContent && h.textContent.includes("仕事の詳細")) {
                    let el = h.nextElementSibling;
                    while (el && !["H2", "H3"].includes(el.tagName)) { descText += (el.textContent || "") + " "; el = el.nextElementSibling; }
                }
            });
        } catch (e) { /* desc extraction failed */ }
        if (!descText) descText = allText.substring(0, 5000);
        const empLink = (html || "").match(/\/public\/employers\/(\d+)/);
        const employerId = empLink ? empLink[1] : null;
        return { title, idVerified, orderRule, reviews, applicants, contracts, recruitNum, payLow, payHigh, descText, employerId, allText };
    } catch (e) {
        console.warn("extractJobData error:", e);
        return { title: "", idVerified: true, orderRule: true, reviews: -1, applicants: -1, contracts: -1, recruitNum: -1, payLow: -1, payHigh: -1, descText: "", employerId: null, allText: "" };
    }
}

function extractEmployerData(html) {
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const allText = (doc.body ? doc.body.textContent : "") || "";
        const idVerified = !allText.includes("本人確認未提出");
        const orderRule = !allText.includes("発注ルールチェック未回答");
        const reviewMatch = allText.match(/[(（]?(\d+)件のレビュー/);
        const reviews = reviewMatch ? parseInt(reviewMatch[1]) : -1;
        const ratingMatch = allText.match(/総合評価\s*([0-9.]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : -1;
        const recruitCountMatch = allText.match(/募集実績\s*(\d+)/);
        const recruitCount = recruitCountMatch ? parseInt(recruitCountMatch[1]) : -1;
        const regDateMatch = allText.match(/登録日\s*(\d{4})[年/](\d{1,2})[月/](\d{1,2})/);
        let regDate = null;
        if (regDateMatch) {
            try { regDate = new Date(parseInt(regDateMatch[1]), parseInt(regDateMatch[2]) - 1, parseInt(regDateMatch[3])); } catch (e) { regDate = null; }
        }
        const completionMatch = allText.match(/完了数\s*(\d+)\s*[/／]\s*契約数\s*(\d+)/);
        const completed = completionMatch ? parseInt(completionMatch[1]) : -1;
        const contracted = completionMatch ? parseInt(completionMatch[2]) : -1;
        const hasOverview = !allText.includes("概要が登録されていません");
        return { idVerified, orderRule, reviews, rating, recruitCount, regDate, completed, contracted, hasOverview, allText };
    } catch (e) {
        console.warn("extractEmployerData error:", e);
        return { idVerified: true, orderRule: true, reviews: -1, rating: -1, recruitCount: -1, regDate: null, completed: -1, contracted: -1, hasOverview: true, allText: "" };
    }
}

// --- データマージ ---
function mergeData(jobData, empData) {
    const d = {};
    // Job data first
    Object.keys(jobData).forEach(k => { d[k] = jobData[k]; });
    // Employer-only fields always from empData
    ["regDate", "recruitCount", "completed", "contracted", "hasOverview", "rating"].forEach(k => { d[k] = empData[k]; });
    // Shared fields: prefer actual extracted data over defaults
    ["idVerified", "orderRule", "reviews"].forEach(k => {
        const jv = jobData[k], ev = empData[k];
        // idVerified/orderRule: false means detected = real data
        if (k === "idVerified" || k === "orderRule") { d[k] = jv === false || ev === false ? false : true; }
        else { d[k] = (jv !== -1) ? jv : ev; } // reviews: prefer non-default
    });
    d.allText = (jobData.allText || "") + " " + (empData.allText || "");
    d.descText = jobData.descText || "";
    return d;
}

// --- スコアリングエンジン v2（全チェック項目を記録） ---
function scoreAnalysis(jobData, empData, urlInfo) {
    const results = {};
    SCAM_DB.categories.forEach(c => { results[c.id] = { score: 0, max: 0, checks: [] }; });
    const d = mergeData(jobData, empData);

    // ===== 1. クライアント信頼性 =====
    const t = results.trust; t.max = 30;
    t.checks.push({ label: "本人確認", pass: d.idVerified, pts: d.idVerified ? 0 : 10, detail: d.idVerified ? "提出済み" : "未提出" });
    t.checks.push({ label: "発注ルールチェック", pass: d.orderRule, pts: d.orderRule ? 0 : 8, detail: d.orderRule ? "回答済み" : "未回答" });
    if (d.reviews >= 0) {
        const revOk = d.reviews >= 3;
        t.checks.push({ label: "レビュー件数", pass: revOk, pts: d.reviews === 0 ? 8 : d.reviews < 3 ? 4 : 0, detail: d.reviews + "件" });
    }
    if (d.rating >= 0) {
        const ratOk = d.rating >= 3;
        t.checks.push({ label: "総合評価", pass: ratOk, pts: ratOk ? 0 : 4, detail: d.rating > 0 ? d.rating + "点" : "評価なし" });
    }
    t.checks.forEach(c => { t.score += c.pts; });

    // ===== 2. アカウント履歴 =====
    const h = results.history; h.max = 35;
    if (d.regDate) {
        const days = Math.floor((new Date() - d.regDate) / 86400000);
        const regOk = days >= 90;
        h.checks.push({ label: "登録日", pass: regOk, pts: days < 14 ? 12 : days < 30 ? 10 : days < 90 ? 6 : days < 180 ? 2 : 0, detail: days + "日前に登録" });
    }
    if (d.recruitCount >= 0) {
        const recOk = d.recruitCount >= 5;
        h.checks.push({ label: "募集実績", pass: recOk, pts: d.recruitCount <= 1 ? 8 : d.recruitCount <= 3 ? 4 : 0, detail: d.recruitCount + "件" });
    }
    if (d.completed >= 0 || d.contracted >= 0) {
        const compOk = d.contracted > 0 && d.completed / d.contracted >= 0.5;
        const pts = (d.completed === 0 && d.contracted === 0) ? 10 : (!compOk ? 5 : 0);
        h.checks.push({ label: "プロジェクト完了", pass: compOk, pts, detail: `完了${d.completed >= 0 ? d.completed : "?"} / 契約${d.contracted >= 0 ? d.contracted : "?"}` });
    }
    if (d.hasOverview !== undefined) {
        h.checks.push({ label: "会社概要", pass: d.hasOverview, pts: d.hasOverview ? 0 : 5, detail: d.hasOverview ? "登録あり" : "未登録" });
    }
    // フォールバック: クライアントページが取得できなかった場合、案件ページの情報から推定
    if (h.checks.length === 0) {
        // 案件ページのレビュー0件 + 本人確認未提出 なら新しい怪しいアカウントと推定
        if (d.reviews === 0 && !d.idVerified) {
            h.checks.push({ label: "アカウント実績", pass: false, pts: 15, detail: "レビュー0件+未認証（新規アカウントの可能性大）" });
        } else if (d.reviews === 0) {
            h.checks.push({ label: "アカウント実績", pass: false, pts: 10, detail: "レビュー0件（実績不明）" });
        } else {
            h.checks.push({ label: "クライアント詳細", pass: true, pts: 0, detail: "詳細ページ未取得" });
        }
    }
    h.checks.forEach(c => { h.score += c.pts; });

    // ===== 3. 案件内容 =====
    const cn = results.content; cn.max = 30;
    const title = d.title || "";
    SCAM_DB.suspiciousTitlePatterns.forEach(p => {
        const hit = p.pattern.test(title);
        cn.checks.push({ label: p.label, pass: !hit, pts: hit ? p.weight : 0, detail: hit ? "該当" : "非該当" });
    });
    if (d.payHigh > 0) {
        const highPayBait = d.payHigh >= 50000 && /未経験|初心者|簡単|スキル不要/.test(title + " " + d.descText);
        cn.checks.push({ label: "高額+未経験OK", pass: !highPayBait, pts: highPayBait ? 8 : 0, detail: highPayBait ? `${d.payHigh.toLocaleString()}円 × 未経験OK` : "該当なし" });
    }
    if (d.recruitNum > 0) {
        const mass = d.recruitNum >= 10;
        cn.checks.push({ label: "大量募集", pass: !mass, pts: mass ? 5 : 0, detail: d.recruitNum + "人募集" });
    }
    cn.checks.forEach(c => { cn.score += c.pts; });

    // ===== 4. 危険キーワード =====
    const kw = results.keywords; kw.max = 50;
    const searchText = (d.descText || "") + " " + (d.allText || "");
    SCAM_DB.dangerKeywords.forEach(k => {
        const found = k.words.some(w => searchText.includes(w));
        kw.checks.push({ label: k.label, pass: !found, pts: found ? k.weight : 0, detail: found ? "検出" : "—" });
    });
    kw.checks.forEach(c => { kw.score += c.pts; });

    // ===== 5. 応募状況 =====
    const st = results.stats; st.max = 25;
    if (d.applicants >= 0 && d.contracts >= 0) {
        const ratio = d.applicants > 0 && d.contracts === 0;
        let pts = 0;
        if (ratio && d.applicants > 80) pts = 12;
        else if (ratio && d.applicants > 30) pts = 8;
        else if (ratio && d.applicants > 10) pts = 5;
        else if (ratio) pts = 3;
        st.checks.push({ label: "応募/契約バランス", pass: !ratio, pts, detail: `応募${d.applicants}人 / 契約${d.contracts}人` });
    }
    if (d.applicants > 100) {
        st.checks.push({ label: "応募過多", pass: false, pts: 5, detail: `${d.applicants}人（異常な応募数）` });
    }
    st.checks.forEach(c => { st.score += c.pts; });

    // ===== 6. 既知DB照合 =====
    const db = results.database; db.max = 10;
    const inputNorm = urlInfo.url.replace(/https?:\/\//, "").replace(/\?.*$/, "");
    let dbMatch = null;
    SCAM_DB.knownUrls.forEach(entry => {
        const entryNorm = entry.url.replace(/\?.*$/, "");
        if (inputNorm.includes(entryNorm) || entryNorm.includes(inputNorm)) dbMatch = entry;
    });
    if (!dbMatch && d.employerId) {
        SCAM_DB.knownUrls.forEach(entry => {
            if (entry.type === "employer" && entry.url.includes(d.employerId)) dbMatch = entry;
        });
    }
    if (dbMatch) {
        db.checks.push({ label: "詐欺報告DB", pass: false, pts: 10, detail: dbMatch.note });
    } else {
        db.checks.push({ label: "詐欺報告DB", pass: true, pts: 0, detail: "一致なし" });
    }
    db.checks.forEach(c => { db.score += c.pts; });

    return { results, dbMatch };
}

function calcOverallScore(results) {
    let weighted = 0;
    SCAM_DB.categories.forEach(cat => {
        const s = results[cat.id];
        const catPct = s.max > 0 ? Math.min(s.score / s.max, 1) : 0;
        weighted += catPct * cat.weight;
    });
    return Math.round(weighted * 100);
}

// --- UI描画 v2 ---
function renderResult(overall, results, dbMatch) {
    const section = document.getElementById("resultSection");
    section.style.display = "block";
    section.scrollIntoView({ behavior: "smooth", block: "start" });

    // ゲージ
    const gauge = document.getElementById("gaugeFill");
    const circumference = 2 * Math.PI * 85;
    const offset = circumference - (overall / 100) * circumference;
    let color = "var(--safe)";
    if (overall >= 60) color = "var(--danger)";
    else if (overall >= 30) color = "var(--warn)";
    setTimeout(() => { gauge.style.strokeDashoffset = offset; gauge.style.stroke = color; }, 100);

    // カウントアップ
    const valEl = document.getElementById("scoreValue");
    let cur = 0;
    const step = Math.max(1, Math.floor(overall / 30));
    const timer = setInterval(() => {
        cur += step;
        if (cur >= overall) { cur = overall; clearInterval(timer); }
        valEl.textContent = cur;
        valEl.style.color = overall >= 60 ? "var(--danger)" : overall >= 30 ? "var(--warn)" : "var(--safe)";
    }, 30);

    // 判定ラベル
    const verdict = document.getElementById("scoreVerdict");
    const comment = document.getElementById("scoreComment");
    if (overall >= 70) { verdict.textContent = "🚨 危険"; verdict.className = "score-verdict verdict-danger"; comment.textContent = "この案件は過去の詐欺パターンに多数該当しています。応募は控えることを強く推奨します。"; }
    else if (overall >= 50) { verdict.textContent = "⚠️ 要注意"; verdict.className = "score-verdict verdict-danger"; comment.textContent = "複数の危険なシグナルが検出されました。慎重に判断してください。"; }
    else if (overall >= 30) { verdict.textContent = "⚡ 注意"; verdict.className = "score-verdict verdict-warn"; comment.textContent = "いくつか気になる点があります。案件内容をよく確認した上で判断してください。"; }
    else { verdict.textContent = "✅ 比較的安全"; verdict.className = "score-verdict verdict-safe"; comment.textContent = "大きな危険シグナルは検出されませんでした。ただし直接のやりとりで異変を感じたら注意してください。"; }

    // カテゴリ別（展開式にチェック項目を表示）
    const grid = document.getElementById("categoriesGrid");
    grid.innerHTML = "";
    SCAM_DB.categories.forEach(cat => {
        const s = results[cat.id];
        const pct = s.max > 0 ? Math.min(s.score / s.max, 1) : 0;
        let badge, cls;
        if (pct >= 0.5) { badge = "✕ 危険"; cls = "badge-danger"; }
        else if (pct >= 0.25) { badge = "△ 注意"; cls = "badge-warn"; }
        else { badge = "◎ 安全"; cls = "badge-safe"; }

        // チェック項目HTML
        let checksHtml = s.checks.map(c => {
            const icon = c.pass ? "✅" : "❌";
            const ptText = c.pts > 0 ? `<span class="check-pts">+${c.pts}pt</span>` : "";
            return `<div class="check-row ${c.pass ? "" : "check-fail"}">${icon} <span class="check-label">${c.label}</span><span class="check-detail">${c.detail}</span>${ptText}</div>`;
        }).join("");

        grid.innerHTML += `
        <div class="cat-card" onclick="this.classList.toggle('expanded')">
            <div class="cat-icon">${cat.icon}</div>
            <div class="cat-name">${cat.name}</div>
            <div class="cat-badge ${cls}">${badge}</div>
            <div class="cat-score">${s.score} / ${s.max} pt</div>
            <div class="cat-expand-hint">▼ 詳細を見る</div>
            <div class="cat-checks">${checksHtml}</div>
        </div>`;
    });

    // 全フラグ
    const allFlags = [];
    SCAM_DB.categories.forEach(cat => {
        results[cat.id].checks.forEach(c => { if (!c.pass && c.pts > 0) allFlags.push(c.label + ": " + c.detail); });
    });
    const flagsCard = document.getElementById("flagsCard");
    const flagsList = document.getElementById("flagsList");
    if (allFlags.length > 0) {
        flagsCard.style.display = "block";
        flagsList.innerHTML = allFlags.map(f => `<div class="flag-item"><span class="flag-icon">🔸</span><span class="flag-text">${f}</span></div>`).join("");
    } else { flagsCard.style.display = "none"; }

    // 既知DB
    const knownCard = document.getElementById("knownCard");
    if (dbMatch) { knownCard.style.display = "block"; document.getElementById("knownDesc").textContent = `報告内容: ${dbMatch.note}`; }
    else { knownCard.style.display = "none"; }

    // 進行パターン警告チェックリスト
    renderProgressionWarnings(results, overall);
}

// --- 進行パターン警告チェックリスト ---
function renderProgressionWarnings(results, overall) {
    const container = document.getElementById("progressionCard");
    if (!container) return;

    // スコアが10%未満（ほぼ安全）なら表示しない
    if (overall < 10) { container.style.display = "none"; return; }

    // 検出されたフラグのラベル一覧
    const detectedLabels = [];
    SCAM_DB.categories.forEach(cat => {
        results[cat.id].checks.forEach(c => {
            if (!c.pass && c.pts > 0) detectedLabels.push(c.label);
        });
    });

    // キーワード検出のラベルも含める
    if (results.keywords) {
        results.keywords.checks.forEach(c => {
            if (!c.pass) detectedLabels.push(c.label);
        });
    }

    let html = "";

    // ステージ別警告
    SCAM_DB.progressionWarnings.forEach(stage => {
        let itemsHtml = "";
        stage.items.forEach(item => {
            const isTriggered = item.trigger.length > 0 && item.trigger.some(t => detectedLabels.some(l => l.includes(t) || t.includes(l)));
            const sevClass = item.severity === "critical" ? "warn-critical" : item.severity === "high" ? "warn-high" : "warn-mid";
            const triggerTag = isTriggered ? `<span class="warn-triggered">⚠️ この案件で特に注意</span>` : "";
            itemsHtml += `<div class="warn-item ${sevClass} ${isTriggered ? "warn-matched" : ""}">
                <span class="warn-checkbox">☐</span>
                <span class="warn-text">${item.text}</span>
                ${triggerTag}
            </div>`;
        });

        html += `<div class="warn-stage">
            <div class="warn-stage-header">
                <span class="warn-stage-icon">${stage.icon}</span>
                <span class="warn-stage-name">${stage.stage}</span>
            </div>
            ${itemsHtml}
        </div>`;
    });

    // 基本注意事項
    let tipsHtml = SCAM_DB.generalTips.map(t => `<div class="tip-item">💡 ${t}</div>`).join("");

    container.innerHTML = `
        <h3 class="progression-title">📋 やりとり進行チェックリスト</h3>
        <p class="progression-desc">応募後、以下のようなことがあれば詐欺案件の可能性が高まります。<br>チェックリストとして使って、該当したら即辞退を検討してください。</p>
        ${html}
        <div class="tips-section">
            <h4 class="tips-title">🔒 基本の安全ルール</h4>
            ${tipsHtml}
        </div>
    `;
    container.style.display = "block";
}

// --- メイン実行 ---
async function startCheck() {
    const input = document.getElementById("urlInput").value;
    const urlInfo = parseUrl(input);
    if (!urlInfo) { alert("CrowdWorksの案件URL（/jobs/...）またはクライアントURL（/employers/...）を入力してください。"); return; }
    if (!checkUsageLimit()) return;

    const btn = document.getElementById("checkBtn");
    const btnText = btn.querySelector(".btn-text");
    const btnLoader = btn.querySelector(".btn-loader");
    btn.disabled = true; btnText.textContent = "分析中..."; btnLoader.style.display = "inline-block";
    document.getElementById("resultSection").style.display = "none";
    showProgress("ページデータを取得中...");

    try {
        let jobData = { title: "", idVerified: true, orderRule: true, reviews: -1, applicants: -1, contracts: -1, recruitNum: -1, payLow: -1, payHigh: -1, descText: "", employerId: null, allText: "" };
        let empData = { idVerified: true, orderRule: true, reviews: -1, rating: -1, recruitCount: -1, regDate: null, completed: -1, contracted: -1, hasOverview: true, allText: "" };

        if (urlInfo.type === "job") {
            // ステップ1: 案件ページ取得
            showProgress("📄 案件ページを取得中...");
            const html = await fetchPage(urlInfo.url);
            if (html) {
                jobData = extractJobData(html);
                // ステップ2: クライアントページを並列取得
                if (jobData.employerId) {
                    showProgress("👤 クライアント情報を取得中...");
                    const empHtml = await fetchPage(`https://crowdworks.jp/public/employers/${jobData.employerId}`);
                    if (empHtml) empData = extractEmployerData(empHtml);
                }
            }
        } else {
            showProgress("👤 クライアント情報を取得中...");
            const empHtml = await fetchPage(urlInfo.url);
            if (empHtml) empData = extractEmployerData(empHtml);
        }

        showProgress("🔍 分析中...");
        const { results, dbMatch } = scoreAnalysis(jobData, empData, urlInfo);
        let overall = calcOverallScore(results);
        if (dbMatch) overall = Math.max(overall, 85);
        showProgress("");
        renderResult(overall, results, dbMatch);

    } catch (err) {
        console.error("startCheck error:", err);
        showProgress("");
        alert("分析中にエラーが発生しました。\n\n考えられる原因:\n• インターネット接続を確認してください\n• URLが正しいか確認してください\n• 時間をおいて再度お試しください");
    } finally {
        try { btn.disabled = false; btnText.textContent = "チェック"; btnLoader.style.display = "none"; } catch (e) { }
    }
}

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
    updateUsageBadge();
    document.getElementById("urlInput").addEventListener("keydown", e => { if (e.key === "Enter") startCheck(); });
});
