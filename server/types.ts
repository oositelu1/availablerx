import { Request } from 'express';

// Helper type for strongly-typed request bodies
export interface TypedRequestBody<T> extends Request {
  body: T;
}