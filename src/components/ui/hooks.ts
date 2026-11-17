"use client";

import { useEffect, useState } from "react";

/** True on phone-width screens (matches the CSS breakpoint). */
export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/**
 * How far the on-screen keyboard covers the bottom of the page (iOS doesn't resize
 * the layout for it), so toolbars can sit just above the keyboard.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  return inset;
}
