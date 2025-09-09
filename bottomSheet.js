// 日本語説明: ボトムシートの開閉・イベント制御を担うユーティリティモジュール

// 内部状態: 直前にフォーカスしていた要素（閉じたらフォーカスを戻すため）
let lastActiveElement = null;
// 日本語説明: 外側クリック検出のためのハンドラ参照を保持（close時に解除）
let outsideClickHandler = null;
// 日本語説明: クローズ時に通知するためのリスナー集合
const closeListeners = new Set();

// 日本語説明: モバイルかどうかの簡易判定（画面幅ベース）
export function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

// 日本語説明: ボトムシートを開く。htmlには既存ポップアップのHTMLをそのまま注入する
export function openBottomSheet(html, title = '詳細') {
  const sheet = document.getElementById('bottom-sheet');
  const body = document.getElementById('bs-body');
  const titleEl = document.getElementById('bs-title');
  const backdrop = document.getElementById('bottom-sheet-backdrop');
  const closeBtn = document.getElementById('bs-close');

  if (!sheet || !body || !titleEl || !backdrop || !closeBtn) return;

  // 直前のフォーカスを保持
  lastActiveElement = document.activeElement;

  // コンテンツ反映
  titleEl.textContent = title;
  body.innerHTML = html;

  // 表示（開く）
  sheet.hidden = false;
  // 日本語説明: スライドインアニメーションのための属性（CSSで監視）
  sheet.setAttribute('data-open', 'true');

  // 背面スクロールロック
  document.body.classList.add('bs-lock');

  // 初期フォーカスをクローズボタンへ
  closeBtn.focus();

  // 日本語説明: バックドロップはpointer-events:noneのため、
  // ドキュメントのクリック（キャプチャ）で外側クリックを検出して閉じる
  // ただし、ドラッグ操作（パン等）はclickを発火しないので、地図操作は維持される
  if (!outsideClickHandler) {
    outsideClickHandler = (e) => {
      // シート内クリックは無視
      if (sheet.contains(e.target)) return;
      // 日本語説明: 地図(#map)内のクリックは外側扱いにしない（ピン切替時に閉じない）
      const mapEl = document.getElementById('map');
      if (mapEl && mapEl.contains(e.target)) return;
      // シートが開いている場合のみ反応
      if (!sheet.hidden && sheet.getAttribute('data-open') === 'true') {
        closeBottomSheet();
      }
      // 伝播は止めない: 他のUIのクリックはそのまま動作させる
    };
    // 日本語説明: キャプチャではなくバブリングで検出（マーカーの stopPropagation を尊重）
    document.addEventListener('click', outsideClickHandler);
  }
}

// 日本語説明: ボトムシートを閉じる
export function closeBottomSheet() {
  const sheet = document.getElementById('bottom-sheet');
  const backdrop = document.getElementById('bottom-sheet-backdrop');
  if (!sheet || !backdrop) return;

  // スライドアウト（属性を外す）
  sheet.removeAttribute('data-open');

  // 背面スクロールロック解除
  document.body.classList.remove('bs-lock');

  // アニメーション終了後に非表示
  setTimeout(() => {
    sheet.hidden = true;

    // 元のフォーカス位置に戻す
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      try { lastActiveElement.focus(); } catch (_) {}
    }
    lastActiveElement = null;
    // 日本語説明: 外側クリック検出のイベントを解除（多重登録防止）
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler, true);
      outsideClickHandler = null;
    }
    // 日本語説明: クローズを購読者へ通知
    try {
      Array.from(closeListeners).forEach(fn => {
        try { fn(); } catch (_) {}
      });
    } catch (_) {}
  }, 250);
}

// 日本語説明: 一度だけ基本イベントをバインド
let bound = false;
export function bindBottomSheetEvents() {
  if (bound) return;
  const backdrop = document.getElementById('bottom-sheet-backdrop');
  const closeBtn = document.getElementById('bs-close');
  if (backdrop) {
    backdrop.addEventListener('click', () => closeBottomSheet());
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeBottomSheet());
  }
  // Escキーで閉じる
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBottomSheet();
  });
  bound = true;
}

// 日本語説明: 外部用の簡易API（型のヒント用）
export default {
  isMobile,
  openBottomSheet,
  closeBottomSheet,
  bindBottomSheetEvents,
};

// 日本語説明: ボトムシートが閉じた際に呼ばれるリスナーを登録する
export function onBottomSheetClose(listener) {
  if (typeof listener === 'function') {
    closeListeners.add(listener);
    // 解除用の関数を返す
    return () => closeListeners.delete(listener);
  }
  return () => {};
}
