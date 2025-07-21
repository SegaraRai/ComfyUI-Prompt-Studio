function isMacPlatform(): boolean {
  return navigator.platform.includes("Mac");
}

export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const isMac = isMacPlatform();
  const parts = combo.split("+").map((p) => p.toLowerCase());

  const expected = {
    ctrl: parts.includes("ctrl") || (parts.includes("mod") && !isMac),
    cmd: parts.includes("cmd") || (parts.includes("mod") && isMac),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
    key: parts[parts.length - 1],
  };

  return (
    event.ctrlKey === expected.ctrl &&
    event.metaKey === expected.cmd &&
    event.shiftKey === expected.shift &&
    event.altKey === expected.alt &&
    (event.key.toLowerCase() === expected.key ||
      event.code.toLowerCase() === expected.key)
  );
}
