from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

TOKEN = Path.home() / '.hermes' / 'google_token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

WORKBOOKS = {
    'cs': '1KFRLdsT2-LlhSA0YLkXuV3Oh76yxnhL_6tvmOdvv4yg',
    'exec': '1pnEWHFdGHY6Er3aAXuvAz-H1MwgQcvrEZq_Z5oqdwuY',
    'concierge': '1c-Ie03M619iMqhwqV1jHPSYDVPTMHPPKs6zhSr8QPr8',
    'sales': '1i5uxVG9IUu0PTPSy9MqWMHcmNDNk3LDJwZo7nqT_Xao',
    'coaches': '19jpwf97PwDj93bVB3WJdhXhtT-vo8YmNGA6T0eEigUc',
    'db': '1sJuEM1RXn5zVeBj6dVTujnf0P2m-CweLPbt_gpcxFFs',
}

COLORS = {
    'blue': (0.11, 0.47, 0.72),
    'teal': (0.0, 0.54, 0.49),
    'orange': (0.85, 0.42, 0.0),
    'purple': (0.56, 0.27, 0.68),
    'gray': (0.38, 0.38, 0.38),
}

BGS = {
    'red': {'red': 0.98, 'green': 0.89, 'blue': 0.89},
    'green': {'red': 0.898, 'green': 0.961, 'blue': 0.878},
    'orange': {'red': 1.0, 'green': 0.949, 'blue': 0.8},
    'gray': {'red': 0.94, 'green': 0.94, 'blue': 0.94},
    'blue': {'red': 0.886, 'green': 0.949, 'blue': 0.988},
    'yellow': {'red': 1.0, 'green': 0.953, 'blue': 0.8},
}

README_VALUES = {
    ('cs', 'CS_使い方'): [
        ['項目', '内容'],
        ['このブックの目的', 'CSが日々使う運用ブックです。フォロー対応、継続確認、名寄せ確認、担当割り当てをここで進めます。'],
        ['最初に見る順番', '1) CS_承認進捗 → 2) CS_入金名寄せ確認 → 3) CS_継続名寄せ確認 → 4) CS_担当割当入力 → 5) CS_要フォロー一覧 → 6) CS_継続対象一覧'],
        ['日次の進め方', '① まず承認待ち件数を確認 → ② 名寄せ承認を処理 → ③ 担当割り当てを確認 → ④ 要フォロー顧客を確認 → ⑤ 継続提案対象を確認'],
        ['編集ルール', '入力タブで黄色の入力列だけ編集してください。その他の列・参照列は編集しません。'],
        ['色の意味(赤)', '最優先・エラー・至急確認'],
        ['色の意味(橙)', '本日〜近日中に確認したい行'],
        ['色の意味(緑)', '処理済み・良好・進行中'],
    ],
    ('exec', '経営_使い方'): [
        ['項目', '内容'],
        ['このブックの目的', 'マネージャー/責任者向けの確認ブックです。KPI、件数、例外推移、負荷状況を把握します。'],
        ['最初に見る順番', '1) 経営_データ状況 → 2) 経営_例外推移 → 3) 経営_顧客リスク → 4) 経営_コーチ負荷'],
        ['確認の進め方', '① まず異常件数 → ② 前日比悪化 → ③ 顧客リスク総数 → ④ コーチ負荷 の順で確認します'],
        ['編集ルール', 'このブックは閲覧専用です。元データの修正には使いません。'],
        ['色の意味(赤)', '件数悪化・データ異常・要対応'],
        ['色の意味(橙)', '注意・確認推奨'],
        ['色の意味(緑)', '良好・正常'],
    ],
    ('sales', '営業_使い方'): [
        ['項目', '内容'],
        ['このブックの目的', '営業向けの確認ブックです。未着金、成約状況、ファネルの動きを素早く確認します。'],
        ['最初に見る順番', '1) 営業_未入金一覧 → 2) 営業_契約一覧 → 3) 営業_データ状況 → 4) 営業_ファネル推移'],
        ['日次の進め方', '① 未着金・未紐付け確認 → ② 契約全体の進行確認 → ③ データ異常確認 → ④ 最近のイベント確認'],
        ['編集ルール', 'このブックは原則閲覧専用です。名寄せやデータ修正はCS/DB側で行います。'],
        ['色の意味(赤)', '要至急確認・未紐付け・リスク高'],
        ['色の意味(橙)', '優先度高・今日確認したい'],
        ['色の意味(緑)', '着金済み・成約済みなど良好な状態'],
    ],
    ('coaches', 'コーチ_使い方'): [
        ['項目', '内容'],
        ['このブックの目的', 'コーチ向けの確認ブックです。担当負荷と要フォロー顧客を確認します。'],
        ['最初に見る順番', '1) コーチ_要フォロー一覧 → 2) コーチ_担当負荷 → 3) コーチ_データ状況'],
        ['日次の進め方', '① 要フォロー顧客確認 → ② 自分たちの負荷確認 → ③ 件数異常確認'],
        ['編集ルール', 'このブックは閲覧専用です。データ修正はCS運用フローで行います。'],
        ['読み方のコツ', 'コーチ_要フォロー一覧 は customer_name・followup_reason・comment・gap_comment を一緒に見て判断します。'],
        ['色の意味(赤)', '至急フォロー・低満足・負荷リスク'],
        ['色の意味(橙)', '注意・確認推奨'],
        ['色の意味(緑)', '余力あり・良好'],
    ],
    ('concierge', 'コンシェルジュ_使い方'): [
        ['項目', '内容'],
        ['このブックの目的', 'コンシェルジュ向けの閲覧ブックです。フォロー対象の文脈確認とデータ健全性の確認に使います。'],
        ['最初に見る順番', '1) コンシェルジュ_フォロー一覧 → 2) コンシェルジュ_データ状況'],
        ['日次の進め方', '① フォロー対象の背景確認 → ② 件数異常確認'],
        ['編集ルール', 'すべて閲覧専用です。元データの修正は行いません。'],
        ['色の意味(赤)', '至急フォロー・異常値・要エスカレーション'],
        ['色の意味(橙)', '注意・件数多め・近日確認'],
        ['色の意味(緑)', '良好・解消済みに近い状態'],
    ],
}

HIDE_COLUMNS = {
    ('sales', '営業_未入金一覧'): ['customer_id', 'customer_match_method', 'source_sheet', 'source_row'],
    ('sales', '営業_契約一覧'): ['customer_id', 'customer_match_method', 'note', 'source_sheet', 'source_row'],
    ('sales', '営業_ファネル推移'): ['customer_id'],
    ('coaches', 'コーチ_要フォロー一覧'): ['customer_id', 'feedback_id'],
    ('concierge', 'コンシェルジュ_フォロー一覧'): ['customer_id', 'feedback_id', 'source_ref'],
    ('cs', 'CS_担当割当入力'): ['lead_id', 'suggested_assignee_id', 'current_assignee_id', 'suggested_assignee_scope', 'form_response_sheet', 'form_response_row'],
    ('cs', 'CS_入金名寄せ確認'): ['payment_id', 'payment_source_sheet', 'payment_source_row', 'candidate_line_registration_id'],
    ('cs', 'CS_継続名寄せ確認'): ['continuation_exception_id', 'candidate_line_registration_id'],
}

