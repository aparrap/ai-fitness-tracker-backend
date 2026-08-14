export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly causeMessage?: string
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
