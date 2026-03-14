// ===== CW案件チェッカー — 詐欺データベース =====

const SCAM_DB = {
  // 過去に報告された既知の詐欺URL（案件・クライアント・ワーカー）
  knownUrls: [
    { url: "crowdworks.jp/public/jobs/12968336", type: "job", note: "Instagram運用装い→LINE誘導→プラン契約要求" },
    { url: "crowdworks.jp/public/jobs/12917736", type: "job", note: "3時間面談→スクール勧誘(S+)、架空の講座" },
    { url: "crowdworks.jp/public/jobs/12880740", type: "job", note: "LINE誘導、海外在住トップ" },
    { url: "crowdworks.jp/public/jobs/12867466", type: "job", note: "Canva動画作成案件、内容不透明" },
    { url: "crowdworks.jp/public/jobs/12735680", type: "job", note: "LINE追加→フリーランス勧誘" },
    { url: "crowdworks.jp/public/jobs/12738164", type: "job", note: "LINE追加→フリーランス勧誘" },
    { url: "crowdworks.jp/public/jobs/12654494", type: "job", note: "量産型募集、面談で私情深掘り→スクール勧誘" },
    { url: "crowdworks.jp/public/jobs/12646868", type: "job", note: "動画編集者募集→SNS運用代行スクール勧誘" },
    { url: "crowdworks.jp/public/jobs/12586026", type: "job", note: "初対面で外部やりとり誘導" },
    { url: "crowdworks.jp/public/jobs/12512532", type: "job", note: "LINE誘導→1時間面談→スクール勧誘" },
    { url: "crowdworks.jp/public/jobs/12511200", type: "job", note: "アクセラ社マーケコネクト営業" },
    { url: "crowdworks.jp/public/jobs/12489821", type: "job", note: "2時間面談→フリーランス勧誘→LINE交換" },
    { url: "crowdworks.jp/public/jobs/12279932", type: "job", note: "コミュニティ勧誘グループの案件" },
    { url: "crowdworks.jp/public/jobs/12101980", type: "job", note: "ショート動画→営業代行勧誘、海外代表" },
    { url: "crowdworks.jp/public/jobs/12054716", type: "job", note: "ねずみ講構造のコミュニティ勧誘" },
    { url: "crowdworks.jp/public/jobs/11981357", type: "job", note: "CW外個別契約誘導、不利な契約書" },
    { url: "crowdworks.jp/public/jobs/11933812", type: "job", note: "Canva体験会→90分スクール勧誘" },
    { url: "crowdworks.jp/public/jobs/11923376", type: "job", note: "キャリアコーチング営業、ビデオオフ面談" },
    { url: "crowdworks.jp/public/jobs/11884501", type: "job", note: "タイムレックス予約→Canva体験会勧誘" },
    { url: "crowdworks.jp/public/jobs/11881559", type: "job", note: "詐欺報告あり" },
    { url: "crowdworks.jp/public/jobs/11850644", type: "job", note: "面談に別人登場→LINE交換→セミナー勧誘" },
    { url: "crowdworks.jp/public/jobs/11849994", type: "job", note: "詐欺報告あり" },
    { url: "crowdworks.jp/public/jobs/11845466", type: "job", note: "詐欺報告あり" },
    { url: "crowdworks.jp/public/employers/6853578", type: "employer", note: "dohs4653 - Instagram案件で勧誘" },
    { url: "crowdworks.jp/public/employers/6537062", type: "employer", note: "アクセラ社マーケコネクト営業" },
    { url: "crowdworks.jp/public/employers/6382670", type: "employer", note: "詐欺報告クライアント" },
    { url: "crowdworks.jp/public/employers/6251446", type: "employer", note: "詐欺報告クライアント" },
    { url: "crowdworks.jp/public/employers/6202217", type: "employer", note: "コミュニティ勧誘グループ" },
    { url: "crowdworks.jp/public/employers/6105684", type: "employer", note: "トライアル→コミュニティ勧誘の窓口" },
    { url: "crowdworks.jp/public/employers/6069729", type: "employer", note: "不動産売り子募集→ねずみ講" },
    { url: "crowdworks.jp/public/employers/6005402", type: "employer", note: "トライアル→海外リーダー→コンテンツ販売勧誘" },
    { url: "crowdworks.jp/public/employers/4859127", type: "employer", note: "仮払い未対応トライアル" },
    { url: "crowdworks.jp/public/employers/4858972", type: "employer", note: "仮払い未対応グループ" },
    { url: "crowdworks.jp/public/employers/4665316", type: "employer", note: "募集1500件に対して評価18件" },
    { url: "crowdworks.jp/public/employers/4245483", type: "employer", note: "コミュニティ勧誘グループ" },
    { url: "crowdworks.jp/public/employers/2582201", type: "employer", note: "詐欺報告クライアント" },
    { url: "crowdworks.jp/public/employees/6195854", type: "worker", note: "コミュニティ勧誘関連ワーカー" },
    { url: "crowdworks.jp/public/employees/4887767", type: "worker", note: "コミュニティ勧誘関連ワーカー" },
    { url: "crowdworks.jp/public/users/6377333", type: "user", note: "ドタキャン常習クライアント" },
  ],

  // 危険キーワード（案件説明文から検出）
  dangerKeywords: [
    { words: ["LINE", "ライン", "公式LINE", "LINE交換", "LINEで"], weight: 8, label: "LINE誘導の可能性" },
    { words: ["chatwork", "チャットワーク", "Chatwork"], weight: 6, label: "外部ツール誘導" },
    { words: ["コミュニティ", "入会", "入籍", "チーム参加"], weight: 9, label: "コミュニティ勧誘の可能性" },
    { words: ["スクール", "講座", "体験会", "セミナー"], weight: 8, label: "スクール/セミナー勧誘" },
    { words: ["自分のアカウント", "自身のアカウント", "アカウントを作成", "アカウント運用"], weight: 7, label: "自己アカウント運用要求" },
    { words: ["フリーランス", "独立", "起業"], weight: 5, label: "フリーランス勧誘の可能性" },
    { words: ["コンテンツ販売", "情報商材", "商材"], weight: 8, label: "コンテンツ販売/情報商材" },
    { words: ["成果報酬", "出来高", "成約報酬"], weight: 4, label: "成果報酬型（リスクあり）" },
    { words: ["契約金", "初期費用", "入会金", "参加費", "プラン"], weight: 10, label: "費用要求の可能性" },
    { words: ["面談", "zoom面談", "Zoom面談", "オンライン面談", "Google Meet"], weight: 3, label: "面談あり（内容に注意）" },
    { words: ["ドバイ", "マレーシア", "海外在住", "海外"], weight: 6, label: "海外拠点（勧誘パターン）" },
    { words: ["クラウドワークス外", "直接契約", "個別契約", "外部で"], weight: 8, label: "CW外契約誘導" },
    { words: ["マーケティング", "マーケター"], weight: 3, label: "マーケター勧誘の兆候" },
    { words: ["不動産", "投資", "FX", "仮想通貨", "暗号資産"], weight: 9, label: "投資/不動産系の勧誘" },
  ],

  // 怪しいタイトルパターン
  suspiciousTitlePatterns: [
    { pattern: /未経験.*OK/i, weight: 3, label: "未経験OK（釣りの可能性）" },
    { pattern: /在宅.*簡単|簡単.*在宅/i, weight: 4, label: "簡単在宅ワーク（誇大表現）" },
    { pattern: /月[0-9０-９]+万/i, weight: 4, label: "高額報酬の訴求" },
    { pattern: /サポート|アシスタント/i, weight: 2, label: "サポート系（内容確認推奨）" },
    { pattern: /Instagram.*運用|SNS.*運用/i, weight: 2, label: "SNS運用案件（勧誘多発カテゴリ）" },
  ],

  // 6つの判定カテゴリ定義
  categories: [
    { id: "trust", name: "クライアント信頼性", icon: "👤", weight: 0.30 },
    { id: "history", name: "アカウント履歴", icon: "📅", weight: 0.20 },
    { id: "content", name: "案件内容", icon: "📝", weight: 0.15 },
    { id: "keywords", name: "危険キーワード", icon: "🔍", weight: 0.10 },
    { id: "stats", name: "応募状況", icon: "📊", weight: 0.15 },
    { id: "database", name: "既知DB照合", icon: "🗃️", weight: 0.10 },
  ],

  // 進行パターン警告チェックリスト（案件に応募した後に段階的に現れる危険サイン）
  progressionWarnings: [
    {
      stage: "応募直後",
      icon: "📩",
      items: [
        { text: "CrowdWorks内のメッセージではなくLINEやChatworkへの移行を求められる", trigger: ["LINE誘導", "外部ツール誘導", "CW外契約誘導"], severity: "high" },
        { text: "すぐに「ビデオ通話で面談しましょう」と言ってくる（仕事の詳細説明ではなくまず面談）", trigger: ["面談"], severity: "mid" },
        { text: "クラウドワークス上で仮払いせずに作業を依頼しようとする", trigger: ["仮払いなし"], severity: "high" },
        { text: "外部サイト（TimeLex等）で面談予約をさせようとする", trigger: [], severity: "mid" },
      ]
    },
    {
      stage: "面談・ヒアリング中",
      icon: "🎥",
      items: [
        { text: "面談が1時間以上かかり、仕事の話より個人の状況（年収・将来の不安・現在の仕事への不満）を深掘りされる", trigger: ["面談"], severity: "high" },
        { text: "面談に「先輩」「リーダー」「講師」など案件と無関係の第三者が同席してくる", trigger: ["コミュニティ勧誘", "スクール/セミナー勧誘"], severity: "high" },
        { text: "「ドバイ」「マレーシア」などの海外在住メンバーが登場する", trigger: ["海外拠点"], severity: "mid" },
        { text: "募集内容と異なる仕事（営業代行・コンテンツ販売・SNSアカウント運用）を提案される", trigger: ["自己アカウント運用要求", "コンテンツ販売/情報商材", "マーケター勧誘"], severity: "high" },
        { text: "「まず体験してみませんか?」とCanva講座やSNS運用の「体験会」に誘導される", trigger: ["スクール/セミナー勧誘"], severity: "high" },
      ]
    },
    {
      stage: "契約・勧誘フェーズ",
      icon: "💰",
      items: [
        { text: "「スクール」「コミュニティ」「チーム」への入会を勧められ、入会金・月額費用を求められる", trigger: ["コミュニティ勧誘", "スクール/セミナー勧誘", "費用要求"], severity: "critical" },
        { text: "「特別に今日だけ割引」「枠が残り少ない」と緊急性を煽ってくる", trigger: [], severity: "critical" },
        { text: "クラウドワークスを通さない直接契約・個別契約書を結ばせようとする", trigger: ["CW外契約誘導"], severity: "high" },
        { text: "「友達を紹介したら報酬」というねずみ講的な仕組みを提示される", trigger: ["コミュニティ勧誘"], severity: "critical" },
        { text: "自分名義のSNSアカウントを作成・運用させられ、自分の友人にDMを送るよう求められる", trigger: ["自己アカウント運用要求"], severity: "high" },
        { text: "「フリーランスとして独立できる」「月○万円稼げる」と根拠なく高収入を約束される", trigger: ["フリーランス勧誘", "高額報酬"], severity: "high" },
      ]
    },
  ],

  // 全案件共通の基本注意事項（スコアに関わらず常に表示）
  generalTips: [
    "仮払い前に作業を開始しないでください",
    "クラウドワークス外での契約・支払いはルール違反です",
    "面談で仕事内容と関係ない個人情報を聞かれたら警戒してください",
    "「入会金」「参加費」等を求められたら即お断りを",
    "不安な場合はクラウドワークスの事務局に通報してください",
  ],
};