BASELINE = {
    'cs': {
        'CS_使い方': {'frozen_cols': 0, 'tab_color': 'gray', 'header_color': 'gray'},
        'CS_承認進捗': {'frozen_cols': 2, 'tab_color': 'purple', 'header_color': 'purple'},
        'CS_要フォロー一覧': {'frozen_cols': 4, 'tab_color': 'orange', 'header_color': 'orange'},
        'CS_継続対象一覧': {'frozen_cols': 4, 'tab_color': 'blue', 'header_color': 'blue'},
        'CS_別名解決入力': {'frozen_cols': 3, 'tab_color': 'teal', 'header_color': 'teal'},
        'CS_担当割当入力': {'frozen_cols': 5, 'tab_color': 'teal', 'header_color': 'teal'},
        'CS_入金名寄せ確認': {'frozen_cols': 4, 'tab_color': 'teal', 'header_color': 'teal'},
        'CS_継続名寄せ確認': {'frozen_cols': 4, 'tab_color': 'teal', 'header_color': 'teal'},
        'CS_例外確認': {'frozen_cols': 2, 'tab_color': 'gray', 'header_color': 'gray'},
    },
    'exec': {
        '経営_使い方': {'frozen_cols': 0, 'tab_color': 'gray', 'header_color': 'gray'},
        '経営_データ状況': {'frozen_cols': 1, 'tab_color': 'teal', 'header_color': 'teal'},
        '経営_例外推移': {'frozen_cols': 1, 'tab_color': 'purple', 'header_color': 'purple'},
        '経営_顧客リスク': {'frozen_cols': 1, 'tab_color': 'orange', 'header_color': 'orange'},
        '経営_コーチ負荷': {'frozen_cols': 1, 'tab_color': 'blue', 'header_color': 'blue'},
    },
    'sales': {
        '営業_使い方': {'frozen_cols': 0, 'tab_color': 'gray', 'header_color': 'gray'},
        '営業_契約一覧': {'frozen_cols': 2, 'tab_color': 'blue', 'header_color': 'blue'},
        '営業_未入金一覧': {'frozen_cols': 2, 'tab_color': 'orange', 'header_color': 'orange'},
        '営業_ファネル推移': {'frozen_cols': 3, 'tab_color': 'purple', 'header_color': 'purple'},
        '営業_データ状況': {'frozen_cols': 1, 'tab_color': 'teal', 'header_color': 'teal'},
    },
    'coaches': {
        'コーチ_使い方': {'frozen_cols': 0, 'tab_color': 'gray', 'header_color': 'gray'},
        'コーチ_担当負荷': {'frozen_cols': 1, 'tab_color': 'teal', 'header_color': 'teal'},
        'コーチ_要フォロー一覧': {'frozen_cols': 2, 'tab_color': 'orange', 'header_color': 'orange'},
        'コーチ_データ状況': {'frozen_cols': 1, 'tab_color': 'purple', 'header_color': 'purple'},
    },
    'concierge': {
        'コンシェルジュ_使い方': {'frozen_cols': 0, 'tab_color': 'gray', 'header_color': 'gray'},
        'コンシェルジュ_フォロー一覧': {'frozen_cols': 3, 'tab_color': 'blue', 'header_color': 'blue'},
        'コンシェルジュ_データ状況': {'frozen_cols': 1, 'tab_color': 'teal', 'header_color': 'teal'},
    },
    'db': {
        'Sync_Log': {'frozen_cols': 1, 'tab_color': 'purple', 'header_color': 'purple'},
        'Sync_Control': {'frozen_cols': 1, 'tab_color': 'gray', 'header_color': 'gray'},
        'Publish_Manifest': {'frozen_cols': 1, 'tab_color': 'gray', 'header_color': 'gray'},
        'Exceptions_FeedbackMatch': {'frozen_cols': 1, 'tab_color': 'orange', 'header_color': 'orange'},
        'Exceptions_ContinuationMatch': {'frozen_cols': 1, 'tab_color': 'orange', 'header_color': 'orange'},
        'Staging_Payments': {'frozen_cols': 1, 'tab_color': 'blue', 'header_color': 'blue'},
        'Customer_Coach_Assignments': {'frozen_cols': 2, 'tab_color': 'teal', 'header_color': 'teal'},
    },
}

EDITABLE_COLUMNS = {
    ('cs', 'CS_別名解決入力'): ['operator_decision_status', 'operator_selected_customer_name', 'operator_selected_customer_id', 'operator_note'],
    ('cs', 'CS_担当割当入力'): ['operator_decision_status', 'operator_selected_assignee_name', 'assignment_note'],
    ('cs', 'CS_入金名寄せ確認'): ['operator_decision_status', 'operator_selected_customer_name', 'operator_selected_customer_id', 'operator_note'],
    ('cs', 'CS_継続名寄せ確認'): ['operator_decision_status', 'operator_selected_customer_name', 'operator_selected_customer_id', 'operator_note'],
}

HEADER_NOTES = {
    'editable': '✅ ここは入力してよい列です',
    'readonly': '🔒 ここは自動出力列です。編集しません',
    'readonly_sheet': '🔒 このシートは閲覧専用です',
}

PROTECTION_DESC_PREFIX = 'potex-ux:'


README_EXTRA_ROWS = {
    ('cs', 'CS_使い方'): [
        ['CS_要フォロー一覧', '低満足や気になる声が出ている顧客一覧です。優先度 → 顧客名 → フォロー理由 → 顧客コメント → ギャップコメントの順で確認します。'],
        ['CS_継続対象一覧', '継続提案のタイミング確認用です。現在状態・提案進捗・提案日を見て次アクションを判断します。'],
        ['CS_承認進捗', 'レビュー滞留の件数確認です。最優先の未処理件数や、反映待ち件数が多いタブを先に見ます。'],
        ['CS_入金名寄せ確認', '着金データの顧客名確認です。同一人物なら承認系の候補を選択し、迷う場合は空欄のまま、別顧客へ直したい時だけ修正入力します。'],
        ['CS_継続名寄せ確認', '継続データの顧客名確認です。元の名前・プラン・候補情報を見比べて承認するか判断します。'],
        ['CS_担当割当入力', '担当割り当て入力です。自動提案と現在担当を確認し、必要なときだけ修正入力します。'],
    ],
    ('exec', '経営_使い方'): [
        ['経営_データ状況', '件数・例外の健全性確認です。赤い数値は要確認で、補足欄を見て原因のあたりを確認します。'],
        ['経営_例外推移', '日次の悪化・改善確認です。前日比で増えている指標を優先して確認します。'],
        ['経営_顧客リスク', 'フォローや継続リスクの全体件数確認です。件数が増えたら CS 側の作業キューを確認します。'],
        ['経営_コーチ負荷', 'コーチ負荷確認です。要フォロー件数と残り余力を優先して見ます。'],
    ],
    ('sales', '営業_使い方'): [
        ['営業_未入金一覧', '未着金・未紐付けの確認一覧です。優先度の高い行から顧客名と営業担当を見ます。'],
        ['営業_契約一覧', '契約済み案件の俯瞰です。入金状態・受講状態・担当コーチで進行状況を見ます。'],
        ['営業_データ状況', '営業向けデータ異常確認です。未紐付け件数などが増えたら CS レビューを確認します。'],
        ['営業_ファネル推移', '営業ファネルの更新履歴です。イベント種別と受講状態で最近の変化を追います。'],
    ],
    ('coaches', 'コーチ_使い方'): [
        ['コーチ_要フォロー一覧', '要フォロー顧客一覧です。優先度 → 顧客名 → フォロー理由 → 顧客コメント → ギャップコメントの順で確認します。'],
        ['コーチ_担当負荷', '担当負荷確認です。残り余力が少ないコーチ、要フォロー件数が多いコーチを見ます。'],
        ['コーチ_データ状況', 'コーチ向けデータ件数確認です。異常増加時は CS 側のレビューキューも確認します。'],
    ],
    ('concierge', 'コンシェルジュ_使い方'): [
        ['コンシェルジュ_フォロー一覧', '顧客フォローの背景確認用です。対応状況・受講状態・フォロー理由・顧客コメントを見て状況を把握します。'],
        ['コンシェルジュ_データ状況', 'コンシェルジュ向けデータ健全性確認です。followup_queue_count や例外件数の変化を見ます。'],
    ],
}

