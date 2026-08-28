declare module 'ipaddr.js' {
  export interface IPv4 {
    kind(): 'ipv4';
    toString(): string;
  }
  export interface IPv6 {
    kind(): 'ipv6';
    parts: number[];
    isIPv4MappedAddress(): boolean;
    toIPv4Address(): IPv4;
    toNormalizedString(): string;
  }
  export type IP = IPv4 | IPv6;
  export function isValid(value: string): boolean;
  export function parse(value: string): IP;
}
