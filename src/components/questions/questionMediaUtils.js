export function isAssetMediaPath(value = "") {
  return typeof value === "string" && value.startsWith("/question-assets/");
}

export function orderChoicesForDisplay(options = []) {
  if (!Array.isArray(options)) {
    return [];
  }

  const hasKnownCorrectness = options.some((option) => typeof option?.isCorrect === "boolean");

  if (!hasKnownCorrectness) {
    return options;
  }

  return [...options].sort((left, right) => Number(left.isCorrect) - Number(right.isCorrect));
}