SHEET_GUIDES = {
    ('cs', 'CS_要フォロー一覧'): 'このシートの目的: 低満足・気になるコメントの顧客を見つける一覧です。\n見る順番: 優先度 → 顧客名 → フォロー理由 → 顧客コメント → ギャップコメント。\n操作: 原則入力なし。内容確認後、必要なら別の運用フローでフォローしてください。',
    ('cs', 'CS_継続対象一覧'): 'このシートの目的: 継続提案の対象者と進捗を確認する一覧です。\n見る順番: 優先度 → 顧客名 → 提案進捗 → 提案日。\n操作: 原則入力なし。連絡状況や提案タイミングの判断に使います。',
    ('cs', 'CS_承認進捗'): 'このシートの目的: 承認待ちキューの滞留件数を把握するサマリーです。\n見る順番: 指標名 → 件数 → 補足。\n操作: 最優先の未処理件数や反映待ち件数が多いレビューシートから優先対応します。',
    ('cs', 'CS_入金名寄せ確認'): 'このシートの目的: 着金データの顧客名を確認して名寄せ承認する入力シートです。\n操作手順: ① 元の着金名と候補情報を見比べる ② 同一人物なら承認候補を選ぶ ③ 別候補へ直す時だけ修正入力 ④ 迷う時は空欄のまま。',
    ('cs', 'CS_継続名寄せ確認'): 'このシートの目的: 継続データの顧客名を確認して名寄せ承認する入力シートです。\n操作手順: ① 元の名前・プラン・候補情報を比較 ② 同一人物なら承認候補を選ぶ ③ 修正時だけ修正入力 ④ 迷う時は空欄のまま。',
    ('cs', 'CS_担当割当入力'): 'このシートの目的: 担当者候補を確認して割り当てを確定する入力シートです。\n操作手順: ① 顧客候補情報を見る ② 自動提案と現在担当を比較 ③ 必要なら修正入力 ④ 承認候補を選んで反映。',
    ('exec', '経営_データ状況'): 'このシートの目的: データ件数と異常件数をまとめて確認する管理用シートです。\n見る順番: 指標名 → 件数 → 補足。\n操作: 0 が望ましい指標や急増した件数を見つけたら、該当の運用ブックを確認します。',
    ('exec', '経営_例外推移'): 'このシートの目的: 日次で件数が悪化していないかを見る推移表です。\n見る順番: date_jst → *_delta → 元件数。\n操作: delta が増えた項目を優先して確認します。',
    ('exec', '経営_顧客リスク'): 'このシートの目的: フォロー対象や継続リスクの全体件数を把握するサマリーです。\n見る順番: metric → value。\n操作: 件数が増えたら CS / Coach 側キューを確認します。',
    ('exec', '経営_コーチ負荷'): 'このシートの目的: コーチ負荷を俯瞰するシートです。\n見る順番: coach_name → followup_customer_count → remaining_capacity。\n操作: フォロー件数が多く余力が少ないコーチを優先確認します。',
    ('sales', '営業_契約一覧'): 'このシートの目的: 契約済み案件の進行状況を俯瞰するシートです。\n見る順番: 優先度 → 入金状態 → 顧客名 → 担当コーチ。\n操作: 原則入力なし。未着金や未紐付け行の確認に使います。',
    ('sales', '営業_未入金一覧'): 'このシートの目的: 未着金・未紐付けの行を優先順で確認するシートです。\n見る順番: 優先度 → 契約日 → 顧客名 → 営業担当。\n操作: 原則入力なし。緊急行は CS の名寄せレビューと合わせて確認します。',
    ('sales', '営業_ファネル推移'): 'このシートの目的: 営業ファネルの最新イベントを見る履歴シートです。\n見る順番: 日付 → イベント種別 → 顧客名 → 受講状態。\n操作: 原則入力なし。最近の変化や抜け漏れ確認に使います。',
    ('sales', '営業_データ状況'): 'このシートの目的: 営業向け publish の異常件数確認です。\n見る順番: metric → value → note。\n操作: unmatched 件数が増えたら CS レビューや DB 例外テーブルを確認します。',
    ('coaches', 'コーチ_担当負荷'): 'このシートの目的: コーチごとの負荷を見るサマリーです。\n見る順番: コーチ名 → 要フォロー件数 → 残り余力。\n操作: 残り余力が少ない行、要フォロー件数が多い行を優先確認します。',
    ('coaches', 'コーチ_要フォロー一覧'): 'このシートの目的: コーチが優先して見るべき要フォロー顧客一覧です。\n見る順番: 優先度 → 顧客名 → フォロー理由 → 顧客コメント → ギャップコメント。\n操作: 原則入力なし。赤/橙の理由を見て優先フォローします。',
    ('coaches', 'コーチ_データ状況'): 'このシートの目的: コーチ向けデータ件数の健全性確認です。\n見る順番: metric → value → note。\n操作: followup_customer_count や低満足件数の増加を確認します。',
    ('concierge', 'コンシェルジュ_フォロー一覧'): 'このシートの目的: コンシェルジュが顧客フォローの背景を把握する参照シートです。\n見る順番: 優先度 → 対応状況 → 顧客名 → フォロー理由 → 顧客コメント。\n操作: 原則入力なし。誰が何を見ればよいかを把握するための一覧です。',
    ('concierge', 'コンシェルジュ_データ状況'): 'このシートの目的: コンシェルジュ向け publish の件数異常確認です。\n見る順番: metric → value → note。\n操作: 例外や followup_queue_count の増減を確認します。',
}

