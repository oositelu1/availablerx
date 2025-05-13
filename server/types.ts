import { Request } from 'express';
import { z } from 'zod';

// Type for a request with typed body
export interface TypedRequestBody<T> extends Request {
  body: T;
}