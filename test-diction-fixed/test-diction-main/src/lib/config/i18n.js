// Tiny helper: pick the English or Arabic string depending on locale.

function tr(isAr, en, ar) {
  return isAr ? ar : en;
}

export { tr };