COLUMN_NOTES = {
    ('cs', 'CS_要フォロー一覧'): {
        'priority': 'P1=最優先で確認。P2=通常優先。',
        'followup_reason': 'フォローが必要と判断した理由です。複数理由はカンマ区切りです。',
        'comment': '顧客の自由記述コメントです。感情や要望の把握に使います。',
        'gap_comment': 'コーチとの認識差や不満の補足です。',
    },
    ('cs', 'CS_継続対象一覧'): {
        'current_status': '現在の受講ステータスです。active/completed/lost などを見ます。',
        'continuation_tag': '継続対象の目印です。1 が入る行を優先確認します。',
        'after_follow_progress': '継続提案の進捗です。打診前 / 連絡待ち などを見ます。',
        'after_follow_offer_date': '継続提案した日、または提案予定の記録です。',
        'note': '補足事項や引き継ぎメモです。',
    },
    ('cs', 'CS_承認進捗'): {
        'metric': 'open_p1 / decided_waiting_sync など、どの滞留件数かを示します。',
        'value': '件数です。多いものから先に確認します。',
        'note': 'この指標の読み方や元シートの説明です。',
    },
    ('cs', 'CS_入金名寄せ確認'): {
        'suggested_action': '自動提案です。approve_if_context_matches は「文脈が合えば承認候補」を意味します。',
        'suggestion_basis': 'なぜこの候補を出したかの根拠です。',
        'operator_decision_status': '承認する場合は approved / active / resolved。迷う場合は空欄のままです。',
        'operator_selected_customer_name': '自動候補と違う顧客名へ修正したい時だけ入力します。',
        'operator_selected_customer_id': '顧客IDが分かる場合だけ入力します。',
        'operator_note': '判断理由・保留理由・気になる点を短く記録します。',
    },
    ('cs', 'CS_継続名寄せ確認'): {
        'cleaned_name': '表記ゆれを整えた名前です。',
        'suggested_action': '自動提案です。approve_if_context_matches は「文脈が合えば承認候補」を意味します。',
        'suggestion_basis': 'なぜこの候補を出したかの根拠です。',
        'operator_decision_status': '承認する場合は approved / active / resolved。迷う場合は空欄のままです。',
        'operator_selected_customer_name': '自動候補と違う顧客名へ修正したい時だけ入力します。',
        'operator_selected_customer_id': '顧客IDが分かる場合だけ入力します。',
        'operator_note': '判断理由・保留理由・気になる点を短く記録します。',
    },
    ('cs', 'CS_担当割当入力'): {
        'suggested_assignee_name': '自動提案の担当者名です。確定ではありません。',
        'current_assignee_name': 'すでに割り当て済みの担当者がいれば表示されます。',
        'operator_decision_status': '反映する場合は approved / active / resolved を選びます。迷う場合は空欄です。',
        'operator_selected_assignee_name': '別の担当者へ変更したい時だけ入力します。',
        'assignment_note': '判断理由や補足を短く記録します。',
    },
    ('sales', '営業_契約一覧'): {
        'payment_status': 'pending=未着金、paid=着金済みです。',
        'canonical_customer_name': '名寄せ後の顧客名です。空欄なら未紐付けの可能性があります。',
        'current_status': '受講ステータスです。',
    },
    ('sales', '営業_未入金一覧'): {
        'priority': 'P0=最優先、P1=高優先で確認します。',
        'canonical_customer_name': '名寄せ後の顧客名です。空欄なら未紐付けの可能性があります。',
        'customer_match_method': 'どのルールで顧客紐付けしたかです。空欄は未紐付けの可能性があります。',
    },
    ('coaches', 'コーチ_担当負荷'): {
        'followup_customer_count': '要フォロー顧客数です。',
        'remaining_capacity': '対応余力の目安です。少ないほど負荷が高いです。',
    },
    ('coaches', 'コーチ_要フォロー一覧'): {
        'priority': 'P1 を最優先で確認します。',
        'followup_reason': 'フォローが必要と判断した理由です。',
        'comment': '顧客の自由記述コメントです。',
        'gap_comment': 'コーチとの認識差や困りごとの記述です。',
    },
    ('concierge', 'コンシェルジュ_フォロー一覧'): {
        'queue_status': 'open=未対応、closed/resolved 系=対応済みに近い状態です。',
        'followup_reason': 'フォローが必要と判断した理由です。',
        'comment': '顧客コメントです。',
        'gap_comment': 'コーチとの認識差や困りごとの補足です。',
        'owner': '主担当や確認すべき担当者の目安です。',
    },
}

HEADER_GROUPS = {
    ('cs', 'CS_要フォロー一覧'): {'orange': ['priority', 'low_satisfaction_flag'], 'blue': ['feedback_date', 'customer_name', 'coach_name'], 'purple': ['followup_reason', 'comment', 'gap_comment']},
    ('cs', 'CS_継続対象一覧'): {'orange': ['priority', 'after_follow_progress', 'after_follow_offer_date', 'after_follow_event_date'], 'blue': ['customer_name', 'current_status', 'assigned_coach_name', 'course_name'], 'gray': ['note']},
    ('cs', 'CS_承認進捗'): {'blue': ['scope', 'metric'], 'orange': ['value'], 'gray': ['note']},
    ('cs', 'CS_入金名寄せ確認'): {'orange': ['priority', 'suggested_action'], 'blue': ['payment_customer_name', 'payment_line_name', 'contract_date', 'paid_date', 'plan_name', 'amount', 'payment_segment'], 'teal': ['candidate_real_name', 'candidate_line_registration_name', 'candidate_display_name', 'candidate_segment'], 'gray': ['current_status', 'current_canonical_customer_name', 'current_canonical_customer_id', 'suggestion_basis', 'writeback_alias_name'], 'yellow': ['operator_decision_status', 'operator_selected_customer_name', 'operator_selected_customer_id', 'operator_note']},
    ('cs', 'CS_継続名寄せ確認'): {'orange': ['priority', 'suggested_action'], 'blue': ['raw_name', 'cleaned_name', 'raw_plan', 'raw_contract_date', 'raw_amount'], 'teal': ['candidate_real_name', 'candidate_line_registration_name', 'candidate_display_name', 'candidate_segment'], 'gray': ['current_status', 'current_canonical_customer_name', 'current_canonical_customer_id', 'suggestion_basis', 'writeback_alias_name'], 'yellow': ['operator_decision_status', 'operator_selected_customer_name', 'operator_selected_customer_id', 'operator_note']},
    ('cs', 'CS_担当割当入力'): {'orange': ['priority'], 'blue': ['lead_display_name', 'respondent_email', 'phone', 'age'], 'teal': ['suggested_assignee_name', 'current_assignee_name', 'assignee_type'], 'yellow': ['operator_decision_status', 'operator_selected_assignee_name', 'assignment_note'], 'gray': ['sync_status', 'last_collected_at']},
    ('exec', '経営_データ状況'): {'blue': ['metric'], 'orange': ['value'], 'gray': ['note']},
    ('exec', '経営_例外推移'): {'blue': ['date_jst', 'latest_run_at_jst', 'source_job'], 'orange': ['feedback_match_exception_count', 'payment_unmatched_count', 'continuation_unmatched_count', 'line_registration_unmatched_count', 'feedback_response_id_collision_count'], 'purple': ['feedback_match_exception_delta', 'payment_unmatched_delta', 'continuation_unmatched_delta', 'line_registration_unmatched_delta', 'feedback_response_id_collision_delta']},
    ('exec', '経営_顧客リスク'): {'blue': ['metric'], 'orange': ['value']},
    ('exec', '経営_コーチ負荷'): {'blue': ['coach_name'], 'teal': ['active_customer_count', 'session_count'], 'orange': ['followup_customer_count', 'low_satisfaction_feedback_count', 'remaining_capacity']},
    ('sales', '営業_契約一覧'): {'orange': ['priority', 'payment_status'], 'blue': ['contract_date', 'paid_date', 'canonical_customer_name', 'payment_customer_name', 'payment_line_name'], 'teal': ['plan_name', 'amount', 'segment'], 'purple': ['sales_owner_name', 'current_status', 'assigned_coach_name']},
    ('sales', '営業_未入金一覧'): {'orange': ['priority'], 'blue': ['contract_date', 'canonical_customer_name', 'payment_customer_name'], 'teal': ['sales_owner_name', 'plan_name', 'amount', 'segment'], 'purple': ['current_status', 'assigned_coach_name']},
    ('sales', '営業_ファネル推移'): {'blue': ['event_date', 'event_type', 'customer_name'], 'purple': ['current_status', 'assigned_coach_name', 'changed_by'], 'gray': ['note']},
    ('sales', '営業_データ状況'): {'blue': ['metric'], 'orange': ['value'], 'gray': ['note']},
    ('coaches', 'コーチ_担当負荷'): {'blue': ['coach_name'], 'teal': ['active_customer_count', 'session_count'], 'orange': ['followup_customer_count', 'low_satisfaction_feedback_count', 'remaining_capacity']},
    ('coaches', 'コーチ_要フォロー一覧'): {'orange': ['priority', 'low_satisfaction_flag'], 'blue': ['feedback_date', 'customer_name', 'coach_name'], 'purple': ['followup_reason', 'comment', 'gap_comment']},
    ('coaches', 'コーチ_データ状況'): {'blue': ['metric'], 'orange': ['value'], 'gray': ['note']},
    ('concierge', 'コンシェルジュ_フォロー一覧'): {'orange': ['priority', 'queue_status'], 'blue': ['feedback_date', 'customer_name', 'current_status'], 'teal': ['assigned_coach_name', 'feedback_coach_name', 'owner'], 'purple': ['followup_reason', 'comment', 'gap_comment']},
    ('concierge', 'コンシェルジュ_データ状況'): {'blue': ['metric'], 'orange': ['value'], 'gray': ['note']},
}

