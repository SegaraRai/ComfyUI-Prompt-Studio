import { decode_text, encode_text } from "../../../wasm/pkg/cps_lib.js";
import { wasmReady } from "./init.js";

export async function encodeText(text: string): Promise<string> {
  await wasmReady;
  return encode_text(text);
}

export async function decodeText(text: string): Promise<string> {
  await wasmReady;
  return decode_text(text);
}
