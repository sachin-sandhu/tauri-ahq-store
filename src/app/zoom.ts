import { invoke } from "@tauri-apps/api/core";

export default function setScale(scale?: string) {
  let val = 1.0;

  try {
    val = eval((scale || "100%").replace("%", "/100"));
  } catch (_) {

  }

  invoke("set_scale", {
    scale: val
  });
}