COLUMN_WIDTHS = {
    ('cs', 'CS_要フォロー一覧'): {'priority': 64, 'feedback_date': 120, 'customer_name': 130, 'coach_name': 120, 'followup_reason': 170, 'comment': 260, 'gap_comment': 260},
    ('cs', 'CS_継続対象一覧'): {'priority': 64, 'customer_name': 130, 'current_status': 110, 'continuation_tag': 88, 'after_follow_progress': 140, 'after_follow_offer_date': 120, 'after_follow_event_date': 120, 'assigned_coach_name': 120, 'course_name': 180, 'note': 220},
    ('cs', 'CS_承認進捗'): {'scope': 140, 'metric': 190, 'value': 90, 'note': 280},
    ('cs', 'CS_入金名寄せ確認'): {'priority': 64, 'suggested_action': 170, 'payment_customer_name': 150, 'payment_line_name': 160, 'plan_name': 120, 'amount': 90, 'candidate_real_name': 140, 'candidate_line_registration_name': 150, 'candidate_display_name': 150, 'current_canonical_customer_name': 140, 'suggestion_basis': 220, 'operator_decision_status': 120, 'operator_selected_customer_name': 150, 'operator_selected_customer_id': 130, 'operator_note': 220},
    ('cs', 'CS_継続名寄せ確認'): {'priority': 64, 'suggested_action': 170, 'raw_name': 120, 'cleaned_name': 120, 'raw_plan': 140, 'raw_contract_date': 120, 'raw_amount': 100, 'candidate_real_name': 140, 'candidate_line_registration_name': 150, 'candidate_display_name': 150, 'current_canonical_customer_name': 140, 'suggestion_basis': 220, 'operator_decision_status': 120, 'operator_selected_customer_name': 150, 'operator_selected_customer_id': 130, 'operator_note': 220},
    ('cs', 'CS_担当割当入力'): {'priority': 64, 'lead_display_name': 140, 'respondent_email': 180, 'phone': 110, 'age': 70, 'suggested_assignee_name': 140, 'current_assignee_name': 140, 'assignee_type': 100, 'operator_decision_status': 120, 'operator_selected_assignee_name': 150, 'assignment_note': 220},
    ('exec', '経営_データ状況'): {'metric': 220, 'value': 90, 'note': 320},
    ('exec', '経営_顧客リスク'): {'metric': 220, 'value': 90},
    ('exec', '経営_コーチ負荷'): {'coach_name': 130, 'active_customer_count': 100, 'session_count': 100, 'followup_customer_count': 120, 'low_satisfaction_feedback_count': 120, 'remaining_capacity': 110},
    ('sales', '営業_契約一覧'): {'priority': 64, 'payment_status': 90, 'contract_date': 110, 'paid_date': 110, 'canonical_customer_name': 150, 'payment_customer_name': 150, 'payment_line_name': 160, 'plan_name': 120, 'amount': 90, 'segment': 100, 'sales_owner_name': 120, 'current_status': 110, 'assigned_coach_name': 120},
    ('sales', '営業_未入金一覧'): {'priority': 64, 'contract_date': 110, 'canonical_customer_name': 150, 'payment_customer_name': 150, 'sales_owner_name': 120, 'plan_name': 120, 'amount': 90, 'segment': 100, 'current_status': 110, 'assigned_coach_name': 120},
    ('sales', '営業_ファネル推移'): {'event_date': 110, 'event_type': 110, 'customer_name': 140, 'current_status': 110, 'assigned_coach_name': 120, 'changed_by': 120, 'note': 220},
    ('sales', '営業_データ状況'): {'metric': 220, 'value': 90, 'note': 320},
    ('coaches', 'コーチ_担当負荷'): {'coach_name': 130, 'active_customer_count': 100, 'session_count': 100, 'followup_customer_count': 120, 'low_satisfaction_feedback_count': 120, 'remaining_capacity': 110},
    ('coaches', 'コーチ_要フォロー一覧'): {'priority': 64, 'feedback_date': 120, 'customer_name': 130, 'coach_name': 120, 'followup_reason': 170, 'comment': 280, 'gap_comment': 280},
    ('coaches', 'コーチ_データ状況'): {'metric': 220, 'value': 90, 'note': 320},
    ('concierge', 'コンシェルジュ_フォロー一覧'): {'priority': 64, 'queue_status': 90, 'feedback_date': 120, 'customer_name': 130, 'current_status': 110, 'assigned_coach_name': 120, 'feedback_coach_name': 120, 'followup_reason': 170, 'comment': 260, 'gap_comment': 260, 'owner': 120},
    ('concierge', 'コンシェルジュ_データ状況'): {'metric': 220, 'value': 90, 'note': 320},
}

