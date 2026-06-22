export type AbsolutePath = `/${string}`;
export type RelativePath = string;
export type LocalRef = string;
export type GitSha = string;

export type RepositoryIdentity = {
  readonly repoId: string;
  readonly repoRoot: AbsolutePath;
  readonly gitDir: AbsolutePath;
  readonly defaultBaseRef: LocalRef;
};

export type BaseRefResolution = {
  readonly ref: LocalRef;
  readonly sha: GitSha;
};

export type BaseRefUnresolved = {
  readonly token: 'base-ref-unresolved';
  readonly ref: LocalRef;
};

export type ResolveLocalBaseRefResult =
  | {
      readonly ok: true;
      readonly value: BaseRefResolution;
    }
  | {
      readonly ok: false;
      readonly error: BaseRefUnresolved;
    };

export type ResolveLocalBaseRefInput = {
  readonly repository: RepositoryIdentity;
  readonly baseRef?: LocalRef;
  readonly resolveRefToSha: (ref: LocalRef, repository: RepositoryIdentity) => GitSha | undefined;
};

export const isAbsolutePath = (value: string): value is AbsolutePath => value.startsWith('/');

export const resolveLocalBaseRef = (input: ResolveLocalBaseRefInput): ResolveLocalBaseRefResult => {
  const ref = input.baseRef ?? input.repository.defaultBaseRef;
  const sha = input.resolveRefToSha(ref, input.repository);

  if (sha === undefined) {
    return {
      ok: false,
      error: {
        token: 'base-ref-unresolved',
        ref,
      },
    };
  }

  return {
    ok: true,
    value: {
      ref,
      sha,
    },
  };
};
