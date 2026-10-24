declare module "culori" {
  export function parse(color: string): any;
  export function formatHex(color: any): string;
  export function formatRgb(color: any): string;
  export function rgb(color: any): any;
  export function interpolate(colors: string[], mode?: string): (t: number) => any;
  const _default: any;
  export default _default;
}