WRAP_COLUMNS = {
    ('cs', 'CS_要フォロー一覧'): ['followup_reason', 'comment', 'gap_comment'],
    ('cs', 'CS_継続対象一覧'): ['course_name', 'note'],
    ('cs', 'CS_承認進捗'): ['note'],
    ('cs', 'CS_入金名寄せ確認'): ['suggested_action', 'suggestion_basis', 'operator_note'],
    ('cs', 'CS_継続名寄せ確認'): ['suggested_action', 'suggestion_basis', 'operator_note'],
    ('cs', 'CS_担当割当入力'): ['assignment_note'],
    ('exec', '経営_データ状況'): ['note'],
    ('sales', '営業_ファネル推移'): ['note'],
    ('sales', '営業_データ状況'): ['note'],
    ('coaches', 'コーチ_要フォロー一覧'): ['followup_reason', 'comment', 'gap_comment'],
    ('coaches', 'コーチ_データ状況'): ['note'],
    ('concierge', 'コンシェルジュ_フォロー一覧'): ['followup_reason', 'comment', 'gap_comment'],
    ('concierge', 'コンシェルジュ_データ状況'): ['note'],
}

DATA_VALIDATIONS = {
    ('cs', 'CS_別名解決入力'): {'operator_decision_status': ['approved', 'active', 'resolved']},
    ('cs', 'CS_担当割当入力'): {'operator_decision_status': ['approved', 'active', 'resolved']},
    ('cs', 'CS_入金名寄せ確認'): {'operator_decision_status': ['approved', 'active', 'resolved']},
    ('cs', 'CS_継続名寄せ確認'): {'operator_decision_status': ['approved', 'active', 'resolved']},
}


TAB_ORDER = {
    'cs': ['CS_使い方', 'CS_承認進捗', 'CS_入金名寄せ確認', 'CS_継続名寄せ確認', 'CS_担当割当入力', 'CS_要フォロー一覧', 'CS_継続対象一覧', 'CS_別名解決入力', 'CS_例外確認', 'CS_更新アクション'],
    'exec': ['経営_使い方', '経営_データ状況', '経営_例外推移', '経営_顧客リスク', '経営_コーチ負荷'],
    'sales': ['営業_使い方', '営業_未入金一覧', '営業_契約一覧', '営業_データ状況', '営業_ファネル推移'],
    'coaches': ['コーチ_使い方', 'コーチ_要フォロー一覧', 'コーチ_担当負荷', 'コーチ_データ状況'],
    'concierge': ['コンシェルジュ_使い方', 'コンシェルジュ_フォロー一覧', 'コンシェルジュ_データ状況'],
}


def get_service():
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('sheets', 'v4', credentials=creds)


def rgb(name: str) -> dict[str, float]:
    r, g, b = COLORS[name]
    return {'red': r, 'green': g, 'blue': b}


def body_grid(sheet_id: int, rows: int, cols: int, start_row: int = 1, start_col: int = 0) -> dict[str, int]:
    return {
        'sheetId': sheet_id,
        'startRowIndex': start_row,
        'endRowIndex': rows,
        'startColumnIndex': start_col,
        'endColumnIndex': cols,
    }


def column_letter(index: int) -> str:
    result = ''
    current = index
    while current >= 0:
        result = chr(current % 26 + ord('A')) + result
        current = current // 26 - 1
    return result


def build_header_note(workbook_key: str, title: str, col_name: str, editable: list[str]) -> str:
    sheet_guide = SHEET_GUIDES.get((workbook_key, title), '')
    column_note = COLUMN_NOTES.get((workbook_key, title), {}).get(col_name, '')
    access_note = HEADER_NOTES['editable'] if col_name in editable else (HEADER_NOTES['readonly'] if editable else HEADER_NOTES['readonly_sheet'])
    parts = [part for part in [sheet_guide, f'この列の見方: {column_note}' if column_note else '', access_note] if part]
    return '\n\n'.join(parts)


def add_header_group_styles(reqs: list[dict[str, Any]], sheet_id: int, header: list[str], groups: dict[str, list[str]] | None) -> None:
    if not groups:
        return
    for color_name, columns in groups.items():
        for col_name in columns:
            if col_name not in header:
                continue
            idx = header.index(col_name)
            reqs.append({
                'repeatCell': {
                    'range': {'sheetId': sheet_id, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': idx, 'endColumnIndex': idx + 1},
                    'cell': {'userEnteredFormat': {
                        'backgroundColor': BGS.get(color_name, BGS['gray']),
                        'horizontalAlignment': 'CENTER',
                        'verticalAlignment': 'MIDDLE',
                        'textFormat': {'bold': True, 'foregroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2}, 'fontSize': 10},
                        'wrapStrategy': 'WRAP',
                    }},
                    'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
                }
            })


def add_column_width_requests(reqs: list[dict[str, Any]], sheet_id: int, header: list[str], widths: dict[str, int] | None) -> None:
    if not widths:
        return
    for col_name, width in widths.items():
        if col_name not in header:
            continue
        idx = header.index(col_name)
        reqs.append({
            'updateDimensionProperties': {
                'range': {'sheetId': sheet_id, 'dimension': 'COLUMNS', 'startIndex': idx, 'endIndex': idx + 1},
                'properties': {'pixelSize': width},
                'fields': 'pixelSize'
            }
        })


def add_wrap_requests(reqs: list[dict[str, Any]], sheet_id: int, rows: int, header: list[str], columns: list[str] | None) -> None:
    if not columns:
        return
    for col_name in columns:
        if col_name not in header:
            continue
        idx = header.index(col_name)
        reqs.append({
            'repeatCell': {
                'range': {'sheetId': sheet_id, 'startRowIndex': 1, 'endRowIndex': rows, 'startColumnIndex': idx, 'endColumnIndex': idx + 1},
                'cell': {'userEnteredFormat': {'wrapStrategy': 'WRAP', 'verticalAlignment': 'TOP'}},
                'fields': 'userEnteredFormat(wrapStrategy,verticalAlignment)'
            }
        })


def add_validation_requests(reqs: list[dict[str, Any]], sheet_id: int, rows: int, header: list[str], validations: dict[str, list[str]] | None) -> None:
    if not validations:
        return
    for col_name, allowed_values in validations.items():
        if col_name not in header:
            continue
        idx = header.index(col_name)
        reqs.append({
            'setDataValidation': {
                'range': {'sheetId': sheet_id, 'startRowIndex': 1, 'endRowIndex': rows, 'startColumnIndex': idx, 'endColumnIndex': idx + 1},
                'rule': {
                    'condition': {'type': 'ONE_OF_LIST', 'values': [{'userEnteredValue': v} for v in allowed_values]},
                    'strict': True,
                    'showCustomUi': True,
                    'inputMessage': '候補から選択してください'
                }
            }
        })


def add_generic_signal_rules(reqs: list[dict[str, Any]], sheet_id: int, rows: int, header: list[str]) -> None:
    if 'operator_decision_status' in header:
        idx = header.index('operator_decision_status')
        letter = column_letter(idx)
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"approved|active|resolved")', BGS['green'])
    if 'sync_status' in header:
        idx = header.index('sync_status')
        letter = column_letter(idx)
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"error|invalid|fail")', BGS['red'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"pending|waiting|review")', BGS['orange'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"done|success|synced|complete")', BGS['green'])
    if 'current_status' in header:
        idx = header.index('current_status')
        letter = column_letter(idx)
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=LOWER(${letter}2)="review"', BGS['orange'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"completed|active")', BGS['green'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"lost|cancel")', BGS['red'])
    if 'queue_status' in header:
        idx = header.index('queue_status')
        letter = column_letter(idx)
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=LOWER(${letter}2)="open"', BGS['orange'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=REGEXMATCH(LOWER(${letter}2),"closed|resolved|done")', BGS['green'])
    if 'payment_status' in header:
        idx = header.index('payment_status')
        letter = column_letter(idx)
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=LOWER(${letter}2)="pending"', BGS['orange'])
        add_cf(reqs, [body_grid(sheet_id, rows, idx + 1, 1, idx)], f'=LOWER(${letter}2)="paid"', BGS['green'])


