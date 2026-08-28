declare module 'ipaddr.js' {
  export interface IPv4 {
    kind(): 'ipv4';
    toString(): string;
    match(other: IPv4, prefixLength: number): boolean;
  }
  export interface IPv6 {
    kind(): 'ipv6';
    parts: number[];
    isIPv4MappedAddress(): boolean;
    toIPv4Address(): IPv4;
    toNormalizedString(): string;
    match(other: IPv6, prefixLength: number): boolean;
  }
  export type Address = IPv4 | IPv6;
  export type IP = Address;
  export function isValid(value: string): boolean;
  export function parse(value: string): Address;
  export function parseCIDR(value: string): [Address, number];
}
