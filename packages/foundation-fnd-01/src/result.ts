export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export type NonEmptyArray<T> = readonly [T, ...T[]];