def add_cf(reqs: list[dict[str, Any]], ranges: list[dict[str, int]], formula: str, bg: dict[str, float]) -> None:
    reqs.append({
        'addConditionalFormatRule': {
            'rule': {
                'ranges': ranges,
                'booleanRule': {
                    'condition': {'type': 'CUSTOM_FORMULA', 'values': [{'userEnteredValue': formula}]},
                    'format': {'backgroundColor': bg},
                },
            },
            'index': 0,
        }
    })


def clear_conditional_rules(api, spreadsheet_id: str, sheet_id: int, count: int) -> None:
    for _ in range(count):
        try:
            api.batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={'requests': [{'deleteConditionalFormatRule': {'sheetId': sheet_id, 'index': 0}}]},
            ).execute()
        except Exception:
            pass


def apply_baseline_and_signals(api, workbook_key: str) -> None:
    spreadsheet_id = WORKBOOKS[workbook_key]
    meta = api.get(
        spreadsheetId=spreadsheet_id,
        fields='sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),conditionalFormats)'
    ).execute()
    props = {s['properties']['title']: s['properties'] for s in meta['sheets']}
    conditional_counts = {s['properties']['title']: len(s.get('conditionalFormats', [])) for s in meta['sheets']}

    for title in BASELINE.get(workbook_key, {}):
        clear_conditional_rules(api, spreadsheet_id, props[title]['sheetId'], conditional_counts.get(title, 0))

    requests: list[dict[str, Any]] = []
    for title, cfg in BASELINE.get(workbook_key, {}).items():
        p = props[title]
        rows = max(2, p['gridProperties']['rowCount'])
        cols = p['gridProperties']['columnCount']
        header = api.values().get(spreadsheetId=spreadsheet_id, range=f'{title}!1:1').execute().get('values', [[]])[0]
        requests.extend([
            {'updateSheetProperties': {'properties': {'sheetId': p['sheetId'], 'gridProperties': {'frozenRowCount': 1, 'frozenColumnCount': cfg['frozen_cols']}, 'tabColorStyle': {'rgbColor': rgb(cfg['tab_color'])}}, 'fields': 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount,tabColorStyle'}},
            {'setBasicFilter': {'filter': {'range': {'sheetId': p['sheetId'], 'startRowIndex': 0, 'endRowIndex': rows, 'startColumnIndex': 0, 'endColumnIndex': cols}}}},
            {'repeatCell': {'range': {'sheetId': p['sheetId'], 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': cols}, 'cell': {'userEnteredFormat': {'backgroundColor': rgb(cfg['header_color']), 'horizontalAlignment': 'CENTER', 'verticalAlignment': 'MIDDLE', 'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}, 'fontSize': 10}, 'wrapStrategy': 'WRAP'}}, 'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'}},
            {'updateDimensionProperties': {'range': {'sheetId': p['sheetId'], 'dimension': 'ROWS', 'startIndex': 0, 'endIndex': 1}, 'properties': {'pixelSize': 34}, 'fields': 'pixelSize'}},
            {'autoResizeDimensions': {'dimensions': {'sheetId': p['sheetId'], 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': min(cols, 12)}}},
        ])

        add_header_group_styles(requests, p['sheetId'], header, HEADER_GROUPS.get((workbook_key, title)))
        add_column_width_requests(requests, p['sheetId'], header, COLUMN_WIDTHS.get((workbook_key, title)))
        add_wrap_requests(requests, p['sheetId'], rows, header, WRAP_COLUMNS.get((workbook_key, title)))
        add_validation_requests(requests, p['sheetId'], rows, header, DATA_VALIDATIONS.get((workbook_key, title)))

        if title == '営業_契約一覧':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P0")', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P1")', BGS['orange'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=AND($B2="pending",$E2="")', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=($B2="paid")', BGS['green'])
        elif title == '営業_未入金一覧':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P0")', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P1")', BGS['orange'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($C2="")', BGS['red'])
        elif title == '営業_ファネル推移':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=OR($B2="contracted",$B2="paid")', BGS['green'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=OR($B2="lost",$B2="refund_requested")', BGS['red'])
        elif title == '営業_データ状況':
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"(_unmatched_count|lost_events_count)$"))', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"(paid_payment_count|contracted_events_count)$"))', BGS['green'])
        elif title == 'コーチ_担当負荷':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=AND(COUNTA($A2:$Z2)>0,VALUE($F2)<=0)', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=AND(COUNTA($A2:$Z2)>0,VALUE($D2)>0)', BGS['orange'])
        elif title == 'コーチ_要フォロー一覧':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P1")', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($B2="TRUE")', BGS['orange'])
        elif title == 'コーチ_データ状況':
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"(followup_customer_count|low_satisfaction_feedback_count)$"))', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"remaining_capacity_total$"))', BGS['green'])
        elif title == 'コンシェルジュ_フォロー一覧':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($A2="P1")', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=REGEXMATCH($H2,"low_satisfaction|gap_comment_present")', BGS['orange'])
        elif title == 'コンシェルジュ_データ状況':
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"(_unmatched_count|_exception_count)$"))', BGS['red'])
            add_cf(requests, [body_grid(p['sheetId'], rows, 2, 1, 1)], '=AND(VALUE($B2)>0,REGEXMATCH($A2,"followup_queue_count$"))', BGS['orange'])
        elif title == 'Sync_Log':
            add_cf(requests, [body_grid(p['sheetId'], rows, 3, 1, 2)], '=LOWER($C2)="success"', BGS['green'])
            add_cf(requests, [body_grid(p['sheetId'], rows, 3, 1, 2)], '=REGEXMATCH(LOWER($C2),"error|fail")', BGS['red'])
        elif title == 'Exceptions_FeedbackMatch':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=TRUE', BGS['orange'])
        elif title == 'Exceptions_ContinuationMatch':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($G2="continuation_customer_unmatched")', BGS['red'])
        elif title == 'Staging_Payments':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=REGEXMATCH($D2,"\\[POTENTIAL X\\]")', BGS['orange'])
        elif title == 'Customer_Coach_Assignments':
            add_cf(requests, [body_grid(p['sheetId'], rows, cols)], '=($L2="partner")', BGS['blue'])

        add_generic_signal_rules(requests, p['sheetId'], rows, header)

    if requests:
        api.batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': requests}).execute()

