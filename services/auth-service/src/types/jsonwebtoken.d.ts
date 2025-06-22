declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    jwtid?: string;
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: any
  ): any;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): any;
}