def apply_readmes_and_hides(api) -> None:
    by_workbook: dict[str, list[tuple[str, list[list[str]]]]] = {}
    for (workbook_key, sheet_name), values in README_VALUES.items():
        merged_values = values + README_EXTRA_ROWS.get((workbook_key, sheet_name), [])
        by_workbook.setdefault(workbook_key, []).append((sheet_name, merged_values))

    for workbook_key, items in by_workbook.items():
        sid = WORKBOOKS[workbook_key]
        data = [
            {
                'range': f'{sheet_name}!A1:B{len(values)}',
                'values': values,
            }
            for sheet_name, values in items
        ]
        api.values().batchUpdate(
            spreadsheetId=sid,
            body={
                'valueInputOption': 'RAW',
                'data': data,
            },
        ).execute()

    for workbook_key, sid in WORKBOOKS.items():
        meta = api.get(spreadsheetId=sid, fields='sheets(properties(sheetId,title,gridProperties(rowCount)))').execute()
        props = {s['properties']['title']: s['properties'] for s in meta['sheets']}
        for (wk, title), cols in HIDE_COLUMNS.items():
            if wk != workbook_key or title not in props:
                continue
            header = api.values().get(spreadsheetId=sid, range=f'{title}!1:1').execute().get('values', [[]])[0]
            requests = []
            for col_name in cols:
                if col_name in header:
                    idx = header.index(col_name)
                    requests.append({'updateDimensionProperties': {'range': {'sheetId': props[title]['sheetId'], 'dimension': 'COLUMNS', 'startIndex': idx, 'endIndex': idx + 1}, 'properties': {'hiddenByUser': True}, 'fields': 'hiddenByUser'}})
            if requests:
                api.batchUpdate(spreadsheetId=sid, body={'requests': requests}).execute()


def apply_tab_order(api, workbook_key: str) -> None:
    ordered_titles = TAB_ORDER.get(workbook_key, [])
    if not ordered_titles:
        return
    spreadsheet_id = WORKBOOKS[workbook_key]
    meta = api.get(spreadsheetId=spreadsheet_id, fields='sheets(properties(sheetId,title,index))').execute()
    props_by_title = {s['properties']['title']: s['properties'] for s in meta['sheets']}
    requests = []
    for new_index, title in enumerate(ordered_titles):
        if title not in props_by_title:
            continue
        requests.append({
            'updateSheetProperties': {
                'properties': {'sheetId': props_by_title[title]['sheetId'], 'index': new_index},
                'fields': 'index'
            }
        })
    if requests:
        api.batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': requests}).execute()

def clear_managed_protections(api, spreadsheet_id: str, sheet_id: int, protected_ranges: list[dict[str, Any]]) -> None:
    requests = []
    for pr in protected_ranges:
        if pr.get('range', {}).get('sheetId') != sheet_id:
            continue
        if not str(pr.get('description', '')).startswith(PROTECTION_DESC_PREFIX):
            continue
        requests.append({'deleteProtectedRange': {'protectedRangeId': pr['protectedRangeId']}})
    if requests:
        api.batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': requests}).execute()


def apply_protections_and_header_notes(api, workbook_key: str) -> None:
    spreadsheet_id = WORKBOOKS[workbook_key]
    meta = api.get(
        spreadsheetId=spreadsheet_id,
        fields='sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),protectedRanges(protectedRangeId,description,range))'
    ).execute()
    props = {s['properties']['title']: s['properties'] for s in meta['sheets']}
    protections = {s['properties']['title']: s.get('protectedRanges', []) for s in meta['sheets']}

    for title in BASELINE.get(workbook_key, {}):
        if title in props:
            clear_managed_protections(api, spreadsheet_id, props[title]['sheetId'], protections.get(title, []))

    requests: list[dict[str, Any]] = []
    for title in BASELINE.get(workbook_key, {}):
        if title not in props:
            continue
        p = props[title]
        rows = max(2, p['gridProperties']['rowCount'])
        header = api.values().get(spreadsheetId=spreadsheet_id, range=f'{title}!1:1').execute().get('values', [[]])[0]
        if not header:
            continue

        editable = EDITABLE_COLUMNS.get((workbook_key, title), [])
        if editable:
            unprotected = []
            for col_name in editable:
                if col_name not in header:
                    continue
                idx = header.index(col_name)
                unprotected.append({
                    'sheetId': p['sheetId'],
                    'startRowIndex': 1,
                    'endRowIndex': rows,
                    'startColumnIndex': idx,
                    'endColumnIndex': idx + 1,
                })
            requests.append({
                'addProtectedRange': {
                    'protectedRange': {
                        'description': f'{PROTECTION_DESC_PREFIX}{title}:input-lock',
                        'range': {'sheetId': p['sheetId']},
                        'warningOnly': False,
                        'unprotectedRanges': unprotected,
                    }
                }
            })
        else:
            requests.append({
                'addProtectedRange': {
                    'protectedRange': {
                        'description': f'{PROTECTION_DESC_PREFIX}{title}:readonly',
                        'range': {'sheetId': p['sheetId']},
                        'warningOnly': False,
                    }
                }
            })

        for idx, col_name in enumerate(header):
            note = build_header_note(workbook_key, title, col_name, editable)
            requests.append({
                'repeatCell': {
                    'range': {'sheetId': p['sheetId'], 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': idx, 'endColumnIndex': idx + 1},
                    'cell': {'note': note},
                    'fields': 'note'
                }
            })
            if col_name in editable:
                requests.append({
                    'repeatCell': {
                        'range': {'sheetId': p['sheetId'], 'startRowIndex': 1, 'endRowIndex': rows, 'startColumnIndex': idx, 'endColumnIndex': idx + 1},
                        'cell': {'userEnteredFormat': {'backgroundColor': BGS['yellow']}},
                        'fields': 'userEnteredFormat.backgroundColor'
                    }
                })

    if requests:
        api.batchUpdate(spreadsheetId=spreadsheet_id, body={'requests': requests}).execute()


def main() -> None:
    parser = argparse.ArgumentParser(description='Reapply Potex workbook UX formatting')
    parser.add_argument('--scope', choices=['all', 'cs', 'exec', 'sales', 'coaches', 'concierge', 'db'], default='all')
    parser.add_argument('--readmes-only', action='store_true')
    args = parser.parse_args()

    service = get_service()
    api = service.spreadsheets()

    if args.readmes_only:
        apply_readmes_and_hides(api)
        for scope in ['cs', 'exec', 'sales', 'coaches', 'concierge', 'db']:
            apply_protections_and_header_notes(api, scope)
        for scope in ['cs', 'exec', 'sales', 'coaches', 'concierge']:
            apply_tab_order(api, scope)
        print('Applied README + hidden helper columns + protections + tab order.')
        return

    scopes = ['cs', 'exec', 'sales', 'coaches', 'concierge', 'db'] if args.scope == 'all' else [args.scope]
    for scope in scopes:
        apply_baseline_and_signals(api, scope)
    apply_readmes_and_hides(api)
    for scope in scopes:
        apply_protections_and_header_notes(api, scope)
    for scope in [s for s in scopes if s in TAB_ORDER]:
        apply_tab_order(api, scope)
    print(f'Applied workbook UX for: {", ".join(scopes)}')


if __name__ == '__main__':
    main()
